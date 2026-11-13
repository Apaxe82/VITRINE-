import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

export const RUNTIME_LOGIN_ROLES = [
  'vitrine_app',
  'vitrine_public',
  'vitrine_admin',
  'vitrine_registration',
] as const;

export const INTERNAL_NOLOGIN_ROLES = [
  'vitrine_viewer',
  'vitrine_security_owner',
  'vitrine_registration_owner',
  'vitrine_auth_owner',
  'vitrine_admin_owner',
  'vitrine_internal_owner',
] as const;

export const ALL_VITRINE_ROLES = [
  ...RUNTIME_LOGIN_ROLES,
  ...INTERNAL_NOLOGIN_ROLES,
] as const;

export interface RoleRecord {
  rolname: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  rolcreaterole: boolean;
  rolcreatedb: boolean;
  rolinherit: boolean;
  rolcanlogin: boolean;
  rolreplication: boolean;
}

export interface MembershipRecord {
  member: string;
  role: string;
  set_option: boolean;
  inherit_option: boolean;
}

export interface AllowedMembershipRule {
  member: string;
  role: string;
  setOption: boolean;
  inheritOption: boolean;
}

/**
 * Explicit allowlist of PostgreSQL role memberships permitted after DB_v7 migration.
 * In PostgreSQL 16+, CREATEROLE automatically records a bare ADMIN OPTION row
 * (set_option = false, inherit_option = false) for the migration role that created
 * each vitrine_* role; it grants zero SET ROLE or INHERIT privileges.
 */
export function buildAllowedMemberships(migratorRole: string): AllowedMembershipRule[] {
  return ALL_VITRINE_ROLES.map((role) => ({
    member: migratorRole,
    role,
    setOption: false,
    inheritOption: false,
  }));
}

/**
 * Evaluates role attributes and memberships against Vitrine's strict least-privilege policy.
 * Returns a list of violation descriptions (empty when all checks pass).
 */
export function evaluateDeploymentChecks(input: {
  migratorRole: string;
  roles: RoleRecord[];
  memberships: MembershipRecord[];
}): string[] {
  const violations: string[] = [];
  const roleMap = new Map(input.roles.map((r) => [r.rolname, r]));

  if (!input.migratorRole || input.migratorRole.startsWith('vitrine_')) {
    violations.push(
      `Migration role "${input.migratorRole}" must be non-empty and must not start with "vitrine_".`
    );
  }

  const migratorRecord = roleMap.get(input.migratorRole);
  if (!migratorRecord) {
    violations.push(`Migration role "${input.migratorRole}" does not exist in pg_roles.`);
  } else {
    if (migratorRecord.rolsuper) {
      violations.push(`Migration role "${input.migratorRole}" must NOT be SUPERUSER.`);
    }
    if (migratorRecord.rolbypassrls) {
      violations.push(`Migration role "${input.migratorRole}" must NOT have BYPASSRLS.`);
    }
    if (!migratorRecord.rolcanlogin) {
      violations.push(`Migration role "${input.migratorRole}" must have LOGIN.`);
    }
  }

  for (const roleName of RUNTIME_LOGIN_ROLES) {
    const rec = roleMap.get(roleName);
    if (!rec) {
      violations.push(`Runtime role "${roleName}" does not exist in pg_roles.`);
      continue;
    }
    if (rec.rolsuper) {
      violations.push(`Runtime role "${roleName}" must NOT be SUPERUSER.`);
    }
    if (rec.rolbypassrls) {
      violations.push(`Runtime role "${roleName}" must NOT have BYPASSRLS.`);
    }
    if (!rec.rolcanlogin) {
      violations.push(`Runtime role "${roleName}" must have LOGIN.`);
    }
    if (rec.rolcreaterole || rec.rolcreatedb || rec.rolinherit || rec.rolreplication) {
      violations.push(
        `Runtime role "${roleName}" has unsafe attributes (CREATEROLE/CREATEDB/INHERIT/REPLICATION).`
      );
    }
  }

  for (const roleName of INTERNAL_NOLOGIN_ROLES) {
    const rec = roleMap.get(roleName);
    if (!rec) {
      violations.push(`Internal role "${roleName}" does not exist in pg_roles.`);
      continue;
    }
    if (rec.rolsuper || rec.rolbypassrls || rec.rolcanlogin) {
      violations.push(
        `Internal role "${roleName}" must be NOLOGIN, NOSUPERUSER, and NOBYPASSRLS.`
      );
    }
  }

  const allowlist = buildAllowedMemberships(input.migratorRole);

  for (const m of input.memberships) {
    const allowed = allowlist.some(
      (rule) =>
        rule.member === m.member &&
        rule.role === m.role &&
        rule.setOption === m.set_option &&
        rule.inheritOption === m.inherit_option
    );
    if (!allowed) {
      violations.push(
        `Disallowed role membership: member="${m.member}" -> role="${m.role}" ` +
          `(set_option=${m.set_option}, inherit_option=${m.inherit_option}).`
      );
    }
  }

  return violations;
}

