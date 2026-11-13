# Vitrine — Schema Migration Backlog v8

**Baseline:** `DB_v7.sql`  
**Product baseline:** `BUILD_PLAN_v8.md`  
**Purpose:** Ordered database and data-access work required for the product-commerce pilot  
**Rule:** Do not edit an already applied production migration. Add forward migrations with explicit verification and rollback/recovery procedures.

---

## 1. Migration principles

1. Preserve the existing schemas, forced RLS, signed tenant context, explicit role privileges, and non-superuser runtime model from `DB_v7.sql`.
2. Separate one-time cluster/database bootstrap from normal application schema migrations.
3. Use a dedicated database; global role, extension, and `public` schema changes must not affect unrelated applications.
4. Every new tenant-owned row carries `merchant_id` and, where applicable, `store_id`; composite foreign keys preserve the store/merchant relationship.
5. Enable and force RLS before granting runtime access. Test missing, forged, expired, and cross-tenant contexts.
6. Avoid a general runtime worker with broad `BYPASSRLS`. Privileged payment/webhook functions must be narrow, auditable, and unable to accept arbitrary tenant switches from callers.
7. Use constrained text or lookup-backed states rather than hard-to-evolve enums unless a migration ADR decides otherwise.
8. Store AOA amounts exactly. Use `NUMERIC(20,2)` for the AOA pilot or record a money-representation ADR before multi-currency expansion. Never use floating point.
9. Use immutable price/currency snapshots on order items and payments. Current product price is read only when creating checkout.
10. Business events and history are append-only to runtime roles. Corrections create new records or authorized compensating entries.
11. Add `created_at`/`updated_at` where mutable, appropriate indexes, and explicit `ON DELETE` behavior.
12. Each migration includes up/down or forward-recovery notes, application compatibility steps, and automated tests.

---

## 2. Recommended migration sequence

| Order | Migration | Pilot phase | Requirement coverage |
|---|---|---|---|
| 00 | Bootstrap and migration tooling | Phase 1 | Foundation |
| 01 | Chat merchant identity and onboarding | Phase 1 | FR-1 |
| 02 | Product drafts, approval, media, and AI runs | Phase 1 | FR-2, FR-3, FR-12 |
| 03 | Orders, order items, contacts, and history | Phase 2 | FR-5, FR-9 |
| 04 | Inventory reservations and availability | Phase 2 | FR-18, FR-19 |
| 05 | Payment requests, webhook inbox, and outbox | Phase 2 | FR-6, FR-7, FR-9 |
| 06 | Payment application and stock consumption | Phase 2 | FR-7, FR-8, FR-17, FR-18 |
| 07 | Fulfilment, chat commands, and notifications | Phase 2 | FR-8, FR-10, FR-21, FR-22, FR-33 |
| 08 | Operator review and reconciliation | Phase 2/3 | FR-7, FR-29 basic support |
| 09 | Conditional ledger, payout, dispute, and KYC | Before real-money launch only if applicable | FR-27–32 |
| 10+ | Post-pilot search, fees, subscriptions, recovery, bookings | Phase 4 | Deferred requirements |

Migrations 01–08 are the normal direct-settlement pilot path. Migration 09 becomes mandatory if Vitrine collects, holds, or controls merchant proceeds.

---

## 3. Migration 00 — Bootstrap and migration tooling

### Scope

- Preserve `DB_v7.sql` as the initial foundation artifact.
- Introduce a migration ledger and ordered application migration directory.
- Separate role creation, extension installation, tenant-secret provisioning, and database hardening from routine deployments.
- Document backup before migration, lock/timeout policy, deployment role, and recovery steps.
- Provision CI using an ephemeral PostgreSQL 16 instance.

### Required changes

- Migration filenames are immutable once merged/deployed.
- Record checksum, applied timestamp, and application version.
- Remove test dependence on fixed host/port/database names and global `ALTER SYSTEM` changes.
- Add a deployment check that runtime roles are not superusers and do not have unintended role membership.

### Verification

- Clean bootstrap plus all migrations succeeds twice on separate empty databases.
- Application migration role cannot bypass its intended privileges.
- CI tears down the database and leaves no host-global configuration changes.

