import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

export const LEDGER_SCHEMA = 'schema_migrations';
export const LEDGER_TABLE = 'ledger';
export const MIGRATION_ADVISORY_LOCK_KEY = '748291038472910';

const MIGRATION_FILENAME_PATTERN = /^(\d+)_([A-Za-z0-9_]+)\.sql$/;
const TIMEOUT_SETTING_PATTERN = /^(0|\d+(ms|s|min|h|d)?)$/;

export interface MigrationFile {
  num: number;
  filename: string;
  fullPath: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigrationRow {
  filename: string;
  checksum: string;
}

export interface MigrationPlan {
  toApply: MigrationFile[];
  alreadyApplied: MigrationFile[];
}

export interface MigrationExecutionResult {
  applied: Array<{ filename: string; checksum: string; durationMs: number }>;
  skipped: string[];
}

export interface RunMigrationsOptions {
  connectionString?: string;
  migrationsDir?: string;
  appVersion?: string;
  lockTimeout?: string;
  statementTimeout?: string;
  advisoryLockTimeoutMs?: number;
  logger?: Pick<Console, 'log' | 'error'>;
}

/**
 * Validates and normalizes a PostgreSQL timeout string (e.g. "0", "5000ms", "10s", "1min").
 */
export function parseTimeoutSetting(value: string | undefined, fallback: string): string {
  const effective = (value ?? fallback).trim();
  if (!TIMEOUT_SETTING_PATTERN.test(effective)) {
    throw new Error(
      `Invalid PostgreSQL timeout value "${effective}". Expected "0" or <digits><ms|s|min|h|d>.`
    );
  }
  return effective;
}

/**
 * Resolves effective lock_timeout and statement_timeout for a migration number.
 * Migration 0001 defaults to "0" (off) unless explicitly configured; future migrations
 * default to safe lock/statement bounds when env vars are unset.
 */
export function resolveMigrationTimeouts(
  migrationNum: number,
  env: { lockTimeout?: string; statementTimeout?: string }
): { lockTimeout: string; statementTimeout: string } {
  if (migrationNum === 1) {
    return {
      lockTimeout: parseTimeoutSetting(env.lockTimeout, '0'),
      statementTimeout: parseTimeoutSetting(env.statementTimeout, '0'),
    };
  }
  return {
    lockTimeout: parseTimeoutSetting(env.lockTimeout, '10s'),
    statementTimeout: parseTimeoutSetting(env.statementTimeout, '60s'),
  };
}

/**
 * Discovers, parses, checksums, and validates numeric ordering of db/migrations/*.sql files.
 * Rejects invalid filenames and duplicate numeric prefixes.
 */
export function discoverMigrations(migrationsDir: string): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory does not exist: ${migrationsDir}`);
  }

  const entries = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();

  if (entries.length === 0) {
    throw new Error(`No .sql migration files found in ${migrationsDir}`);
  }

  const seenNumbers = new Map<number, string>();
  const migrations: MigrationFile[] = [];

  for (const filename of entries) {
    const match = MIGRATION_FILENAME_PATTERN.exec(filename);
    if (!match || !match[1]) {
      throw new Error(
        `Invalid migration filename "${filename}". Expected <digits>_<name>.sql (e.g. 0001_DB_v7.sql).`
      );
    }

    const num = Number(match[1]);
    if (!Number.isSafeInteger(num) || num <= 0) {
      throw new Error(`Invalid migration prefix number in "${filename}". Must be > 0.`);
    }

    const duplicate = seenNumbers.get(num);
    if (duplicate) {
      throw new Error(
        `Duplicate migration number ${num}: "${duplicate}" and "${filename}".`
      );
    }
    seenNumbers.set(num, filename);

    const fullPath = path.join(migrationsDir, filename);
    const bytes = fs.readFileSync(fullPath);
    const checksum = crypto.createHash('sha256').update(bytes).digest('hex');

    migrations.push({
      num,
      filename,
      fullPath,
      sql: bytes.toString('utf8'),
      checksum,
    });
  }

  migrations.sort((a, b) => a.num - b.num);
  return migrations;
}

/**
 * Validates disk migrations against applied ledger rows:
 * - Refuses if an applied migration is missing on disk.
 * - Refuses if an applied migration's SHA-256 checksum changed.
 * - Refuses if an unapplied migration has a number lower than the highest applied number.
 */
export function validateMigrationPlan(
  diskMigrations: MigrationFile[],
  appliedRows: AppliedMigrationRow[]
): MigrationPlan {
  const diskByFilename = new Map(diskMigrations.map((m) => [m.filename, m]));
  const appliedByFilename = new Map(appliedRows.map((r) => [r.filename, r]));

  let highestAppliedNum = 0;

  for (const row of appliedRows) {
    const disk = diskByFilename.get(row.filename);
    if (!disk) {
      throw new Error(
        `Applied migration "${row.filename}" is missing from migrations directory.`
      );
    }
    if (disk.checksum !== row.checksum) {
      throw new Error(
        `Checksum mismatch for applied migration "${row.filename}": ` +
          `ledger=${row.checksum}, disk=${disk.checksum}.`
      );
    }
    if (disk.num > highestAppliedNum) {
      highestAppliedNum = disk.num;
    }
  }

  const toApply: MigrationFile[] = [];
  const alreadyApplied: MigrationFile[] = [];

  for (const file of diskMigrations) {
    if (appliedByFilename.has(file.filename)) {
      alreadyApplied.push(file);
      continue;
    }
    if (file.num <= highestAppliedNum) {
      throw new Error(
        `Out-of-order migration "${file.filename}" (number ${file.num}) is lower than ` +
          `or equal to highest applied migration number (${highestAppliedNum}).`
      );
    }
    toApply.push(file);
  }

  return { toApply, alreadyApplied };
}

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: unknown };
      if (typeof parsed.version === 'string' && parsed.version.trim().length > 0) {
        return parsed.version.trim();
      }
    }
  } catch {
    // Fallback below
  }
  return '0.1.0';
}

async function acquireAdvisoryLock(
  client: Client,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + Math.max(0, timeoutMs);

  while (true) {
    const res = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1::bigint) AS acquired',
      [MIGRATION_ADVISORY_LOCK_KEY]
    );
    if (res.rows[0]?.acquired) {
      return;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Could not acquire migration advisory lock (${MIGRATION_ADVISORY_LOCK_KEY}) within ${timeoutMs}ms. ` +
          'Another migration runner may be active.'
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Executes pending SQL migrations against PostgreSQL 16 as the non-superuser migration role.
 */
export async function runMigrations(
  options: RunMigrationsOptions = {}
): Promise<MigrationExecutionResult> {
  const connectionString = options.connectionString ?? process.env.DATABASE_MIGRATOR_URL;
  if (!connectionString || connectionString.trim().length === 0) {
    throw new Error('DATABASE_MIGRATOR_URL is required to run database migrations.');
  }

  const migrationsDir = path.resolve(
    options.migrationsDir ?? process.env.MIGRATIONS_DIR ?? 'db/migrations'
  );
  const appVersion =
    options.appVersion ?? process.env.APP_VERSION ?? readPackageVersion();
  const advisoryLockTimeoutMs =
    options.advisoryLockTimeoutMs ??
    Number(process.env.MIGRATION_ADVISORY_LOCK_TIMEOUT_MS ?? 10000);
  const logger = options.logger ?? console;

  const diskMigrations = discoverMigrations(migrationsDir);
  const client = new Client({ connectionString });

  await client.connect();
  let lockHeld = false;

  try {
    const roleCheck = await client.query<{ current_user: string; rolsuper: boolean }>(
      `SELECT current_user, rolsuper FROM pg_roles WHERE rolname = current_user`
    );
    const roleInfo = roleCheck.rows[0];
    if (!roleInfo) {
      throw new Error('Could not resolve current PostgreSQL migration role.');
    }
    if (roleInfo.current_user.startsWith('vitrine_')) {
      throw new Error(
        `Migration runner must not connect as a vitrine_* role (connected as "${roleInfo.current_user}").`
      );
    }
    if (roleInfo.rolsuper) {
      throw new Error(
        `Migration runner must run as a non-superuser migration role (connected as superuser "${roleInfo.current_user}").`
      );
    }

    await acquireAdvisoryLock(client, advisoryLockTimeoutMs);
    lockHeld = true;

    await client.query(`
      CREATE SCHEMA IF NOT EXISTS ${LEDGER_SCHEMA};
      REVOKE ALL ON SCHEMA ${LEDGER_SCHEMA} FROM PUBLIC;
      CREATE TABLE IF NOT EXISTS ${LEDGER_SCHEMA}.${LEDGER_TABLE} (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        applied_by TEXT NOT NULL DEFAULT current_user,
        app_version TEXT NOT NULL,
        duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0)
      );
      REVOKE ALL ON TABLE ${LEDGER_SCHEMA}.${LEDGER_TABLE} FROM PUBLIC;
    `);

    const ledgerRes = await client.query<AppliedMigrationRow>(
      `SELECT filename, checksum FROM ${LEDGER_SCHEMA}.${LEDGER_TABLE} ORDER BY filename ASC`
    );
    const plan = validateMigrationPlan(diskMigrations, ledgerRes.rows);

    if (plan.toApply.length === 0) {
      logger.log(
        `[db:migrate] No pending migrations (${plan.alreadyApplied.length} already applied).`
      );
      return {
        applied: [],
        skipped: plan.alreadyApplied.map((m) => m.filename),
      };
    }

    const applied: Array<{ filename: string; checksum: string; durationMs: number }> = [];

    for (const file of plan.toApply) {
      const timeouts = resolveMigrationTimeouts(file.num, {
        lockTimeout: options.lockTimeout ?? process.env.MIGRATION_LOCK_TIMEOUT,
        statementTimeout: options.statementTimeout ?? process.env.MIGRATION_STATEMENT_TIMEOUT,
      });

      const startedAt = Date.now();
      logger.log(
        `[db:migrate] Applying ${file.filename} (lock_timeout=${timeouts.lockTimeout}, statement_timeout=${timeouts.statementTimeout})...`
      );

      try {
        await client.query(`SET lock_timeout = '${timeouts.lockTimeout}'`);
        await client.query(`SET statement_timeout = '${timeouts.statementTimeout}'`);
        await client.query(file.sql);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        await client.query(`SET lock_timeout = '0'`).catch(() => {});
        await client.query(`SET statement_timeout = '0'`).catch(() => {});
        throw err;
      }

      await client.query(`SET lock_timeout = '0'`);
      await client.query(`SET statement_timeout = '0'`);

      const durationMs = Math.max(0, Date.now() - startedAt);
      await client.query(
        `INSERT INTO ${LEDGER_SCHEMA}.${LEDGER_TABLE} (filename, checksum, applied_by, app_version, duration_ms)
         VALUES ($1, $2, current_user, $3, $4)`,
        [file.filename, file.checksum, appVersion, durationMs]
      );

      logger.log(`[db:migrate] Applied ${file.filename} in ${durationMs}ms.`);
      applied.push({ filename: file.filename, checksum: file.checksum, durationMs });
    }

    return {
      applied,
      skipped: plan.alreadyApplied.map((m) => m.filename),
    };
  } finally {
    if (lockHeld) {
      await client
        .query('SELECT pg_advisory_unlock($1::bigint)', [MIGRATION_ADVISORY_LOCK_KEY])
        .catch(() => {});
    }
    await client.end().catch(() => {});
  }
}

const isCliEntry =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntry) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error('[db:migrate] Migration failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
