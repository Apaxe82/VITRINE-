# Security Specification: Vitrine

> Purpose: Establishes security architecture, Row-Level Security (RLS) enforcement, the DB_v7 ten-role and three-schema model, signed transaction-local tenant context, webhook signature verification, secret management, and data protection policies.

## 1. Multi-Tenant Isolation & Row-Level Security (RLS) (`DB_v7.sql`)
- PostgreSQL 16 Row-Level Security is both enabled (`ENABLE ROW LEVEL SECURITY`) and forced (`FORCE ROW LEVEL SECURITY`) on all tenant-owned tables in `vitrine_core` (`merchants`, `stores`, `products`, and future tenant tables).
- **External Migration Role (Non-`vitrine_*`)**:
  - Provisioned by `db/bootstrap/0000_bootstrap_migrator.sql` (e.g. `migrator`), `LOGIN`, `NOSUPERUSER`, `CREATEROLE`, owns the target database, and MUST NOT be named `vitrine_*`.
  - Runs versioned migrations (`db/migrations/0001_DB_v7.sql`, etc.) and temporarily inherits `*_owner` roles only for the duration of the migration transaction, revoking all membership before commit.
- **The Three Schemas**:
  1. `vitrine_core`: Base tables (`currencies`, `merchants`, `stores`, `reserved_subdomains`, `products`, `admin_audit_log`), triggers, and audited `admin_*` functions.
  2. `vitrine_internal`: Security internals (`pgcrypto` extension, `app_tenant_secret` table, `provision_tenant_secret` / `clear_tenant_secret`, `app_current_merchant_id()`, `register_merchant`, and `auth_*` `SECURITY DEFINER` helpers).
  3. `vitrine_public_api`: Public storefront view (`public_storefront_products`) declared with `security_barrier = true`.
  - The `public` schema is unused by Vitrine; `REVOKE CREATE ON SCHEMA public FROM PUBLIC` is enforced.
- **The Ten `vitrine_*` Roles**:
  - **Four `LOGIN` roles** (`NOSUPERUSER`, `NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION`):
    1. `vitrine_app` — Authenticated merchant runtime operations (`DATABASE_URL`). Never owns tables, cannot read `password_hash`, cannot write `admin_disabled_at`.
    2. `vitrine_public` — Read-only access to `vitrine_public_api.public_storefront_products` (`DATABASE_PUBLIC_URL`). No direct access to `vitrine_core` or `vitrine_internal`.
    3. `vitrine_registration` — Pre-auth onboarding executing only `vitrine_internal.register_merchant` (`DATABASE_REGISTRATION_URL`).
    4. `vitrine_admin` — Read-only on `vitrine_core` tables and `admin_audit_log`; writes only via audited `vitrine_core.admin_*` functions (`DATABASE_ADMIN_URL`).
  - **Six `NOLOGIN` roles** (narrow privilege/ownership isolation, zero active memberships post-migration):
    5. `vitrine_viewer` — Owns `vitrine_public_api.public_storefront_products` and holds narrow public `SELECT` policies.
    6. `vitrine_security_owner` — Owns `vitrine_internal.app_current_merchant_id()` and reads `vitrine_internal.app_tenant_secret`.
    7. `vitrine_registration_owner` — Owns `vitrine_internal.register_merchant(...)` with `PENDING`-only `INSERT` policy on `merchants`.
    8. `vitrine_auth_owner` — Owns `vitrine_internal.auth_*` helpers with narrow column grants on `merchants`.
    9. `vitrine_admin_owner` — Owns `vitrine_core.admin_*` functions and appends to `vitrine_core.admin_audit_log`.
    10. `vitrine_internal_owner` — Owns `vitrine_internal.app_tenant_secret` and secret provisioning/clearing functions.
- **Signed, Expiring, Transaction-Local Tenant Context Protocol**:
  - Every tenant-scoped database query MUST set three settings inside an explicit `BEGIN ... COMMIT` transaction using `set_config(..., true)` (**transaction-local only, never session-level, pooler-safe** for transaction-mode connection poolers):
    - `app.merchant_id`: lowercase merchant UUID
    - `app.merchant_exp`: Unix epoch seconds in the future, at most 3600 seconds (1 hour) ahead
    - `app.merchant_id_sig`: 64-character lowercase hex HMAC-SHA256 of `<uuid>.<exp>` signed with an active key slot (1 or 2) in `vitrine_internal.app_tenant_secret` (`TENANT_CONTEXT_SECRET`)
  - Until a secret is provisioned in `vitrine_internal.app_tenant_secret` or when context is missing, malformed, expired, or forged, `vitrine_internal.app_current_merchant_id()` fails closed by returning `NULL` (0 rows visible).

## 2. Secrets & Configuration
- Zero secrets or passwords committed to any repository file (including `db/bootstrap/`, `db/operator/`, `ci.yml`, and `.env.example`).
- Bootstrap and operator passwords/secrets are supplied exclusively at runtime via `psql` variables sourced from environment values.
- Production PostgreSQL `pg_hba.conf` MUST NEVER use `trust` authentication for `vitrine_*` roles; ephemeral `trust` auth is restricted solely to CI service containers.
- `GEMINI_API_KEY` is strictly server-side only (`apps/web` / `apps/worker`). Vite client config (`vite.config.ts`) must never inject `GEMINI_API_KEY` or server secrets via `define` or `VITE_*` variables; CI scans `dist/` to enforce this.

## 3. Webhook Authentication
- Inbound WhatsApp webhooks verified via HMAC-SHA256 signature (`X-Hub-Signature-256`) against `WHATSAPP_WEBHOOK_APP_SECRET`.
- Inbound payment callbacks verified via HMAC signature against `PAYMENT_WEBHOOK_SECRET`.
- Replay attack mitigation via timestamp validation on incoming payloads.

## 4. Input Validation & Data Sanitization
- Strict schema validation on all public endpoints.
- Phone numbers normalized to standard E.164 format (e.g. +244 for Angola).
- Media uploads restricted to authenticated merchants, with MIME-type and size limits before S3 dispatch.
