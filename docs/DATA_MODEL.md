# Data Model Specification: Vitrine

> Purpose: Defines the relational schema entities, relationships, constraints, money storage standards, and lifecycle state machines for PostgreSQL 16.

## 1. Monetary Storage Standard
- **Zero Floating Point Rule**: All monetary values are strictly stored as 64-bit integer minor units (`BIGINT` or `INTEGER` representing cents/cêntimos) with an explicit ISO 4217 currency code (`AOA` for Angolan Kwanza).
- Example: 15,000.00 Kz is stored as `amount: 1500000`, `currency: 'AOA'`.

## 2. Product Lifecycle State Machine
Strict transition rules enforced via database constraints and domain handlers:
- **`DRAFT`**: Created upon AI processing of an uploaded merchant photo.
- **`PENDING_CONFIRMATION`**: AI draft prepared, interactive WhatsApp approval request dispatched to merchant.
- **`PUBLISHED`**: Merchant explicitly approved price, title, and stock via WhatsApp. Listing is live and shareable.
- **`ARCHIVED`**: Merchant deactivates the listing or item is out of stock.

> **CRITICAL INVARIANT**: AI output must NEVER publish a listing. Only an explicit merchant confirmation can transition a product to `PUBLISHED`.

## 3. Core Entities
- **Merchants (`merchants`)**: Phone number (E.164), business name, default currency (`AOA`), status, RLS tenant identifier (`merchant_id`).
- **Products (`products`)**: `id`, `merchant_id`, `title`, `description`, `price_minor_units`, `currency`, `status` (`DRAFT`, `PENDING_CONFIRMATION`, `PUBLISHED`, `ARCHIVED`), `stock_quantity`, `media_urls` (JSONB / array), `created_at`, `updated_at`.
- **Orders (`orders`)**: `id`, `merchant_id`, `product_id`, `quantity`, `unit_price_minor_units`, `total_price_minor_units`, `currency`, `buyer_name`, `buyer_phone`, `delivery_address`, `status` (`PENDING_PAYMENT`, `PAYMENT_SUBMITTED`, `VERIFIED`, `FULFILLED`, `CANCELLED`).
- **Payments (`payments`)**: `id`, `order_id`, `amount_minor_units`, `currency`, `method` (`MULTICAIXA_EXPRESS`, `BANK_TRANSFER`), `reference`, `proof_media_url`, `status` (`PENDING`, `VERIFIED`, `REJECTED`).
- **Reconciliation (`daily_settlements`)**: Daily summaries for each merchant tracking total orders, total verified revenue (minor units), and payout status.