---

## 4. Migration 01 — Chat merchant identity and onboarding

### New tables

#### `merchant_channel_identities`

Suggested fields:

- `id UUID PRIMARY KEY`
- `merchant_id UUID NOT NULL REFERENCES merchants`
- `channel TEXT NOT NULL` — pilot allows `WHATSAPP`
- `channel_account_id TEXT NOT NULL` — provider/business account scope
- `channel_subject_id TEXT NOT NULL` — stable sender identifier supplied by provider
- `phone_e164 TEXT` — protected PII; nullable if stable subject is sufficient
- `verified_at TIMESTAMPTZ`
- `status TEXT NOT NULL` — `PENDING`, `ACTIVE`, `BLOCKED`
- timestamps

Constraints/indexes:

- Unique `(channel, channel_account_id, channel_subject_id)`.
- Unique active channel identity per merchant only if product rules require one.
- RLS restricts rows to the current merchant; inbound webhook resolution uses a narrow security-definer lookup.

#### `merchant_onboarding_sessions`

Suggested fields:

- merchant/channel identity references
- current step and expiry
- idempotency key derived from channel message ID
- provisional store name and selected options
- completed/abandoned timestamps

Do not treat mutable onboarding session data as an audit trail.

### Existing-table changes

- Permit `merchants.email` and `password_hash` to be null for chat-only merchants after authentication code safely handles null password hashes.
- Keep existing web registration available for optional later account linking.
- Define how a verified chat sender becomes `ACTIVE` without manual admin activation.
- Preserve `SUSPENDED`/`CLOSED` controls and existing administrative audit behavior.

### Privileged functions

- `resolve_verified_chat_sender(...)` returns only the minimum merchant identity needed by the inbound gateway.
- `complete_chat_onboarding(...)` creates merchant identity, store, and subdomain atomically with validated input and idempotency.
- `link_email_to_chat_merchant(...)` is deferred unless needed for pilot account recovery.

### Verification

- Same provider message replay does not create duplicate merchants/stores.
- A sender cannot attach an identity to another merchant.
- Unverified, blocked, suspended, or expired onboarding identities cannot publish or transact.
- Chat-only merchants can create permitted resources; email login cannot authenticate a null password.
- Cross-merchant identity and onboarding reads return no rows.

---

## 5. Migration 02 — Product drafts, approval, media, and AI runs

### Product lifecycle

Add a single authoritative publication state:

```text
DRAFT → PENDING_CONFIRMATION → PUBLISHED → ARCHIVED
```

Implementation options:

- Add `listing_status`, backfill from `is_active`/`archived_at`, update application/RLS/view, then retire the old flags in a later compatibility migration.
- Keep `admin_disabled_at` independent and platform-controlled.

Add approved product fields required by the pilot, including delivery policy and stock threshold where applicable. Do not expose unapproved extraction output publicly.

### New tables

#### `product_media`

- product/store/merchant references
- object-storage key, original/optimized variants
- media type, byte size, dimensions, checksum
- processing status and failure reason
- sort order and timestamps

Constraints:

- Storage keys are unique and cannot be arbitrary external URLs.
- Public access is limited to approved media belonging to visible products.
- Retain `image_urls` temporarily only for compatibility, then remove after cutover.

#### `ai_ingestion_runs`

- merchant/store and optional resulting product reference
- source channel message ID and media reference
- provider/model/prompt/schema versions
- structured proposed output and validation errors
- per-field confidence/provenance where supported
- token/cost usage and timing
- status: received, processed, validation failed, confirmed, rejected
- timestamps

Runtime roles must not read provider secrets or unnecessary raw sensitive prompts.

### Product publication function

`confirm_product_listing(...)` must:

- run in the current merchant tenant context;
- lock/load the draft;
- validate required title, non-negative price, currency, and stock;
- mark approved fields and publication timestamp;
- write domain audit/outbox events;
- publish only when the store and merchant are enabled.

### Public view changes

- Use `listing_status = 'PUBLISHED'` rather than only `is_active`.
- Join approved media through controlled exposure.
- Migration 04 adds available-stock filtering.

### Verification

