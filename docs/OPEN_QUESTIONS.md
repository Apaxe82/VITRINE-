# Open Questions & Blockers: Vitrine

> Purpose: Tracks architectural, domain, and external integration ambiguities requiring clarification before implementation.

| ID | Topic | Description | Status | Added In |
|---|---|---|---|---|
| OQ-001 | Baseline Database Migration (`DB_v7.sql`) | The baseline migration file `DB_v7.sql` was not provided in the Task 0 or Task 0.1 prompt. An empty placeholder migration `db/migrations/0001_DB_v7.sql` remains in place, with `vitrine_migrator` and `vitrine_app` bootstrap separated into `db/bootstrap/0000_bootstrap_roles.sql`. Awaiting the user-provided `DB_v7.sql` content before CAP-002 can begin. | **OPEN** | Task 0 (updated Task 0.1) |
| OQ-002 | Payment Gateway & Multicaixa Ingestion Method | Specify the preferred automated ingestion mechanism for Multicaixa Express in Phase 1: Direct integration with EMIS / bank API (e.g. BAI Directo, BFA Net), intermediary aggregator (e.g. AppyPay / ProxyPay / Kwattel), or merchant manual receipt verification with OCR aid. | **OPEN** | Task 0 |
| OQ-003 | WhatsApp Cloud API vs. BSP Partner | Confirm whether Vitrine will use direct Meta WhatsApp Cloud API credentials or an official Business Solution Provider (BSP) such as Twilio, MessageBird, or Gupshup for merchant communication and media webhooks. | **OPEN** | Task 0 |
