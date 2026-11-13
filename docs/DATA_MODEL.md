# Data Model Specification: Vitrine

> Purpose: Defines the relational schema entities, relationships, constraints, money storage standards, and lifecycle state machines for PostgreSQL 16.

## 1. Monetary Storage Standard
- **Exact Money Rule (Amended Project Rule 3)**:
  - **PostgreSQL 16**: Monetary columns use exact fixed-point `NUMERIC` (`NUMERIC(20,2)` for the AOA pilot per `SCHEMA_MIGRATION_BACKLOG_v8` principle 8; `DB_v7` baseline `vitrine_core.products.price` starts as `NUMERIC(12,2)`) paired with an explicit ISO 4217 currency code (`AOA` for Angolan Kwanza). Pending `ADR-002` approval (`OQ-004`).
  - **Application Boundary**: `pg` returns PostgreSQL `NUMERIC` columns as strings. Application code converts between DB `NUMERIC` strings and the in-memory integer-minor-unit `Money` type (`{ amount, currency }`) strictly via exact string/`BigInt` parsing (`parseNumericToMoney`, `moneyToNumericString`, `addMoney`), never via `Number()` or `parseFloat()`.
- Example: DB `NUMERIC(20,2)` `'15000.00'` (`AOA`) parses to `Money { amount: 1500000, currency: 'AOA' }` and formats to `'15.000,00 Kz'`.

## 2. Product Lifecycle State Machine
Strict transition rules enforced via database constraints and domain handlers:
- **`DRAFT`**: Created upon AI processing of an uploaded merchant photo.
- **`PENDING_CONFIRMATION`**: AI draft prepared, interactive WhatsApp approval request dispatched to merchant.
- **`PUBLISHED`**: Merchant explicitly approved price, title, and stock via WhatsApp. Listing is live and shareable.
- **`ARCHIVED`**: Merchant deactivates the listing or item is out of stock.

> **CRITICAL INVARIANT**: AI output must NEVER publish a listing. Only an explicit merchant confirmation can transition a product to `PUBLISHED`.

## 3. Core Entities
- **Merchants (`merchants`)**: Phone/chat identity, business name, default currency (`AOA`), status, RLS tenant identifier (`merchant_id`).
- **Products (`products`)**: `id`, `merchant_id`, `title`, `description`, `price` (`NUMERIC`, AOA pilot target `NUMERIC(20,2)`), `currency`, `status` (`DRAFT`, `PENDING_CONFIRMATION`, `PUBLISHED`, `ARCHIVED`), `stock_quantity`, `media_urls`, `created_at`, `updated_at`.
- **Orders (`orders` & `order_items`)**: `id`, `merchant_id`, `product_id`, `quantity`, `unit_price` (`NUMERIC(20,2)`), `total_price` (`NUMERIC(20,2)`), `currency`, buyer contact/delivery details, independent `order_status`, `fulfilment_status`, and `payout_status`.
- **Payments (`payments`)**: `id`, `order_id`, `amount` (`NUMERIC(20,2)`), `currency`, `method`, `reference`, `proof_media_url`, `status` (`REQUIRES_PAYMENT`, `PENDING`, `PAID`, `MANUAL_REVIEW`, `FAILED`, `EXPIRED`).
- **Reconciliation & Audit**: Append-only state history tables, transactional outbox, and reconciliation records matching provider settlements to internal payments.