- AI output alone cannot make a product public.
- Invalid JSON, missing price, or unsupported claims remain unapproved.
- Merchant A cannot approve, read, or attach media to Merchant B's product.
- Deleted/disabled products no longer expose their media publicly.
- Media checksum replay creates no duplicate ingestion run/product.

---

## 6. Migration 03 — Orders, order items, contacts, and history

### New tables

#### `orders`

Suggested fields:

- UUID primary key and human-friendly non-secret order reference
- store/merchant composite reference
- checkout/public access token hash or another unguessable buyer reference
- order state, currency, subtotal, fee/tax/shipping totals as applicable
- payment-request expiry and order expiry
- delivery method and fulfilment due timestamp
- created/updated/confirmed/completed/cancelled timestamps

#### `order_items`

- order/product/store/merchant references
- immutable product title/SKU snapshot
- quantity greater than zero
- immutable unit price and line total
- currency inherited from and consistent with order

The pilot UI creates one item, but the model must not encode a one-product-only restriction.

#### Buyer/contact model

Use a dedicated ADR to choose per-store customer records plus order contact snapshots or order-only contact snapshots. Requirements:

- buyer name, phone, delivery address/instructions as needed;
- protected storage and restricted operator visibility;
- no reliance on a buyer account;
- normalized lookup identifier only where operationally required;
- retention/deletion policy compatible with payment/audit obligations.

#### `order_status_history`

Append-only order state, actor type/id, reason, source event, and timestamp.

### Invariants

- Totals are computed server-side from order items and authorized charges.
- Product/store/merchant/currency must agree.
- Public buyer tokens are unguessable and are not sequential order references.
- Order references are unique within the required scope.
- Product price updates never alter existing order-item snapshots.

### Verification

- Client-submitted price, merchant, store, total, or currency is ignored/rejected.
- Cross-tenant product insertion into an order fails.
- Existing order values remain unchanged after product edits.
- Runtime roles cannot update/delete history rows.

---

## 7. Migration 04 — Inventory reservations and availability

### New table: `inventory_reservations`

Suggested fields:

- UUID primary key
- order/order-item and product references
- store/merchant composite references
- quantity greater than zero
- state: `ACTIVE`, `CONSUMED`, `RELEASED`, `EXPIRED`, `CANCELLED`
- creation, expiry, and resolution timestamps
- unique idempotency key

Indexes:

- Active reservations by product and expiry.
- Unique active reservation per order item if the domain permits only one.
- Expiry sweep index on `(status, expires_at)`.

### Available stock

For stock-tracked pilot products:

```text
available_stock = products.stock_quantity - sum(ACTIVE, unexpired reservations)
```

Availability checks and reservation creation must occur in the same concurrency-safe transaction. Do not rely on a periodically updated denormalized value as the authority.

### Privileged transactional functions

#### `create_checkout_reservation(...)`

- Validate tenant, published product, enabled store, requested quantity, and current availability.
- Lock the product row or use an equivalent proven serialization strategy.
- Create order/item and reservation atomically.
- Return the actual expiry and server-computed totals.

#### `expire_reservation(...)`

- Lock and transition only an active expired reservation.
- Expire/cancel the associated unpaid order according to domain rules.
- Write history/outbox records exactly once.

#### `consume_reservation_on_payment(...)`

- Called only by the authorized payment application path.
- Verify the reservation belongs to the same order/item/payment.
- Lock product and reservation, verify availability, decrement stock, mark consumed, and write audit/outbox records atomically.

### Late-payment rule

If payment arrives after reservation/order expiry, do not consume unrelated new stock automatically. Record the verified payment and open an exception requiring the defined refund/manual-fulfilment policy.

### Public and retrieval visibility

- Public product/store views exclude products with no available stock.
- Buyer retrieval applies the same availability rule and checkout rechecks it transactionally.

### Verification

- Many concurrent requests for one final unit produce at most one active successful reservation.
- Concurrent expiry and payment cannot both consume/release the same reservation incorrectly.
- Replay of consume/expire functions is idempotent.
- Cross-store reservations and negative stock are impossible.
- Zero-available products disappear from purchase and retrieval paths immediately after the transaction commits.

---

