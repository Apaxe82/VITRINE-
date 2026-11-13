# Test Plan: Vitrine

> Purpose: Defines testing strategy, test levels, database behavioral tests, CI automation gates, and verification protocols for Vitrine.

## 1. Testing Philosophy
- **Real Over Mock**: Database security, RLS policies, role isolation, connectivity, financial calculations, and state transitions must run against real PostgreSQL 16 instances.
- **Mandatory Tests**: Every change must ship with accompanying tests.
- **CI Strictness**: The CI readiness test (`/health/ready` returning `200` with `database: "connected"`) MUST FAIL—never skip—when `CI=true` and PostgreSQL is unreachable or unconfigured.
- **Preserved DB Behavioral Suite**: `db/tests/test_v7.py` tests every role (`vitrine_app`, `vitrine_public`, `vitrine_admin`, `vitrine_registration`, `migrator`, `postgres`), signed tenant context, column-level grants, admin kill-switch policies, and InitPlan RLS performance without altering any assertions. `HOST`, `PORT`, `DB`, and `ADMIN_ROLE` (default `postgres`) are env-overridable, and `track_functions='all'` is scoped to the target database via `ALTER DATABASE <DB> SET track_functions='all'` (no `ALTER SYSTEM` or `pg_reload_conf()`).
- **Exact Money Conversion Boundary**: `packages/shared/src/index.test.ts` tests exact string-parsed conversion between DB `NUMERIC(20,2)` strings and integer-minor-unit `Money` (e.g., `'12345678.90'` exact round-trip, `'0.10' + '0.20' === '0.30'`, rejection of >2 decimal places, scientific notation, and floating-point minor units).

## 2. Test Tiers
1. **Database Behavioral Tests (`db/tests/test_v7.py`)**:
   - Executed in CI Job A against a fresh PostgreSQL 16 database after `0000_bootstrap_migrator.sql` and `0001_DB_v7.sql` (without running `0001_post_migration.sql`).
   - CI fails unless `test_v7.py` exits 0 and prints `"0 failed"`.
2. **Unit & Application Integration Tests (`npm test`)**:
   - Executed in CI Job B against a second fresh PostgreSQL 16 database after bootstrap, migrations, and `db/operator/0001_post_migration.sql`, connecting as `vitrine_app` with `CI=true`.
   - Covers `packages/shared` exact Money conversion boundary & invariants, `apps/worker` initialization, `/health/live` (and `/health`, `/api/health` aliases) without DB, `/health/ready` `503` on unreachable/unset DB, and `/health/ready` `200` on CI Postgres.
3. **Production Smoke Test**:
   - Runs `npm run build`, starts `NODE_ENV=production npm start` (`node dist/server.js`), verifies `GET /health/live` (`200` JSON) and `GET /` (`200` `text/html` from the built client bundle), and terminates cleanly.

## 3. CI Gates (`.github/workflows/ci.yml`)
1. **Job A (`db-tests`)**:
   - Fresh ephemeral PostgreSQL 16 (`trust` auth strictly for CI).
   - Verify bootstrap SQL secret hygiene: run `0000_bootstrap_migrator.sql` with a known dummy password, capture stdout+stderr, and fail if the dummy password appears.
   - Bootstrap `migrator` via `0000_bootstrap_migrator.sql` (`psql -v ON_ERROR_STOP=1`).
   - Verify migration filename ordering (`db/migrations/*.sql`).
   - Apply migrations as `migrator` (`psql -v ON_ERROR_STOP=1`).
   - Run `python3 db/tests/test_v7.py` and assert `"0 failed"` in output (operator script NOT run in Job A).
2. **Job B (`app-tests`)**:
   - Clean `npm ci` from `package-lock.json` (`bun.lock`/`bun.lockb` removed and gitignored).
   - Second fresh ephemeral PostgreSQL 16.
   - Bootstrap `migrator`, verify migration order, apply migrations as `migrator`, then run `db/operator/0001_post_migration.sql` (verifying no secret prints to stdout+stderr).
   - `npm run typecheck` (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
   - `npm run build` (`vite build` + `esbuild` `dist/server.js`).
   - Client bundle secret scan on `dist/index.html` and `dist/assets/*` (`GEMINI`, `API_KEY`, non-scalar `.env.example` values).
   - `npm test` with `CI=true` connecting as `vitrine_app`.
   - Production smoke test verifying `/health/live` (`200`) and `GET /` (`200 text/html`).
