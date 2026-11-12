# Architecture Specification: Vitrine

> Purpose: Documents system architecture, component decomposition, deployable boundaries, data flows, and infrastructure constraints for Vitrine.

## 1. System Overview & Monolith Structure
Vitrine is structured as a TypeScript modular monolith containing two deployable units:
- **`apps/web`**: Public HTTP server handling:
  - Merchant and Buyer web endpoints (Express + React storefront SPA).
  - Webhook endpoints (WhatsApp Cloud API inbound webhooks, Payment provider webhooks).
  - Internal health check (`/health` and `/api/health`).
- **`apps/worker`**: Dedicated background job process:
  - BullMQ / Redis queues for asynchronous tasks: image processing, AI listing drafting, WhatsApp message dispatches, retryable payment verifications, and reconciliation jobs.
- **`packages/shared`**: Common domain contracts, monetary types, validators, and constants shared across web and worker units.

## 2. Infrastructure Components
- **System of Record**: PostgreSQL 16 with Row-Level Security (RLS) enforcing tenant isolation per merchant.
- **Queue / Broker**: Redis with BullMQ (for retry semantics and background workloads only).
- **Media Object Storage**: S3-compatible object store (e.g., MinIO or AWS S3) for original product photos, compressed variants, and payment receipts.
- **AI Engine**: Google Gemini API for multimodal photo catalog extraction.

## 3. Deployment & Process Topology
- Web and Worker run as distinct processes sharing the same codebase, domain logic, and database schemas.
- No microservices or distributed RPC boundaries between modules.
- In-memory inter-process communication is avoided; all state transitions are committed to PostgreSQL 16.
