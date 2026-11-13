# ADR-001: Fixed Modular Monolith Stack, Phase 1 Exclusions, and PostgreSQL RLS Role Model

> Purpose: Records the foundational technology stack pins, explicit Phase 1 scope exclusions, and PostgreSQL 16 Row-Level Security role architecture for Vitrine.

## Status
AMENDED (The 2-role model originally described below is superseded by `DB_v7.sql` as of Task 1A.)

## Context
Vitrine is a WhatsApp-first commerce platform for Angolan merchants handling financial records (orders, verified payments, daily reconciliation). The architecture must prioritize operational simplicity, strict multi-tenant data isolation, and clear Phase 1 delivery boundaries.

## Decision

### 1. Stack Pins
- **Runtime & Language**: Node.js 22 + TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`).
- **Architecture**: Modular monolith with two deployable units (`apps/web`, `apps/worker`) sharing domain types and invariants in `packages/shared`.
- **System of Record**: PostgreSQL 16 with Row-Level Security (RLS).
- **Queue / Retries**: Redis + BullMQ strictly for background jobs and retryable async workflows (`apps/worker`).
- **Media Storage**: S3-compatible object storage for product photos and payment receipts.
- **AI Engine**: Google Gemini API called exclusively from server-side modules (never bundled or exposed to the client).

### 2. Explicit Exclusions
- **No Firebase / Firestore**: Forbidden for application data.
- **No Microservices**: All domain modules remain inside the modular monolith.
- **Phase 1 Scope Exclusions (Out of Scope)**:
  - Bookings / services
  - Subscriptions
  - Accounting / profit & loss
  - Abandoned-checkout recovery
  - Vector search / AI sales assistant
  - Telegram
  - Marketplace / multi-merchant discovery
  - Custom domains
  - Multi-item cart (single-item checkout only)

### 3. PostgreSQL RLS Role & Ownership Policy (Superseded by `DB_v7.sql`)
- **Amendment Notice**: The original 2-role proposal (`vitrine_migrator` / `vitrine_app`) is superseded by `db/migrations/0001_DB_v7.sql`.
- Under `DB_v7.sql`:
  - The migration role MUST NOT be named `vitrine_*` (bootstrapped as `migrator` via `db/bootstrap/0000_bootstrap_migrator.sql`), is `NOSUPERUSER` with `CREATEROLE`, and owns the target database.
  - `DB_v7.sql` creates ten `vitrine_*` roles (4 login roles: `vitrine_app`, `vitrine_public`, `vitrine_admin`, `vitrine_registration`; 6 `NOLOGIN` roles: `vitrine_viewer`, `vitrine_security_owner`, `vitrine_registration_owner`, `vitrine_auth_owner`, `vitrine_admin_owner`, `vitrine_internal_owner`) across three schemas (`vitrine_core`, `vitrine_internal`, `vitrine_public_api`).
  - `vitrine_app` does not own application tables, has `NOBYPASSRLS` and no `CREATE` privilege on any schema, and all tenant tables enforce both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` with HMAC-signed, expiring, transaction-local tenant context (`app.merchant_id`, `app.merchant_exp`, `app.merchant_id_sig`).

## Consequences
### Positive
- Strong tenant isolation enforced at the database engine layer even if an application query omits a `WHERE merchant_id = ...` filter.
- Clean separation between migration bootstrap (`migrator`), runtime merchant queries (`vitrine_app`), public storefront (`vitrine_public`), registration (`vitrine_registration`), and platform admin (`vitrine_admin`).
- Simple deployment topology with only two units (`web` and `worker`).

### Negative & Trade-offs
- Requires an explicit operator post-migration step (`db/operator/0001_post_migration.sql`) to set login passwords and provision the HMAC tenant-signing secret.
- All schema changes must be executed by the external migration role (`migrator`).

## Compliance & Invariants
- CI Job A verifies `DB_v7.sql` against `db/tests/test_v7.py` without running the operator script and fails unless `"0 failed"` is printed.
- CI Job B runs bootstrap -> migrations -> `db/operator/0001_post_migration.sql` -> `npm test` (`CI=true`, connecting as `vitrine_app`).
- CI fails if `dist/` client assets contain `GEMINI`, `API_KEY`, or non-scalar `.env.example` values.