## 8. Migration 05 — Payment requests, webhook inbox, and outbox

### New tables

#### `payments`

- order/store/merchant references
- provider name and merchant settlement account reference
- internal UUID and provider reference
- amount and currency
- payment state and state timestamps
- provider request expiry
- provider fee and net amount when known
- raw provider identifiers stored separately from buyer-safe references

Constraints:

- Unique provider reference within provider/account scope.
- One authoritative payment amount/currency per order unless a documented multi-payment model is introduced.
- Amount must match the order snapshot before automatic payment application.

#### `payment_webhook_events`

- provider/event ID and unique deduplication constraint
- raw payload or protected payload reference with retention policy
- payload hash, signature verification result, received timestamp
- processing state, attempt count, processed timestamp, error classification
- matched payment/order only after validated lookup

Authenticating and storing an event does not authorize a state transition.

#### `outbox_events`

- aggregate/tenant/type/key information
- serialized payload and creation timestamp
- available/published timestamps, attempts, and last error
- unique event/deduplication key

Outbox insertion occurs in the same transaction as the business change. Redis is only a delivery mechanism.

#### `inbound_channel_messages`

Use the same durable-inbox principle for WhatsApp events, with unique channel/account/message IDs and payload retention rules.

### Verification

- Duplicate provider/event IDs store no duplicate event.
- Invalid signatures cannot enter normal payment application.
- Event persistence and queue dispatch recover after process failure.
- Webhook response time does not depend on AI or provider callbacks.
- Runtime tenant roles cannot arbitrarily insert a verified provider event.

---

## 9. Migration 06 — Payment application and stock consumption

### Privileged function: `apply_verified_payment_event(...)`

Input must refer to an already stored, signature-verified inbox event. The function must not trust caller-supplied paid status or amount.

Transaction sequence:

1. Lock the inbox event and derive provider reference/details from validated stored data.
2. Resolve and lock the payment, order, and relevant reservation.
3. Validate provider account, merchant/store, reference, amount, currency, and allowed current state.
4. If already applied, return the prior outcome without repeating effects.
5. If late/mismatched/inconsistent, record an exception rather than forcing `PAID`.
6. Mark payment `PAID`, confirm order, consume reservation, decrement stock, and calculate actual fee breakdown.
7. Append payment/order/inventory history and audit records.
8. Insert merchant/buyer notification outbox events.
9. Mark the inbox event applied with correlation information.

### Fee representation

For the pilot, record actual platform fee, provider fee, other deductions, and merchant gross/net estimate separately. Do not add subscription withholding columns/logic until its commercial feature is approved.

### New history

- `payment_status_history` append-only.
- `inventory_movements` or equivalent append-only records for reservation consumption, release/restock, and authorized adjustments.

### Verification

- Duplicate events cause one stock decrement and one set of business effects.
- Out-of-order events do not regress state.
- Wrong amount/currency/reference/account enters review, never `PAID`.
- Late valid payment is recorded but follows the expiry exception policy.
- Database commit guarantees both business history and outbox presence.
- Notification replay does not alter payment or inventory.

---

## 10. Migration 07 — Fulfilment, chat commands, and notifications

### Fulfilment

Either add constrained fulfilment fields to `orders` or use a separate `order_fulfilment` table if multiple shipments are anticipated. For the pilot, a one-to-one fulfilment record is sufficient.

Track:

- state, due time, preparation/shipping/delivery timestamps;
- carrier/tracking fields only when used;
- reminder schedule and last reminder state;
- actor and append-only fulfilment history.

### Chat command audit

Record command message ID, resolved merchant, normalized command, target order, result, and correlation ID. Authorization comes from the verified channel identity, not from user-supplied merchant IDs.

### New table: `notification_deliveries`

- merchant/store and optional order/payment references
- recipient channel identity
- trigger type and template/free-form classification
- template name/version/language where applicable
- provider message ID, status, error, attempts, and timestamps
- unique business deduplication key

The worker selects proactive templates according to approved registry configuration; direct replies may use session messages only when channel rules permit.

### Verification

