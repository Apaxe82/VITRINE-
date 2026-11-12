# Project Status: Vitrine

> Current operational status and progress tracking for Phase 1 capabilities of Vitrine.

## Overview
Vitrine is a WhatsApp-first sales platform for Angolan merchants that turns product photos into AI-drafted listings, requires explicit merchant approval, generates shareable checkout links, processes orders and verified payments (e.g., Multicaixa Express / bank transfers), and tracks fulfilment and reconciliation.

## Phase 1 Capabilities Status

| Capability ID | Capability Description | Status | Notes |
|---|---|---|---|
| CAP-000 | Project Scaffold, Tooling & CI (Node.js, TypeScript, Vitest, CI) | **IN PROGRESS (Task 0 Complete)** | Monolith structure initialized, health check & CI defined |
| CAP-001 | PostgreSQL 16 Database Schema, Bootstrap & Row-Level Security (RLS) | **NOT STARTED** | Baseline migration awaiting `DB_v7.sql` |
| CAP-002 | Media Storage (S3-compatible object storage for photos & receipts) | **NOT STARTED** | S3 adapter & upload pipeline |
| CAP-003 | WhatsApp Webhook Ingestion & Media Pipeline (Cloud API / BSP) | **NOT STARTED** | Inbound photo ingestion from merchant |
| CAP-004 | AI-Assisted Listing Draft Generation (Gemini 2.5/Flash) | **NOT STARTED** | Photo analysis -> structured draft listing; strict human approval gate |
| CAP-005 | Merchant Approval Workflow (DRAFT -> PENDING_CONFIRMATION -> PUBLISHED) | **NOT STARTED** | WhatsApp interactive message confirmation; AI never auto-publishes |
| CAP-006 | Shareable Product Link & Single-Item Buyer Storefront (Web) | **NOT STARTED** | Clean mobile-optimized buyer view with minor unit pricing (AOA) |
| CAP-007 | Buyer Order Creation & Checkout Flow | **NOT STARTED** | Single-item checkout with buyer contact & delivery details |
| CAP-008 | Payment Submission & Verification (Multicaixa Express / Reference) | **NOT STARTED** | Payment proof ingestion or gateway callback verification |
| CAP-009 | Merchant Order Notification & WhatsApp Alerts | **NOT STARTED** | Instant alert to merchant with order & payment confirmation |
| CAP-010 | Order Fulfilment & Delivery State Machine | **NOT STARTED** | Order states: CREATED -> PAID -> DISPATCHED -> DELIVERED / CANCELLED |
| CAP-011 | Merchant Settlement & Daily Reconciliation | **NOT STARTED** | Daily reconciliation summary for merchant |
| CAP-012 | Background Job Queue (Worker + Redis / BullMQ) | **NOT STARTED** | Async job worker for notifications, retries, and media processing |

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
