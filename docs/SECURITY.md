# Security Specification: Vitrine

> Purpose: Establishes security architecture, Row-Level Security (RLS) enforcement, role ownership boundaries, webhook signature verification, secret management, and data protection policies.

## 1. Multi-Tenant Isolation & Row-Level Security (RLS)
- PostgreSQL 16 Row-Level Security is enabled on all merchant-owned tables (`products`, `orders`, `payments`, `daily_settlements`).
- **Role Segregation & Ownership Invariant**:
  - `vitrine_migrator` (`NOSUPERUSER`) owns schema `public` and all schema objects created by versioned migrations.
  - `vitrine_app` (`LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS`, no `CREATE` privilege on `public`) is the sole runtime connection role used by `apps/web` and `apps/worker`.
  - **RLS requires the application role (`vitrine_app`) NOT to own tables**, because PostgreSQL table owners bypass RLS policies by default unless `FORCE ROW LEVEL SECURITY` is enabled.
  - Every tenant-scoped migration MUST enable both `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` and `ALTER TABLE ... FORCE ROW LEVEL SECURITY;` as defense-in-depth.
- Tenant context is set per transaction/session via `SET LOCAL app.current_merchant_id = ...`.
- Database bootstrap (roles, schema ownership, grants) is strictly segregated from application migration scripts (`db/bootstrap/` vs `db/migrations/`).

## 2. Secrets & Configuration
- Zero secrets or passwords committed to any repository file (including `db/bootstrap/`, `ci.yml`, and `.env.example`).
- Bootstrap passwords are supplied exclusively at runtime via `psql` variables from environment values.
- All runtime configuration is loaded from environment variables (`.env.example` as canonical documentation).
- `GEMINI_API_KEY` is strictly server-side only (`apps/web` / `apps/worker`). Vite client config (`vite.config.ts`) must never inject `GEMINI_API_KEY` or server secrets via `define` or `VITE_*` variables; CI scans `dist/` to enforce this.

## 3. Webhook Authentication
- Inbound WhatsApp webhooks verified via HMAC-SHA256 signature (`X-Hub-Signature-256`) against `WHATSAPP_WEBHOOK_APP_SECRET`.
- Inbound payment callbacks verified via HMAC signature against `PAYMENT_WEBHOOK_SECRET`.
- Replay attack mitigation via timestamp validation on incoming payloads.

## 4. Input Validation & Data Sanitization
- Strict schema validation on all public endpoints.
- Phone numbers normalized to standard E.164 format (e.g. +244 for Angola).
- Media uploads restricted to authenticated merchants, with MIME-type and size limits before S3 dispatch.
