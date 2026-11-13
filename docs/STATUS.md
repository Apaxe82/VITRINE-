# Project Status: Vitrine

> Current operational status, Phase 1 capability tracking, and task completion log for Vitrine.

## Overview
Vitrine is a WhatsApp-first sales platform for Angolan merchants that turns product photos into AI-drafted listings, requires explicit merchant approval, generates shareable checkout links, processes orders and verified payments (e.g., Multicaixa Express / bank transfers), and tracks fulfilment and reconciliation.

## Phase 1 Capabilities Status

| Capability ID | Capability Description | Status | Notes |
|---|---|---|---|
| CAP-001 | Merchant Onboarding & Profile Registry | **NOT STARTED** | E.164 phone registry & merchant tenant setup |
| CAP-002 | PostgreSQL 16 Schema, Migrator/App Roles & RLS | **NOT STARTED** | Bootstrap roles defined; baseline `DB_v7.sql` pending |
| CAP-003 | Object Storage Media Pipeline (S3-compatible) | **NOT STARTED** | Photo & payment receipt upload/storage adapter |
| CAP-004 | WhatsApp Webhook Ingestion & Signature Verification | **NOT STARTED** | Inbound photo & interactive reply ingestion |
| CAP-005 | AI-Assisted Listing Draft Generation (Server-Side Gemini) | **NOT STARTED** | Photo -> structured draft listing in `AOA` minor units |
| CAP-006 | Merchant Approval Gate (`DRAFT` -> `PENDING_CONFIRMATION` -> `PUBLISHED`) | **NOT STARTED** | Strict human confirmation; AI never auto-publishes |
| CAP-007 | Shareable Product Link & Single-Item Storefront (Web) | **NOT STARTED** | Mobile buyer page (`/p/:slug`) |
| CAP-008 | Single-Item Buyer Order Creation & Checkout | **NOT STARTED** | Single-item checkout only (no cart) |
| CAP-009 | Payment Submission & Verification | **NOT STARTED** | Multicaixa Express / transfer proof verification |
| CAP-010 | Merchant Order Notification & WhatsApp Alerts | **NOT STARTED** | Instant WhatsApp alert on paid/submitted orders |
| CAP-011 | Order Fulfilment & Delivery State Machine | **NOT STARTED** | Fulfilment tracking & completion |
| CAP-012 | Merchant Daily Reconciliation Summary | **NOT STARTED** | Daily settlement & integer minor-unit totals |
| CAP-013 | Background Job Queue & Retries (Worker + Redis / BullMQ) | **NOT STARTED** | Async jobs for media, AI drafts, and alerts |

## Task Log

| Task | Scope | Status | Summary |
|---|---|---|---|
| **Task 0** | Initial Repository Scaffold | **COMPLETE** | Monolith folder layout (`apps/web`, `apps/worker`, `packages/shared`, `db/`, `docs/`, `.github/workflows/`), docs skeleton, baseline placeholder `0001_DB_v7.sql`, and initial `/health` endpoint. |
| **Task 0.1** | Review Remediation & CI Hardening | **COMPLETE** | Added `pg` driver with `/health/live` and `/health/ready` (`SELECT 1`, 2s timeout, no env/uptime leak), separated `vitrine_migrator` and `vitrine_app` roles with runtime psql password variables, enabled strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`), added `esbuild` production bundle (`dist/server.js`) with dynamic dev-only Vite import, generated `package-lock.json`, and hardened CI gates (secret scan, migration order, `ON_ERROR_STOP=1`, CI DB readiness test, production smoke test). |

## Explicitly Out of Scope (Phase 1)
- Bookings / service catalog
- Recurring subscriptions
- Accounting, profit & loss, and tax reporting
- Abandoned-checkout recovery campaigns
- Vector search / AI customer sales conversational assistant
- Telegram or multi-channel messaging
- Multi-merchant marketplace / discovery portal
- Custom merchant domains
- Multi-item cart (single-item checkout only in Phase 1)