- Merchant cannot act on another merchant's order by guessing its reference.
- Replayed command message does not repeat side effects.
- Overdue reminders are generated once per intended window and remain retryable.
- Every proactive send records the approved template used.
- Invalid/terminal fulfilment transitions are rejected and audited where useful.

---

## 11. Migration 08 — Operator review and reconciliation

### New tables

#### `reconciliation_cases`

- payment/order/store/merchant references where known
- case type: unknown reference, mismatch, late payment, missing provider event, provider-only transaction, manual review, refund exception
- severity/status, assignee, reason, resolution, and timestamps
- provider evidence references and operator notes with controlled access

#### `provider_reconciliation_imports`

If provider exports are available:

- provider/account, file/report identifier, period, checksum
- import status and timestamps
- normalized external transaction rows in a separate table
- matched internal payment and discrepancy status

#### Domain audit expansion

Retain `admin_audit_log` for platform administration and add domain audit/history for payment, order, inventory, publication, operator, and AI actions. Avoid one unrestricted table containing unnecessary raw PII.

### Operator access

- Internal UI uses authenticated operator identity and least-privilege roles.
- Sensitive actions require reason and audit.
- Manual payment confirmation and refund instruction require an explicit, separately authorized workflow.
- Command-line operations are not the long-term substitute for controlled reconciliation UI.

### Verification

- Every unreconciled real payment appears in an exception queue.
- Operator cannot erase evidence or rewrite provider events.
- Resolution does not silently alter historical records.
- Operator permissions are tested for read-only, reconciliation, and higher-risk actions.

---

## 12. Migration 09 — Conditional ledger, payout, dispute, and KYC

**Build before real-money launch only if Vitrine collects, holds, or controls merchant proceeds.** Prefer direct settlement to avoid this scope in the first pilot.

### Required components

#### Double-entry ledger

- `ledger_accounts`, `ledger_transactions`, and immutable `ledger_entries`.
- Every transaction balances per currency.
- Source order/payment/dispute and idempotency key are unique where required.
- Corrections use compensating entries; no update/delete for runtime roles.

#### Payouts and holds

- Payout amount/state/account destination and release conditions.
- Held/available/paid/frozen transitions with history.
- Delivery confirmation and grace-period release records where applicable.

#### Disputes

- Buyer/operator case, reason, evidence references, state, resolution, and timestamps.
- Atomic internal resolution plus explicit provider/manual money-movement instruction.
- No unverified dispute assertion directly moves money.

#### Merchant verification

- Verification case, submitted identifier evidence, status, reviewer, and decision history.
- Sensitive evidence encrypted/restricted with retention policy.
- Threshold/configuration versioning so historical decisions remain explainable.

### Verification

- Ledger always balances and is immutable to runtime roles.
- Duplicate resolution/payout/refund instructions are idempotent.
- Dispute and grace-period jobs cannot release the same funds twice.
- KYC and dispute records are isolated and access audited.
- Internal resolution and actual external money movement are never represented as the same event unless provider confirmation exists.

---

## 13. Post-pilot migrations — do not build speculatively

| Feature | Trigger and likely data work |
|---|---|
| Semantic retrieval | Representative evaluation set; embedding model/version, product embedding freshness, availability-aware retrieval tests |
| Low-stock/waitlist | Merchant threshold policy, buyer consent/contact, restock notification deduplication |
| Checkout recovery | Consent basis, template category/approval, recovery-link security, send-frequency limits |
| Configurable transaction fees | Versioned merchant fee policy and order-time fee snapshot |
| Subscription withholding | Subscription periods, outstanding balance entries, itemized withholding, payout-floor tests |
| Advanced accounting | Expense records, report snapshots, clear distinction between estimates and statutory records |
| External-channel stock sync | Channel listing mappings, sync cursors, conflict policy, idempotent external events |
| Bookings | Separate service/booking/availability model and concurrency design; do not overload physical stock reservations |
| Multi-currency | Money-representation ADR, minor units/rounding, provider/currency constraints, reporting conversion policy |

---

## 14. Cross-cutting data-access requirements

For every new table and function, define:

