# Changelog

All notable changes to the Vitrine platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2026-11-12 (Task 0: Project Scaffold)
- Initial repository layout for TypeScript modular monolith: `apps/web`, `apps/worker`, `packages/shared`, `db/migrations`, `db/bootstrap`, `docs/`, `.github/workflows/`.
- Complete documentation skeleton with purpose lines:
  - `docs/STATUS.md` with all Phase 1 capabilities listed as NOT STARTED.
  - `docs/PRD.md` outlining the WhatsApp-first Angolan merchant workflow.
  - `docs/ARCHITECTURE.md` establishing modular monolith, PostgreSQL 16, BullMQ/Redis worker, and S3 media storage.
  - `docs/DATA_MODEL.md` documenting strict integer minor unit rules for money, RLS, and product lifecycle (`DRAFT` -> `PENDING_CONFIRMATION` -> `PUBLISHED` -> `ARCHIVED`).
  - `docs/WEBHOOKS_AND_API.md` defining WhatsApp webhook contracts and public APIs.
  - `docs/TEST_PLAN.md` establishing testing tiers, CI ephemeral Postgres, and minor unit validation.
  - `docs/SECURITY.md` specifying PostgreSQL 16 RLS, webhook HMAC verification, and zero-secret policy.
  - `docs/RUNBOOK.md` outlining operations and deployment guidelines.
  - `docs/OPEN_QUESTIONS.md` logging baseline migration `DB_v7.sql` placeholder and integration items.
  - `docs/DECISIONS/ADR-000-template.md` standard decision record template.
- Database bootstrap setup (`db/bootstrap/0000_bootstrap_roles.sql`) separated from migrations.
- Baseline migration placeholder `db/migrations/0001_DB_v7.sql` pending user provision.
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) with ephemeral PostgreSQL 16 service container, migration runner, linting, and automated test suite execution without global database dependencies.
- Apps/Web health check endpoint (`/health` and `/api/health`) returning service status, timestamp, uptime, and database connectivity.
- Vitest unit & integration test suite verifying health check status and JSON structure.
- Monolith shared package (`packages/shared`) with domain types, money types (`AOA` minor units), product status enums, and health response contracts.
