import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import {
  discoverMigrations,
  LEDGER_SCHEMA,
  parseTimeoutSetting,
  resolveMigrationTimeouts,
  runMigrations,
  validateMigrationPlan,
} from './migrate.ts';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitrine-migrate-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('db/migrate: Migration Discovery, Ordering, Checksums & Timeouts', () => {
  it('uses a dedicated schema name that is never public or vitrine_*', () => {
    expect(LEDGER_SCHEMA).not.toBe('public');
    expect(LEDGER_SCHEMA.startsWith('vitrine_')).toBe(false);
  });

  it('discovers migrations in numeric order with exact SHA-256 checksums', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, '0010_later.sql'), 'SELECT 10;');
    fs.writeFileSync(path.join(dir, '0002_second.sql'), 'SELECT 2;');
    fs.writeFileSync(path.join(dir, '0001_init.sql'), 'SELECT 1;');

    const files = discoverMigrations(dir);
    expect(files.map((f) => f.filename)).toEqual([
      '0001_init.sql',
      '0002_second.sql',
      '0010_later.sql',
    ]);
    expect(files[0]?.checksum).toBe(
      crypto.createHash('sha256').update('SELECT 1;').digest('hex')
    );
  });

  it('refuses duplicate migration numbers (even with different zero-padding)', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, '0002_alpha.sql'), 'SELECT 1;');
    fs.writeFileSync(path.join(dir, '02_beta.sql'), 'SELECT 2;');

    expect(() => discoverMigrations(dir)).toThrow(/Duplicate migration number 2/);
  });

  it('refuses when an already-applied migration checksum changed (tamper check)', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, '0001_DB_v7.sql'), 'BEGIN; SELECT 1; COMMIT;');
    const disk = discoverMigrations(dir);

    expect(() =>
      validateMigrationPlan(disk, [
        { filename: '0001_DB_v7.sql', checksum: '0'.repeat(64) },
      ])
    ).toThrow(/Checksum mismatch for applied migration "0001_DB_v7\.sql"/);
  });

  it('refuses when a new unapplied file number is lower than the highest applied', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, '0001_init.sql'), 'SELECT 1;');
    fs.writeFileSync(path.join(dir, '0002_late_addition.sql'), 'SELECT 2;');
    fs.writeFileSync(path.join(dir, '0003_third.sql'), 'SELECT 3;');

    const disk = discoverMigrations(dir);
    const first = disk[0]!;
    const third = disk[2]!;

    expect(() =>
      validateMigrationPlan(disk, [
        { filename: first.filename, checksum: first.checksum },
        { filename: third.filename, checksum: third.checksum },
      ])
    ).toThrow(/Out-of-order migration "0002_late_addition\.sql"/);
  });

  it('returns an empty toApply plan (no-op) when all migrations match ledger checksums', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, '0001_DB_v7.sql'), 'BEGIN; SELECT 1; COMMIT;');
    const disk = discoverMigrations(dir);

    const plan = validateMigrationPlan(
      disk,
      disk.map((m) => ({ filename: m.filename, checksum: m.checksum }))
    );
    expect(plan.toApply).toEqual([]);
    expect(plan.alreadyApplied.map((m) => m.filename)).toEqual(['0001_DB_v7.sql']);
  });

  it('defaults timeouts off for 0001 and applies configured/safe timeouts for 0002+', () => {
    expect(resolveMigrationTimeouts(1, {})).toEqual({
      lockTimeout: '0',
      statementTimeout: '0',
    });
    expect(resolveMigrationTimeouts(2, {})).toEqual({
      lockTimeout: '10s',
      statementTimeout: '60s',
    });
    expect(
      resolveMigrationTimeouts(2, { lockTimeout: '3s', statementTimeout: '45000ms' })
    ).toEqual({
      lockTimeout: '3s',
      statementTimeout: '45000ms',
    });
    expect(() => parseTimeoutSetting('10s; DROP TABLE x;', '0')).toThrow(
      /Invalid PostgreSQL timeout value/
    );
  });

  it('fails cleanly when DATABASE_MIGRATOR_URL is missing', async () => {
    await expect(
      runMigrations({ connectionString: '' })
    ).rejects.toThrow(/DATABASE_MIGRATOR_URL is required/);
  });
});
