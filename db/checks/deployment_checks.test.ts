import { describe, it, expect } from 'vitest';
import {
  ALL_VITRINE_ROLES,
  buildAllowedMemberships,
  evaluateDeploymentChecks,
  INTERNAL_NOLOGIN_ROLES,
  RUNTIME_LOGIN_ROLES,
  type RoleRecord,
} from './deployment_checks.ts';

function makeValidRoles(migratorRole = 'migrator'): RoleRecord[] {
  return [
    {
      rolname: migratorRole,
      rolsuper: false,
      rolbypassrls: false,
      rolcreaterole: true,
      rolcreatedb: false,
      rolinherit: true,
      rolcanlogin: true,
      rolreplication: false,
    },
    ...RUNTIME_LOGIN_ROLES.map((rolname) => ({
      rolname,
      rolsuper: false,
      rolbypassrls: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolinherit: false,
      rolcanlogin: true,
      rolreplication: false,
    })),
    ...INTERNAL_NOLOGIN_ROLES.map((rolname) => ({
      rolname,
      rolsuper: false,
      rolbypassrls: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolinherit: false,
      rolcanlogin: false,
      rolreplication: false,
    })),
  ];
}

describe('db/checks/deployment_checks', () => {
  it('passes when all roles are non-superuser, NOBYPASSRLS, and memberships match allowlist', () => {
    const roles = makeValidRoles('migrator');
    const memberships = buildAllowedMemberships('migrator').map((r) => ({
      member: r.member,
      role: r.role,
      set_option: r.setOption,
      inherit_option: r.inheritOption,
    }));

    expect(
      evaluateDeploymentChecks({ migratorRole: 'migrator', roles, memberships })
    ).toEqual([]);
  });

  it('fails if any runtime or migration role is SUPERUSER or BYPASSRLS', () => {
    const roles = makeValidRoles('migrator').map((r) => {
      if (r.rolname === 'vitrine_app') return { ...r, rolbypassrls: true };
      if (r.rolname === 'migrator') return { ...r, rolsuper: true };
      return r;
    });

    const violations = evaluateDeploymentChecks({
      migratorRole: 'migrator',
      roles,
      memberships: [],
    });
    expect(violations).toContain('Migration role "migrator" must NOT be SUPERUSER.');
    expect(violations).toContain('Runtime role "vitrine_app" must NOT have BYPASSRLS.');
  });

  it('fails if an unallowlisted or active (SET/INHERIT) role membership exists', () => {
    const roles = makeValidRoles('migrator');
    const memberships = [
      {
        member: 'migrator',
        role: ALL_VITRINE_ROLES[0],
        set_option: true,
        inherit_option: false,
      },
      {
        member: 'vitrine_app',
        role: 'pg_read_all_data',
        set_option: true,
        inherit_option: true,
      },
    ];

    const violations = evaluateDeploymentChecks({
      migratorRole: 'migrator',
      roles,
      memberships,
    });
    expect(violations.length).toBe(2);
    expect(violations[0]).toContain('Disallowed role membership');
    expect(violations[1]).toContain('pg_read_all_data');
  });
});
