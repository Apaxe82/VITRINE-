# Changelog

All notable changes to the Vitrine platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed - 2026-11-13 (Task 1A.1: Remediation of Shipped Internal Files & Secret Scan Findings)
- **Shipped Internal Files Removed & Guarded**:
  - Deleted `public/assets/aistudio/` and added `public/assets/aistudio/` to `.gitignore`.
  - Configured `publicDir: false` in `vite.config.ts`.
  - Added a post-build CI check in `.github/workflows/ci.yml` failing and printing paths if `dist/` contains `.sql`, `.md`, `.py`, `.env`, or `.log` files or any `aistudio` directory.
  - Extended CI production smoke test to verify `GET /assets/aistudio/x` and `GET /db/migrations/0001_DB_v7.sql` do not return bodies containing `"vitrine_core"` or `"CREATE SCHEMA"`.
- **Recursive Dist Secret Scanner (`scripts/scan-dist.mjs`)**:
  - Replaced the inline CI bundle scan with `scripts/scan-dist.mjs` (recursively walks `dist/index.html` and `dist/assets`, skipping directories and reading files only) and added `scripts/scan-dist.d.ts`.
  - Added `scripts/scan-dist.test.ts` testing clean nested fixtures and planted secret failures via Vitest.
- **Documentation**:
  - Updated `docs/RUNBOOK.md` warning against `log_statement = 'all'` in production while provisioning client-side expanded `psql` variables.
  - Added `Task 1A.1` (`In review`) in `docs/STATUS.md` while keeping `Task 1A` (`In review`).

### Changed - 2026-11-13 (Task 1A Amendments A–G)
- **Amendment A (Amended Rule 3 — Exact Money Boundary)**:
  - Added `parseNumericToMoney`, `moneyToNumericString`, and `addMoney` in `packages/shared/src/index.ts` using strict regex + `BigInt` string parsing/formatting (zero `Number()`/`parseFloat()` on decimal strings), enforced `Number.isSafeInteger` in `createMoney`, and updated `formatMoney` to pure string manipulation.
  - Added boundary tests in `packages/shared/src/index.test.ts` verifying `'12345678.90'` exact round-trip, `'0.10' + '0.20' === '0.30'`, negative/integer/single-decimal parsing, >2 decimal rejection, scientific notation rejection, and currency mismatch rejection.
  - Updated `docs/DECISIONS/ADR-002-money-representation.md`, `docs/DATA_MODEL.md`, and `docs/TEST_PLAN.md` to match amended Rule 3 (`NUMERIC(20,2)` for AOA pilot + exact string conversion boundary).
- **Amendment B (Drop `git init`)**:
  - Removed `.git/` directory so repository sync relies exclusively on AI Studio's GitHub integration; commit messages are suggested in the report only.
- **Amendment C (`db/tests/test_v7.py` Database-Scoped `track_functions`)**:
  - Replaced `ALTER SYSTEM SET track_functions='all'; SELECT pg_reload_conf();` with database-scoped `ALTER DATABASE "<DB>" SET track_functions='all';` executed as `ADMIN_ROLE` (env-overridable, default `postgres`). No assertions modified; no host-global changes.
- **Amendment D (`docs/BUILD_PLAN_v8.md`, `docs/SCHEMA_MIGRATION_BACKLOG_v8.md` & `docs/OPEN_QUESTIONS.md`)**:
  - Added `docs/BUILD_PLAN_v8.md` and `docs/SCHEMA_MIGRATION_BACKLOG_v8.md` (byte-for-byte copies) and referenced FR IDs from `docs/BUILD_PLAN_v8.md` explicitly in `docs/STATUS.md`.
  - Updated `OQ-004` through `OQ-007` in `docs/OPEN_QUESTIONS.md` and closed `OQ-006`.
- **Amendment E (SQL Secret Hygiene & CI Gate)**:
  - Updated `db/bootstrap/0000_bootstrap_migrator.sql` and `db/operator/0001_post_migration.sql` to bind psql variables via `SELECT set_config(...) AS _ \gset` and `\unset _` so secrets are never printed to stdout/stderr.
  - Added a CI Job A step (`Verify bootstrap SQL secret hygiene`) that runs `0000_bootstrap_migrator.sql` with a known dummy password, captures stdout+stderr, and fails if the dummy value appears.
