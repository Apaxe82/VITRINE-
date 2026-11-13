# ADR-003: Custom TypeScript Migration Runner & Dedicated Ledger Schema

> Purpose: Records the architectural decision for database migration execution, ledger schema placement, concurrency locking, immutability checks, and DDL timeouts (`SCHEMA_MIGRATION_BACKLOG_v8.md` Migration 00).

## Status
ACCEPTED (Implemented in Task 1B)

## Context
- Vitrine relies on PostgreSQL 16 with `DB_v7.sql` (`db/migrations/0001_DB_v7.sql`), which:
  - Contains its own `BEGIN ... COMMIT` transaction, pre-flight guards, temporary `*_owner` role membership grants/revokes, and final self-verification assertions.
  - Strictly enforces that `public` remains unused (`REVOKE CREATE ON SCHEMA public FROM PUBLIC`) and that the three application schemas (`vitrine_core`, `vitrine_internal`, `vitrine_public_api`) and ten `vitrine_*` roles are isolated from migration tooling.
  - Requires migrations to run under a non-superuser, non-`vitrine_*` migration role (`migrator`) owning the database.
- General-purpose ORM migration tools (Prisma Migrate, Drizzle Kit) assume schema ownership in `public` or manage transactions/roles in ways that conflict with `DB_v7.sql`'s explicit transaction boundaries and PG16 privilege verification.

## Decision
1. **Custom TypeScript Runner (`db/migrate.ts`)**:
   - Connects via `pg` using `DATABASE_MIGRATOR_URL` (`migrator`), verifying at startup that `current_user` is neither `vitrine_*` nor `rolsuper`.
   - Acquires a PostgreSQL session advisory lock (`pg_try_advisory_lock`) so two runners cannot execute concurrently.
2. **Dedicated Non-`public`, Non-`vitrine_*` Ledger Schema**:
   - Stores applied migration records in `schema_migrations.ledger` (owned by `migrator`, `REVOKE ALL ... FROM PUBLIC`), recording `filename` (PK), `checksum` (SHA-256), `applied_at`, `applied_by`, `app_version`, and `duration_ms`.
3. **Strict Ordering, Tamper Refusal, and Idempotency**:
   - Applies `db/migrations/*.sql` in strict numeric prefix order (`<digits>_<name>.sql`).
   - Refuses on duplicate numeric prefixes, any SHA-256 checksum mismatch on already-applied files, or any pending file with a number lower than or equal to the highest applied migration.
   - Executes each migration SQL file (preserving `0001_DB_v7.sql`'s own `BEGIN`/`COMMIT`) and writes the ledger row only after execution succeeds; re-running when up to date is a no-op.
4. **Timeout Policy**:
   - `lock_timeout` and `statement_timeout` default to off (`0`) for `0001_DB_v7.sql`, and default to `10s` / `60s` (configurable via `MIGRATION_LOCK_TIMEOUT` and `MIGRATION_STATEMENT_TIMEOUT`) for `0002+` migrations.
5. **Post-Migration Deployment Verification (`db/checks/deployment_checks.ts`)**:
   - Exposed via `npm run db:check` and run in CI to confirm runtime and migration roles are `NOSUPERUSER` and `NOBYPASSRLS`, and that all `pg_auth_members` entries match an explicit allowlist.

## Consequences
### Positive
- Zero conflict with `DB_v7.sql`'s internal `BEGIN`/`COMMIT` and role-membership assertions.
- Ledger is completely isolated from `public` and `vitrine_*` schemas and inaccessible to runtime roles.
- Deterministic tamper detection, concurrency protection, and lock-timeout safety for future live migrations.

### Negative & Trade-offs
- Maintaining a small in-repo TypeScript runner (~280 lines) instead of an off-the-shelf CLI requires unit tests (`db/migrate.test.ts`) and CI dual-database validation, both included in Task 1B.

## Compliance & Invariants
- Never modify an already-applied migration file; always add a new forward migration (`0002+`).
- Never store the migration ledger in `public` or any `vitrine_*` schema.
- Run `npm run db:check` after every migration in CI and staging/production deployments.