1. Owner and runtime roles.
2. SELECT/INSERT/UPDATE/DELETE grants, preferably column-scoped where sensitive.
3. RLS policies and forced-RLS behavior where tenant-owned.
4. Public exposure through explicit views/functions only.
5. Privileged-function authorization, pinned `search_path`, and revoked public execute.
6. Tenant/store composite foreign keys.
7. Idempotency and concurrency behavior.
8. Audit/history and outbox requirements.
9. PII classification and retention.
10. Tests through both direct database access and the actual application caller.

---

## 15. CI test matrix

| Test class | Minimum coverage |
|---|---|
| Clean migration | Empty database bootstraps to current version; checksums and ordering verified |
| Upgrade compatibility | Previous release data migrates without losing public/checkout behavior during cutover |
| RLS | No context, invalid signature, expired context, wrong merchant/store, suspended merchant |
| Privileges | Runtime roles cannot read secrets, alter audit, disable platform controls, or assume owner roles |
| Idempotency | Channel message, product ingestion, payment event, command, notification, payout where applicable |
| Concurrency | Last-unit reservation, payment versus expiry, duplicate payment, booking only in later vertical |
| Money | Exact totals, currency mismatch, rounding policy, refunds/fees, balanced ledger if present |
| Recovery | Crash before/after commit, outbox replay, dead-letter processing, backup restoration |
| Public API | No draft, disabled, out-of-stock, cross-tenant, or unapproved media exposure |
| AI | Schema validation, missing values, merchant approval, provenance, unsupported content |
| Operator | Authentication, least privilege, reason/audit, no evidence deletion |

---

## 16. Implementation slices and definition of done

### Slice A — Publish a product

Includes migrations 00–02 and associated application paths.

Done when a chat-only merchant can onboard, confirm an AI draft, and share a public link, with isolation and replay tests passing.

### Slice B — Reserve and order

Includes migrations 03–04.

Done when checkout creates an immutable order and expiring reservation, concurrent final-unit tests pass, and unavailable products cannot be purchased.

### Slice C — Verify and apply payment

Includes migrations 05–06.

Done when a sandbox/real provider event produces exactly one paid order, one stock consumption, complete history, and retryable notifications; late/mismatched events enter review.

### Slice D — Fulfil and reconcile

Includes migrations 07–08.

Done when merchants manage open orders through chat, proactive templates are recorded, and every payment is reconciled or visibly queued for an operator.

### Slice E — Conditional platform-held funds

Includes migration 09.

Done only after legal/finance approval and ledger/payout/dispute/KYC tests pass. This slice must not be silently omitted if the selected provider model requires it.

---

## 17. ADRs required before implementation

1. **Settlement model:** direct merchant settlement versus platform-held funds.
2. **Chat identity:** stable provider sender ID, phone handling, account recovery, and optional email linking.
3. **Money representation:** AOA numeric precision now and multi-currency evolution.
4. **PII protection:** field encryption, lookup hashes, operator visibility, and retention.
5. **Inventory semantics:** stock-tracked versus non-tracked products and late-payment policy.
6. **Payment authority:** exact privileged function/role boundary and provider-event verification.
7. **Order access:** buyer token design and customer support lookup.
8. **Outbox delivery:** retry, ordering, deduplication, and dead-letter policy.
9. **Manual payment:** who may confirm, evidence requirements, and reporting label.
10. **WhatsApp notifications:** template registry, consent, purpose/category, and expiry reminders.

---

## 18. Final database launch gate

Do not begin real-money pilot transactions until all applicable answers are yes:

- [ ] Clean and upgrade migrations pass in CI on PostgreSQL 16.
- [ ] Every tenant table has forced RLS and cross-tenant tests.
- [ ] Actual web and worker paths run under production-equivalent roles.
- [ ] Duplicate webhooks and messages are harmless.
- [ ] Final-unit concurrency and payment/expiry races pass.
- [ ] No unverified payment path can enter `PAID`.
- [ ] Late and mismatched payments are visible to operators.
- [ ] Every business transition has history and required outbox events.
- [ ] Public views expose only approved, enabled, available products.
- [ ] Backup restoration and queue recovery have been demonstrated.
- [ ] Reconciliation covers every pilot payment.
- [ ] If Vitrine holds funds, balanced immutable ledger, payout, dispute, and verification controls are live and tested.
