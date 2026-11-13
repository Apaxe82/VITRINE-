# ADR-001: Fixed Modular Monolith Stack, Phase 1 Exclusions, and PostgreSQL RLS Role Model

> Purpose: Records the foundational technology stack pins, explicit Phase 1 scope exclusions, and PostgreSQL 16 Row-Level Security role architecture for Vitrine.

## Status
ACCEPTED

## Context
Vitrine is a WhatsApp-first commerce platform for Angolan merchants handling financial records (orders, verified payments, daily reconciliation) in integer minor units (`AOA`). The architecture must prioritize operational simplicity, strict multi-tenant data isolation, zero floating-point rounding risk, and clear Phase 1 delivery boundaries.

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

### 3. PostgreSQL RLS Role & Ownership Policy
- Database bootstrap (`db/bootstrap/0000_bootstrap_roles.sql`) provisions two distinct login roles:
  1. **`vitrine_migrator`** (`NOSUPERUSER`): Owns schema `public` and all tables/objects created by `db/migrations/`.
  2. **`vitrine_app`** (`LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS`, no `CREATE` privilege on `public`): Used exclusively by `apps/web` and `apps/worker`.
- **Critical RLS Requirement**: In PostgreSQL, table owners bypass Row-Level Security by default. Therefore, `vitrine_app` MUST NOT own application tables, and every tenant-scoped migration MUST apply `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` as defense-in-depth.

## Consequences
### Positive
- Strong tenant isolation enforced at the database engine layer even if an application query omits a `WHERE merchant_id = ...` filter.
- Clear operational separation between schema migrations (`DATABASE_MIGRATOR_URL`) and runtime queries (`DATABASE_URL`).
- Simple deployment topology with only two units (`web` and `worker`).

### Negative & Trade-offs
- Requires passing runtime passwords via environment variables / `psql` variables during bootstrap and CI execution.
- All schema changes must be run via `vitrine_migrator` before `vitrine_app` can read or write new tables.

## Compliance & Invariants
- CI runs bootstrap with `psql -v ON_ERROR_STOP=1` using runtime-generated passwords, runs migrations as `vitrine_migrator`, and runs the test suite as `vitrine_app`.
- CI fails if `dist/` client assets contain `GEMINI`, `API_KEY`, or `.env.example` secrets/config values.
