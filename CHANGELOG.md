# Changelog

All notable changes to the Vitrine platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed - 2026-11-13 (Task 0.1: Remediation of Review Findings)
- **Health Checks (`pg` driver)**:
  - Installed `pg` and `@types/pg`.
  - Split endpoints into `GET /health/live` (process liveness, no dependencies, always 200; `/health` and `/api/health` kept as aliases) and `GET /health/ready` (runs `SELECT 1` with a 2s timeout, returning 200 only on query success and 503 with `database: "disconnected"` otherwise).
  - Removed `environment` and `uptimeSeconds` from public health responses; never reports `database: "connected"` unless a query succeeds.
  - Added tests for `/health/live` without DB, `/health/ready` returning 503 on unreachable/unset `DATABASE_URL`, and `/health/ready` returning 200 against CI PostgreSQL (fails when `CI=true` if unreachable).
- **Production Runtime & API Key Safety**:
  - Updated `server.ts` to treat any `NODE_ENV !== 'development'` as production and load Vite middleware dynamically only in development.
  - Added `esbuild` bundling (`npm run build:server` -> `dist/server.js`) resolving `@vitrine/*` aliases; updated `npm start` to `node dist/server.js`.
  - Upgraded `esbuild` to `^0.28.0` to satisfy `vite@8.3.8` peer dependency and generated committed `package-lock.json`.
  - Verified `vite.config.ts` contains no `define` or client exposure of `GEMINI_API_KEY`.
- **Database Roles & Security**:
  - Updated `db/bootstrap/0000_bootstrap_roles.sql` to create `vitrine_migrator` (owns schema `public` and objects) and `vitrine_app` (`LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS`, `REVOKE CREATE ON SCHEMA public`).
  - Removed all password literals from committed SQL and CI files; bootstrap accepts runtime `psql` variables (`migrator_password`, `app_password`).
  - Added `DATABASE_MIGRATOR_URL` to `.env.example`.
- **TypeScript Hardening**:
  - Enabled `strict`, `noUncheckedIndexedAccess`, and `noImplicitOverride` in `tsconfig.json`; removed `allowJs`, `experimentalDecorators`, and `useDefineForClassFields`.
- **CI Hardening & Documentation**:
  - Updated `.github/workflows/ci.yml` with `-v ON_ERROR_STOP=1`, migration ordering/naming check, ephemeral runtime DB credentials, `vitrine_migrator` migration execution, `npm run typecheck`, `npm run build`, client bundle secret scan (`GEMINI`, `API_KEY`, `.env.example` values), `vitrine_app` test execution with `CI=true`, and production smoke test.
  - Updated `docs/STATUS.md` (all Phase 1 capabilities marked `NOT STARTED`, Task Log with `0` and `0.1`), `docs/SECURITY.md`, `docs/TEST_PLAN.md`, `docs/OPEN_QUESTIONS.md`, and created `docs/DECISIONS/ADR-001-stack-and-rls.md`.

### Added - 2026-11-12 (Task 0: Project Scaffold)
- Initial repository layout for TypeScript modular monolith: `apps/web`, `apps/worker`, `packages/shared`, `db/migrations`, `db/bootstrap`, `docs/`, `.github/workflows/`.
- Complete documentation skeleton with purpose lines.
- Database bootstrap setup (`db/bootstrap/0000_bootstrap_roles.sql`) separated from migrations.
- Baseline migration placeholder `db/migrations/0001_DB_v7.sql` pending user provision.
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) with ephemeral PostgreSQL 16 service container, migration runner, linting, and automated test suite execution.
- Health check endpoint (`/health` and `/api/health`) and initial Vitest tests.
- Monolith shared package (`packages/shared`) with domain types, money types (`AOA` minor units), product status enums, and health response contracts.