export async function runDeploymentChecks(options: {
  connectionString?: string;
  migratorRole?: string;
  logger?: Pick<Console, 'log' | 'error'>;
} = {}): Promise<void> {
  const connectionString =
    options.connectionString ??
    process.env.DATABASE_MIGRATOR_URL ??
    process.env.DATABASE_ADMIN_URL ??
    process.env.DATABASE_URL;

  if (!connectionString || connectionString.trim().length === 0) {
    throw new Error(
      'DATABASE_MIGRATOR_URL (or DATABASE_ADMIN_URL / DATABASE_URL) is required for deployment checks.'
    );
  }

  const logger = options.logger ?? console;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const currentUserRes = await client.query<{ current_user: string }>(
      'SELECT current_user'
    );
    const migratorRole =
      options.migratorRole ??
      process.env.MIGRATOR_ROLE ??
      currentUserRes.rows[0]?.current_user ??
      'migrator';

    const trackedRoles = [...ALL_VITRINE_ROLES, migratorRole];

    const rolesRes = await client.query<RoleRecord>(
      `SELECT rolname, rolsuper, rolbypassrls, rolcreaterole,
              rolcreatedb, rolinherit, rolcanlogin, rolreplication
         FROM pg_roles
        WHERE rolname = ANY($1::text[])`,
      [trackedRoles]
    );

    const membershipsRes = await client.query<MembershipRecord>(
      `SELECT c.rolname AS member,
              p.rolname AS role,
              coalesce((to_jsonb(m)->>'set_option')::boolean, true) AS set_option,
              coalesce((to_jsonb(m)->>'inherit_option')::boolean, true) AS inherit_option
         FROM pg_auth_members m
         JOIN pg_roles c ON c.oid = m.member
         JOIN pg_roles p ON p.oid = m.roleid
        WHERE c.rolname = ANY($1::text[])
           OR p.rolname = ANY($1::text[])`,
      [trackedRoles]
    );

    const violations = evaluateDeploymentChecks({
      migratorRole,
      roles: rolesRes.rows,
      memberships: membershipsRes.rows,
    });

    if (violations.length > 0) {
      throw new Error(
        `Deployment checks failed with ${violations.length} violation(s):\n- ` +
          violations.join('\n- ')
      );
    }

    logger.log(
      `[db:check] All deployment role and membership checks passed (migrator="${migratorRole}", runtimeRoles=${RUNTIME_LOGIN_ROLES.length}).`
    );
  } finally {
    await client.end().catch(() => {});
  }
}

const isCliEntry =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntry) {
  runDeploymentChecks()
    .then(() => {
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error(
        '[db:check] Deployment check failed:',
        err instanceof Error ? err.message : err
      );
      process.exit(1);
    });
}
