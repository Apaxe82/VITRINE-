# Open Questions & Blockers: Vitrine

> Purpose: Tracks architectural, domain, and external integration ambiguities requiring clarification before implementation.

| ID | Topic | Description | Status | Added In |
|---|---|---|---|---|
| OQ-001 | Baseline Database Migration (`DB_v7.sql`) | `DB_v7.sql` was provided and installed byte-for-byte as `db/migrations/0001_DB_v7.sql`, with `0000_bootstrap_migrator.sql` and `0001_post_migration.sql` configured around it. | **RESOLVED** | Task 0 (resolved Task 1A) |
| OQ-002 | Payment Gateway & Multicaixa Ingestion Method | Specify the preferred automated ingestion mechanism for Multicaixa Express in Phase 1: Direct integration with EMIS / bank API, intermediary aggregator (e.g. AppyPay / ProxyPay), or clearly labelled manual-payment review before live provider approval (`FR-6`). | **OPEN** | Task 0 |
| OQ-003 | WhatsApp Cloud API vs. BSP Partner | Confirm whether Vitrine will use direct Meta WhatsApp Cloud API credentials or an official Business Solution Provider (BSP) such as Twilio, MessageBird, or Gupshup for merchant communication and media webhooks. | **OPEN** | Task 0 |
| OQ-004 | Money Representation (`NUMERIC(20,2)` & Exact Boundary) | Direction set by `SCHEMA_MIGRATION_BACKLOG_v8` principle 8 (`NUMERIC(20,2)` for AOA pilot); `docs/DECISIONS/ADR-002-money-representation.md` is `PROPOSED`; user approval pending (note `DB_v7.sql` currently defines `products.price` as `NUMERIC(12,2)`). | **OPEN** (ADR-002 PROPOSED; approval pending) | Task 1A (amended) |
| OQ-005 | Merchant Identity (`DB_v7` vs. Chat Identity) | Resolved in design by `SCHEMA_MIGRATION_BACKLOG_v8` Migration 01; an ADR covering chat identity, phone handling, and recovery is required before Migration 01 starts. | **OPEN** (design resolved; ADR required before Migration 01) | Task 1A (amended) |
| OQ-006 | `SCHEMA_MIGRATION_BACKLOG_v8.md` | `SCHEMA_MIGRATION_BACKLOG_v8.md` provided and added byte-for-byte as `docs/SCHEMA_MIGRATION_BACKLOG_v8.md`. | **CLOSED** | Task 1A (closed Task 1A) |
| OQ-007 | `custom_domain` Column in `DB_v7.sql` | `custom_domain` column exists on `vitrine_core.stores` in `DB_v7.sql` but is out of scope for Phase 1 (Project Rule 2); kept unused. | **CLOSED / UNUSED** (out of scope; unused) | Task 1A (amended) |
