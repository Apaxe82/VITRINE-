# Operational Runbook: Vitrine

> Purpose: Standard operating procedures for local development, database bootstrap, migrations, operator provisioning, CI execution, production deployment, and incident triage.

## 1. Local Development
1. **Prerequisites**: Node.js 22+, PostgreSQL 16 (`pgcrypto` extension available), Redis, Python 3 (for `db/tests/test_v7.py`).
2. **Environment**: Copy `.env.example` to `.env` and populate runtime role URLs and `TENANT_CONTEXT_SECRET` (32+ byte hex string).
3. **Database Bootstrap, Migration & Operator Setup**:
   - Step 1 (as superuser on fresh target DB): run `db/bootstrap/0000_bootstrap_migrator.sql` with `-v ON_ERROR_STOP=1 -v migrator_role="migrator" -v migrator_password="$MIGRATOR_PASSWORD"` to provision the non-`vitrine_*` migration role owning the target database.
- Step 2 (as `migrator`): apply `db/migrations/*.sql` sequentially using the migration runner: `DATABASE_MIGRATOR_URL=... npm run db:migrate`, then verify roles/memberships with `npm run db:check`.
   - Step 3 (as `migrator`, for app runtime environments): run `db/operator/0001_post_migration.sql` with `-v ON_ERROR_STOP=1` and psql variables for `app_password`, `public_password`, `admin_password`, `registration_password`, and `tenant_secret_hex` (`TENANT_CONTEXT_SECRET`).
4. **Start Web Service (Dev)**: `NODE_ENV=development npm run dev` (serves Express + Vite middleware on port 3000).
5. **Start Web Service (Production Bundle)**: `npm run build && npm start` (runs `node dist/server.js`; any `NODE_ENV` other than `development` runs in production mode).
6. **Start Worker Service**: `npm run worker:dev`.

## 2. Database Authentication & Logging Policy (CRITICAL)
- **Production Must NEVER Use `trust` Authentication**: Production `pg_hba.conf` MUST enforce `scram-sha-256` (or mTLS client certificates) for all `vitrine_*` roles (`vitrine_app`, `vitrine_public`, `vitrine_admin`, `vitrine_registration`) and for `migrator`.
- **CI Exception Only**: Ephemeral `POSTGRES_HOST_AUTH_METHOD=trust` is permitted ONLY inside isolated, short-lived CI service containers so `db/tests/test_v7.py` can connect across all roles without running the operator password script in Job A.
- **No `log_statement = 'all'` During Provisioning**: Operator and bootstrap `psql` variables (`:'migrator_password'`, `:'app_password'`, `:'tenant_secret_hex'`, etc.) expand client-side into SQL literals before transmission. Production PostgreSQL instances MUST NOT run with `log_statement = 'all'` (or equivalent full SQL statement logging) while passwords or tenant secrets are provisioned.

## 3. Migration Operations, Lock/Timeout Policy & Recovery
- **Mandatory Backup Before Migration**: Before running `npm run db:migrate` against staging or production, capture a verified point-in-time snapshot or logical backup (`pg_dump --format=custom --no-owner --file="vitrine_pre_migration_$(date -u +%Y%m%dT%H%M%SZ).dump"`) and confirm restore readiness.
- **Deployment Role**:
  - Migrations MUST run exclusively via `DATABASE_MIGRATOR_URL` as the external non-`vitrine_*`, `NOSUPERUSER`, `CREATEROLE` migration role (`migrator`).
  - The ledger lives in `schema_migrations.ledger` (owned by `migrator`; never in `public` or `vitrine_*`).
  - Run `npm run db:check` immediately after every migration to verify `vitrine_*` and `migrator` roles remain `NOSUPERUSER`/`NOBYPASSRLS` and memberships match the repository allowlist.
- **Lock & Timeout Policy**:
  - `db/migrate.ts` acquires a PostgreSQL session advisory lock (`748291038472910`) so concurrent migration runners cannot run simultaneously (`MIGRATION_ADVISORY_LOCK_TIMEOUT_MS`, default `10000`).
  - `0001_DB_v7.sql` runs with `lock_timeout = 0` and `statement_timeout = 0` (off) by default.
  - All subsequent migrations (`0002+`) enforce bounded `MIGRATION_LOCK_TIMEOUT` (default `10s`) and `MIGRATION_STATEMENT_TIMEOUT` (default `60s`) so DDL cannot block live traffic behind lock queues. Use additive, non-blocking schema changes (`NOT VALID` constraints + separate `VALIDATE CONSTRAINT`, expand-and-contract) on live tables.
- **Recovery Steps**:
  1. **Failed Transactional Migration**: PostgreSQL rolls back aborted DDL automatically (`db/migrate.ts` issues `ROLLBACK`, does NOT write a `schema_migrations.ledger` row, and releases the advisory lock). Fix the unapplied migration file or restore clean state before retrying.
  2. **Failed Non-Transactional / Partial Migration (`CONCURRENTLY`, etc.)**: Restore from the pre-migration backup (`pg_restore`) or apply an explicit compensating forward migration; NEVER edit an already-applied migration file in `schema_migrations.ledger` (the runner rejects checksum mismatches).
  3. **Stale Advisory Lock**: If a runner process was `SIGKILL`ed and left an orphaned backend session holding advisory lock `748291038472910`, inspect `pg_locks` / `pg_stat_activity` for `objid` / `migrator` and terminate the stale backend (`SELECT pg_terminate_backend(<pid>);`) after confirming no migration is actively executing.

## 4. Incident Triage
- **Failed Webhooks**: Check dead-letter queues in Redis/BullMQ or application error logs.
- **Unverified Payments**: Review pending payment proofs in operator manual-review queue.
- **RLS / Tenant Context Failures**: Verify that `vitrine_internal.app_tenant_secret` has an active slot (`1` or `2`) matching `TENANT_CONTEXT_SECRET`, and that every tenant transaction sets `app.merchant_id` (lowercase UUID), `app.merchant_exp` (`now < exp <= now + 3600`), and `app.merchant_id_sig` using `set_config(..., true)` (transaction-local only, pooler-safe).
