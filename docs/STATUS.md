# Project Status: Vitrine

> Current operational status, BUILD_PLAN_v8 P0 requirements tracking, and task log for Vitrine.

## Overview
Vitrine is a WhatsApp-first sales platform for Angolan merchants that turns product photos into AI-drafted listings, requires explicit merchant confirmation, generates shareable checkout links, processes orders and verified payments, and tracks fulfilment and reconciliation.

Allowed requirement statuses (per `docs/BUILD_PLAN_v8.md` §15): `Not started` | `In progress` | `Implemented` | `Tested` | `Pilot verified`.

## Phase 1 Pilot Requirements (`docs/BUILD_PLAN_v8.md` P0 Only)

All FR IDs below correspond directly to `docs/BUILD_PLAN_v8.md` §3.

| ID | P0 Requirement Summary | v8 Priority | Status |
|---|---|---|---|
| FR-1 | Merchant registers through verified chat identity; store and subdomain auto-provisioned | P0 | Not started |
| FR-2 | Merchant adds a product using a photo and optional free text | P0 | Not started |
| FR-3 | AI extracts structured draft with provenance and field-level uncertainty; merchant confirms before publication | P0 | Not started |
| FR-4 | Deterministic buyer catalogue lookup using approved fields (semantic/RAG deferred) | P1; basic lookup P0 | Not started |
| FR-5 | Buyer checks out without creating an account | P0 | Not started |
| FR-6 | System creates real provider payment request (labelled manual-payment workflow only before live provider approval) | P0 | Not started |
| FR-7 | Signed payment events persisted, deduplicated, matched by reference/amount/currency, applied idempotently | P0 | Not started |
| FR-8 | Merchant receives payment confirmation notification after verified payment | P0 | Not started |
| FR-9 | Order, payment, fulfilment, and payout states tracked independently with append-only history | P0 | Not started |
| FR-10 | Merchant can view open orders and basic sales totals through chat | P0 | Not started |
| FR-12 | Lightweight public store and product pages exist as shareable link targets | P0 | Not started |
| FR-13 | Direct-to-merchant settlement or merchant payment sub-account evaluation as provider-selection gate | P0 decision; implementation provider-dependent | Not started |
| FR-15 | Simple pilot fee reporting (full fee configurability deferred to P2) | P2; simple pilot fee reporting P0 | Not started |
| FR-17 | Paid-order notification itemizes actual platform and provider deductions | P0 | Not started |
| FR-18 | Checkout creates atomic, expiring stock reservation; payment consumes it and expiry releases it | P0 | Not started |
| FR-19 | Products without available stock excluded from public purchase and buyer recommendations | P0 | Not started |
| FR-21 | Paid orders carry fulfilment due times and overdue reminders | P0 | Not started |
| FR-22 | Merchant can list, ship, and complete orders using short chat commands | P0 | Not started |
| FR-29 | Basic support case handling for buyer disputes (payout freeze is Conditional P0) | Conditional P0 for platform-held funds; basic support case P0 | Not started |
| FR-33 | Every proactive WhatsApp notification uses an approved template appropriate to purpose and consent basis | P0 | Not started |

## Task Log

| Task | Scope | Status | Summary |
|---|---|---|---|
| **Task 0** | Initial Repository Scaffold | Accepted (reviewer: Claude, 2026-11-13) | Monolith folder layout (`apps/web`, `apps/worker`, `packages/shared`, `db/`, `docs/`, `.github/workflows/`), docs skeleton, and initial `/health` endpoint. |
| **Task 0.1** | Review Remediation & CI Hardening | Accepted (reviewer: Claude, 2026-11-13) | Added `pg` driver with `/health/live` and `/health/ready` (`SELECT 1`, 2s timeout, no env/uptime leak), strict TypeScript, `esbuild` production bundle (`dist/server.js`) with dynamic dev-only Vite import, `package-lock.json`, and hardened CI gates. |
| **Task 1A** | Align Repo with `DB_v7` & `BUILD_PLAN_v8` (incl. Amendments A–G) | In review | Replaced role bootstrap with `0000_bootstrap_migrator.sql` (`migrator` role), added `DB_v7.sql` byte-for-byte as `0001_DB_v7.sql`, added `db/operator/0001_post_migration.sql`, silenced secret output via `\gset` + CI dummy-password hygiene gate, added `db/tests/test_v7.py` with DB-scoped `ALTER DATABASE <DB> SET track_functions='all'` via `ADMIN_ROLE`, split CI into Job A (`test_v7.py`) and Job B (`npm test` + `GET /` `200 text/html` smoke test), implemented exact string-parsing Money conversion boundary in `packages/shared`, added `docs/BUILD_PLAN_v8.md` and `docs/SCHEMA_MIGRATION_BACKLOG_v8.md` (`OQ-006` closed), dropped `.git` & `bun.lock`, updated `.gitignore`, `.env.example`, and docs. |
| **Task 1A.1** | Remediation of Shipped Internal Files & Secret Scan Findings | In review | Deleted `public/assets/aistudio/`, added it to `.gitignore`, set `publicDir: false` in `vite.config.ts`, moved CI secret scan to `scripts/scan-dist.mjs` (recursive file-only traversal of `dist/index.html` and `dist/assets`) with Vitest fixture tests (`scripts/scan-dist.test.ts`), added CI `dist/` forbidden-extension/folder gate (`.sql`, `.md`, `.py`, `.env`, `.log`, `aistudio`), extended production smoke test (`/assets/aistudio/x` and `/db/migrations/0001_DB_v7.sql` must not return `vitrine_core` or `CREATE SCHEMA`), and documented `log_statement='all'` prohibition in `docs/RUNBOOK.md`. |
| **Task 1B** | Migration Runner & Deployment Checks (Backlog Migration 00) | In review | Implemented TypeScript `pg` migration runner (`db/migrate.ts`, `npm run db:migrate`) with dedicated `schema_migrations.ledger` owned by `migrator` (never `public` or `vitrine_*`), session advisory locking, SHA-256 checksum & monotonic order validation, `0001` off / `0002+` env DDL timeouts, and no-op re-runs; added role/membership allowlist check (`db/checks/deployment_checks.ts`, `npm run db:check`); added unit tests (`db/migrate.test.ts`, `db/checks/deployment_checks.test.ts`); wired dual-database runner, no-op, tamper test, `db:check`, and forbidden global-config repo scan into CI; added `docs/DECISIONS/ADR-003-migration-runner.md` and updated `docs/RUNBOOK.md`. |

## Explicitly Out of Scope (Phase 1 Pilot)
- Bookings / appointment services (`FR-34`–`FR-38`, P3)
- Subscriptions / balance withholding (`FR-16`, P2)
- Accounting / expense logging / estimated profit (`FR-25`, `FR-26`, P2)
- Abandoned-checkout recovery (`FR-39`, `FR-40`, P2)
- Vector search / semantic RAG AI sales assistant (deferred part of `FR-4`)
- Telegram or non-WhatsApp channels
- Central marketplace directory (`FR-14`, P3)
- Custom domains (column present in `DB_v7`, feature out of scope for Phase 1)
- Multi-item cart (single-product checkout only in Phase 1)
