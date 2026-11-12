# Security Specification: Vitrine

> Purpose: Establishes security architecture, Row-Level Security (RLS) enforcement, webhook signature verification, secret management, and data protection policies.

## 1. Multi-Tenant Isolation & Row-Level Security (RLS)
- PostgreSQL 16 Row-Level Security is enabled on all merchant-owned tables (`products`, `orders`, `payments`, `daily_settlements`).
- The application connects using a restricted database role (`vitrine_app`) without `BYPASSRLS`.
- Tenant context is set per transaction/session via `SET LOCAL app.current_merchant_id = ...`.
- Database bootstrap (roles, extensions, grants) is strictly segregated from application migration scripts.

## 2. Secrets & Configuration
- Zero secrets committed to the repository.
- All configuration loaded from environment variables (`.env.example` as canonical documentation).
- CI and production environments use ephemeral credentials.

## 3. Webhook Authentication
- Inbound WhatsApp webhooks verified via HMAC-SHA256 signature (`X-Hub-Signature-256`) against `WHATSAPP_WEBHOOK_APP_SECRET`.
- Inbound payment callbacks verified via HMAC signature against `PAYMENT_WEBHOOK_SECRET`.
- Replay attack mitigation via timestamp validation on incoming payloads.

## 4. Input Validation & Data Sanitization
- Strict schema validation on all public endpoints.
- Phone numbers normalized to standard E.164 format (e.g. +244 for Angola).
- Media uploads restricted to authenticated merchants, with MIME-type and size limits before S3 dispatch.