- **Amendment F (Lockfile Cleanup)**:
  - Deleted `bun.lock`, retained `package-lock.json`, and added `bun.lock` and `bun.lockb` to `.gitignore`.
- **Amendment G (Reviewer Governance in `docs/STATUS.md`)**:
  - Updated Task 0 and Task 0.1 statuses to `Accepted (reviewer: Claude, 2026-11-13)` and set Task 1A to `In review`.

### Changed - 2026-11-13 (Task 1A: Align Repository with DB_v7 & BUILD_PLAN_v8)
- **Database Role Model Reset & Preserved Baseline**:
  - Removed `db/bootstrap/0000_bootstrap_roles.sql`.
  - Added `db/bootstrap/0000_bootstrap_migrator.sql` creating ONLY the external migration role (`migrator` via psql variable, `LOGIN`, `NOSUPERUSER`, `CREATEROLE`, database owner, guarded against `vitrine_*` prefix, password via psql variable).
  - Installed `DB_v7.sql` byte-for-byte as `db/migrations/0001_DB_v7.sql`.
  - Added `db/operator/0001_post_migration.sql` setting passwords on `vitrine_app`, `vitrine_public`, `vitrine_admin`, and `vitrine_registration` from psql variables and provisioning slot 1 via `vitrine_internal.provision_tenant_secret(1, ...)`.
- **Database Behavioral Tests & Dual-Job CI**:
  - Added `db/tests/test_v7.py` copied from `test_v7.py` with `HOST`, `PORT`, `DB` made overridable via environment variables (defaults unchanged).
  - Split `.github/workflows/ci.yml` into **Job A (`db-tests`)** (fresh DB -> bootstrap -> migrate -> `test_v7.py` asserting `"0 failed"`, without operator script) and **Job B (`app-tests`)** (second fresh DB -> bootstrap -> migrate -> operator script -> typecheck -> build -> secret scan -> `npm test` with `CI=true` as `vitrine_app` -> production smoke test verifying `/health/live` and `GET /` returning `200 text/html`).
- **Environment & Documentation**:
  - Updated `.env.example` with `DATABASE_URL`, `DATABASE_PUBLIC_URL`, `DATABASE_REGISTRATION_URL`, `DATABASE_ADMIN_URL`, `DATABASE_MIGRATOR_URL` (`migrator`), and `TENANT_CONTEXT_SECRET`.
  - Amended `docs/DECISIONS/ADR-001-stack-and-rls.md` (`AMENDED`) and created `docs/DECISIONS/ADR-002-money-representation.md` (`PROPOSED`).
  - Rewrote `docs/SECURITY.md` section 1 for the 10 roles, 3 schemas, and signed transaction-local tenant context (`app.merchant_id`, `app.merchant_exp`, `app.merchant_id_sig`); removed all `app.current_merchant_id` references across docs.
  - Updated `docs/STATUS.md` with `BUILD_PLAN_v8` P0 FR IDs (`Not started`) and task log (`Task 0`, `Task 0.1` = `In review`; `Task 1A` = `In progress`).
  - Updated `docs/OPEN_QUESTIONS.md` (`OQ-001` resolved; added `OQ-004`–`OQ-007`), `docs/RUNBOOK.md` (production non-`trust` auth rule), and `docs/TEST_PLAN.md`.

### Changed - 2026-11-13 (Task 0.1: Remediation of Review Findings)
- **Health Checks (`pg` driver)**:
  - Installed `pg` and `@types/pg`, split `/health/live` (aliases `/health`, `/api/health`) and `/health/ready` (`SELECT 1`, 2s timeout, `200`/`503`), removed `environment` and `uptimeSeconds` from public output.
- **Production Runtime & API Key Safety**:
  - Production mode unless `NODE_ENV === 'development'`, dynamic dev-only Vite import, `esbuild` server bundle (`dist/server.js`), `package-lock.json` generated, verified `vite.config.ts` does not expose `GEMINI_API_KEY`.
- **TypeScript & CI Hardening**:
  - Enabled `strict`, `noUncheckedIndexedAccess`, and `noImplicitOverride` in `tsconfig.json`.

### Added - 2026-11-12 (Task 0: Project Scaffold)
- Initial modular monolith scaffold (`apps/web`, `apps/worker`, `packages/shared`, `db/`, `docs/`, `.github/workflows/`).
