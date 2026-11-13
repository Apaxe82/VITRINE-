# Vitrine — Invisible Commerce Platform
## BUILD_PLAN v8 — Pilot Execution Baseline

**Status:** Proposed implementation baseline  
**Supersedes:** Product scope and delivery sequencing in `BUILD_PLAN.md` (v7)  
**Preserved baseline:** `DB_v7.sql` remains the database-security foundation  
**Companion document:** `SCHEMA_MIGRATION_BACKLOG_v8.md`

---

## 1. Product objective

Vitrine enables a micro-merchant to sell through channels they already use, without operating a website or learning a dashboard.

The initial product must prove one complete, reliable loop:

```text
Merchant photo + text
  → AI-assisted draft
  → merchant confirmation
  → public product/store link
  → buyer checkout
  → stock reservation
  → verified payment or explicitly labelled manual review
  → fulfilment
  → reconciled outcome and notification
```

The first release is a **product-commerce pilot in Angola**, not a combined marketplace, booking platform, accounting system, and escrow service.

### Pilot success statement

A small group of merchants can repeatedly publish products and complete reconciled sales without developer intervention, while buyers can purchase on low-bandwidth connections and merchants can manage open orders through chat.

---

## 2. Binding product decisions

1. **WhatsApp direct messages are the initial channel.** Do not assume WhatsApp group automation or other channel capabilities until separately verified.
2. **AI creates drafts; merchants publish.** Missing or uncertain values remain null and are requested from the merchant.
3. **The pilot supports physical products.** Appointment services and bookings are a later vertical.
4. **Checkout is single-product initially.** The database still uses orders and order items from the beginning.
5. **Direct settlement to the merchant is preferred.** Provider selection must investigate this before Vitrine adopts a platform-held-funds model.
6. **No simulated payment may become `PAID`.** Manual payment is a separate review workflow, not a substitute for verification.
7. **The application remains a modular monolith.** One repository, one web application, one worker deployment, PostgreSQL, and Redis/BullMQ.
8. **No public merchant dashboard is required for the pilot.** Internal operator tooling is required for reconciliation and support.
9. **Pricing is configurable and subject to pilot validation.** The 3.5% platform fee and subscription withholding are not permanent technical invariants.
10. **Expansion follows measured usage.** Semantic retrieval, subscriptions, abandoned-checkout recovery, and bookings are post-pilot investments.

---

## 3. Priority definitions and release map

| Priority | Meaning |
|---|---|
| **P0** | Required for the controlled product-commerce pilot |
| **P1** | First post-pilot conversion and operations improvements |
| **P2** | Build only after commercial or behavioural validation |
| **P3** | Separate expansion vertical or later market capability |
| **Conditional P0** | Mandatory before real-money launch only if Vitrine collects or holds merchant funds |

### Re-prioritized requirements

| ID | Revised requirement and scope | v8 priority |
|---|---|---|
| FR-1 | Merchant registers through a verified chat identity; store and subdomain are auto-provisioned. Email/password and manual admin activation are not mandatory for chat onboarding. | P0 |
| FR-2 | Merchant adds a product using a photo and optional free text. | P0 |
| FR-3 | AI extracts a structured draft with provenance and field-level uncertainty; merchant confirms before publication. | P0 |
| FR-4 | Buyer receives grounded catalogue answers. P0 uses deterministic search and approved fields; semantic/RAG answering is deferred. | P1; basic lookup P0 |
| FR-5 | Buyer checks out without creating an account. | P0 |
| FR-6 | System creates a real provider payment request. A clearly labelled manual-payment workflow is permitted only before live provider approval. | P0 |
| FR-7 | Signed payment events are persisted, deduplicated, matched by reference/amount/currency, and applied idempotently. | P0 |
| FR-8 | Merchant receives a payment confirmation notification after verified payment. | P0 |
| FR-9 | Order, payment, fulfilment, and payout states are tracked independently with append-only history. | P0 |
| FR-10 | Merchant can view open orders and basic sales totals through chat. | P0 |
| FR-11 | Single-channel inventory correctness is P0 through reservations; automated synchronization across external channels is deferred. | P1 |
| FR-12 | Lightweight public store and product pages exist as shareable link targets. | P0 |
| FR-13 | Direct-to-merchant settlement or merchant payment sub-account capability is evaluated as a provider-selection gate. | P0 decision; implementation provider-dependent |
| FR-14 | Central marketplace directory. | P3 |
| FR-15 | Platform transaction fee is configurable, itemized, and validated against provider costs and merchant willingness to pay. | P2; simple pilot fee reporting P0 |
| FR-16 | Subscription-balance withholding and carry-forward balances. | P2 |
| FR-17 | Paid-order notification itemizes actual platform and provider deductions; subscription withholding is added only if FR-16 launches. | P0 |
| FR-18 | Checkout creates an atomic, expiring stock reservation; payment consumes it and expiry releases it. | P0 |
| FR-19 | Products without available stock are excluded from public purchase and buyer recommendations. | P0 |
| FR-20 | Low-stock merchant alert. | P1 |
| FR-21 | Paid orders carry fulfilment due times and overdue reminders. | P0 |
| FR-22 | Merchant can list, ship, and complete orders using short chat commands. | P0 |
| FR-23 | Buyer receives automatic fulfilment updates beyond the initial payment/confirmation messages. | P1 |
| FR-24 | Out-of-stock waitlist and restock notification. | P2 |
| FR-25 | Merchant financial summary beyond basic sales totals. | P2 |
| FR-26 | Manual expense logging and estimated profit. | P2 |
| FR-27 | Buyer-held delivery confirmation code. | P1; Conditional P0 if required by the settlement/risk model |
| FR-28 | Net payout is held until delivery, dispute resolution, or grace-period release. | Conditional P0 for platform-held funds |
| FR-29 | Buyer dispute freezes held payout and opens an operator case. | Conditional P0 for platform-held funds; basic support case P0 |
| FR-30 | Held payout automatically releases after a defined grace period when no dispute exists. | Conditional P0 for platform-held funds |
| FR-31 | Risk-based merchant verification gates platform-controlled payouts. Provider-mandated verification still applies to direct settlement. | Conditional P0 for platform-held funds |
| FR-32 | Operator dispute resolution updates order, ledger, payout, and audit records atomically. | Conditional P0 for platform-held funds |
| FR-33 | Every proactive WhatsApp notification uses an approved template appropriate to its purpose and consent basis. | P0 |
| FR-34 | Provider-defined bookable services. | P3 |
| FR-35 | Atomic overlap prevention for bookings. | P3 |
| FR-36 | Service completion confirmation code. | P3 |
| FR-37 | Provider no-show assertion and dispute recourse. | P3 |
| FR-38 | Appointment reminders. | P3 |
| FR-39 | Pre-expiry abandoned-checkout reminder, subject to consent and template approval. | P2 |
| FR-40 | Post-expiry checkout recovery, subject to consent and template approval. | P2 |

---

## 4. Pilot user journeys

### 4.1 Merchant onboarding

1. Merchant messages the verified Vitrine WhatsApp number.
2. The inbound webhook is authenticated and deduplicated.
3. Vitrine creates or resumes an onboarding session bound to the sender identity.
4. Merchant supplies store name and confirms the applicable terms and payment setup.
5. Vitrine creates the merchant, channel identity, store, and unique subdomain in one controlled onboarding flow.
6. Merchant receives the store link and instructions for adding the first product.

No email, password, domain purchase, or operator SQL command is required.

### 4.2 Product publication

1. Merchant sends a photo and optional text.
2. The worker downloads media promptly, validates it, and stores it in object storage.
3. AI returns schema-validated structured output; unknown values remain empty.
4. Vitrine sends a concise draft preview containing title, price, stock, description, and delivery information.
5. Merchant corrects missing values and confirms publication.
6. The product becomes publicly visible only if the store is enabled and available stock is greater than zero.

### 4.3 Buyer checkout and payment

1. Buyer opens a product link and submits delivery/contact details.
2. The server reloads the product and creates an immutable order-item price snapshot.
3. A database transaction reserves available stock and creates the order.
4. The payment service creates a provider request bound to the order reference, amount, currency, and expiry.
5. The buyer completes payment using the provider-supported flow.
6. A verified provider event is stored and deduplicated before asynchronous processing.
7. The payment worker validates reference, amount, currency, merchant/store mapping, and current payment state.
8. One atomic transaction marks payment paid, consumes the reservation, decrements stock, writes history/audit/outbox records, and confirms the order.
9. Notifications are sent through retryable jobs.

### 4.4 Manual payment before live integration

- The order and payment remain in `MANUAL_REVIEW`/`PENDING` states.
- A receipt is evidence for an operator, never automatic proof of payment.
- Only an authorized operator can record a manual confirmation, with reason and audit trail.
- The user interface and messages must not imply automatic Multicaixa/EMIS integration.

### 4.5 Fulfilment

1. `pedidos` returns open orders oldest first.
2. The merchant uses a short command to mark an order preparing or shipped.
3. The system records every transition and sends permitted notifications.
4. Overdue orders generate proactive merchant reminders.
5. Completion uses the appropriate delivery workflow for the selected settlement/risk model.

---

## 5. State models

Do not encode all business state in one `orders.status` column.

### Listing state

```text
DRAFT → PENDING_CONFIRMATION → PUBLISHED → ARCHIVED
```

Platform disabling remains independent through `admin_disabled_at`.

### Reservation state

```text
ACTIVE → CONSUMED
ACTIVE → RELEASED | EXPIRED | CANCELLED
```

### Payment state

```text
REQUIRES_PAYMENT → PENDING → PAID
PENDING → FAILED | EXPIRED | MANUAL_REVIEW
PAID → REFUND_PENDING → PARTIALLY_REFUNDED | REFUNDED
```

Only a verified provider event or an explicitly authorized manual-review process can enter `PAID`.

### Order state

```text
AWAITING_PAYMENT → CONFIRMED → COMPLETED
AWAITING_PAYMENT → EXPIRED | CANCELLED
CONFIRMED → CANCELLED (only through an authorized exception workflow)
```

### Fulfilment state

```text
UNFULFILLED → PREPARING → SHIPPED → DELIVERED
```

### Payout state, only where applicable

```text
NOT_REQUIRED | PENDING | HELD | AVAILABLE | PAID | FROZEN
```

All state changes require actor, timestamp, reason where relevant, and append-only history.

---

## 6. Architecture

### 6.1 Deployable components

| Component | Responsibility |
|---|---|
| Web application | Chat webhooks, public storefront, checkout, payment webhooks, operator endpoints |
| Worker | Media ingestion, AI extraction, payment application, reservation expiry, notifications, reminders |
| PostgreSQL | System of record, RLS, transactional inventory, orders, payments, histories, outbox |
| Redis/BullMQ | Background jobs, retries, delayed work; never the sole record of a business event |
| Object storage | Product media and controlled receipt/evidence storage |
| Internal operator UI | Reconciliation, manual review, support, verification, and dispute operations where applicable |

### 6.2 Suggested modules

```text
src/
  gateway/       inbound authentication, webhook inbox, rate limiting
  identity/      merchant chat identity and onboarding
  catalog/       drafts, approval, products, media, public storefront
  checkout/      orders, order items, reservations
  payments/      provider adapter, webhook application, reconciliation
  fulfilment/    order commands, history, reminders
  notifications/ templates, delivery records, retries
  ai/            consolidated provider wrapper, schemas, safety, usage records
  operations/    operator review, audit search, support cases
  db/            migrations, transaction helpers, tenant context
  workers/       job handlers only; domain logic stays in modules
```

### 6.3 Reliability requirements

- Store inbound events before queueing and enforce unique provider/channel event IDs.
- Verify signatures over the raw body and enforce timestamp/replay rules supported by the provider.
- Use a transactional outbox for jobs that must follow a database commit.
- Make every consumer idempotent and safe after retries.
- Maintain a dead-letter/exception workflow with operator visibility.
- Define payment-request and reservation expiry alignment.
- A late payment after reservation expiry enters an explicit exception path; it must not silently oversell stock.
- Reconciliation compares provider records with internal payments and flags discrepancies.

---

## 7. AI and retrieval policy

### Product extraction

- Use a versioned structured schema and reject invalid output.
- Treat image text and merchant text as untrusted input, not instructions.
- Never invent price, stock, benefits, delivery terms, or product suitability.
- Store source message, model/prompt version, output, validation result, token usage, and merchant corrections.
- Require merchant confirmation before public exposure.
- Cache only where source content and prompt/model versions match.

### Buyer assistance

- P0 retrieval uses deterministic catalogue fields and filters.
- Responses may use only approved merchant/store data.
- Health-related content must not diagnose, prescribe, or claim unsupported treatment suitability.
- Semantic retrieval requires a representative Portuguese-language evaluation set, measured baselines, and an explicit launch threshold.
- Out-of-stock and disabled products must be excluded before retrieval and again before checkout.

---

## 8. Security, privacy, and operations

1. Preserve signed, expiring tenant context and forced RLS from `DB_v7.sql`.
2. Do not give a general worker broad `BYPASSRLS` access by default. Use narrowly scoped privileged functions and test their authorization.
3. Apply tenant checks to merchant, store, order, payment, reservation, media, notification, and operator access.
4. Keep database bootstrap/role administration separate from normal application migrations.
5. Protect phone numbers, addresses, receipts, and verification records with least-privilege access, retention rules, and appropriate encryption.
6. Validate media type, size, and storage key; do not rely on expiring chat-provider media URLs.
7. Rate-limit inbound messages and checkout/payment attempts without blocking provider retries.
8. Record administrative and domain audit events; audit access itself where sensitive data is viewed.
9. Maintain offsite backups, defined recovery objectives, monitoring, alerting, and an operator runbook.
10. Complete a restore exercise before real-money pilot launch.
11. Submit proactive WhatsApp templates early and record their approved purpose/category.
12. Obtain legal/compliance review for payment settlement, consumer terms, refunds, data protection, and any marketing follow-up.

---

## 9. Non-functional requirements and budgets

| Area | Pilot requirement |
|---|---|
| Webhook response | Target acknowledgement below 1 second after durable inbox persistence; heavy work asynchronous |
| Checkout | Core flow works with JavaScript disabled and no external CDN dependency |
| Page weight | Critical HTML/CSS response ≤50 KB; images have a separate optimized budget and lazy-loading policy |
| Tenant isolation | Application authorization plus forced RLS, verified through real request/worker paths |
| Idempotency | Duplicate channel/payment events do not duplicate products, orders, payment applications, or stock changes |
| Auditability | Every payment, order, inventory, publication, and operator state change has traceable history |
| Accessibility | Semantic forms, labelled fields, keyboard support, readable contrast, and useful error messages |
| Localization | Portuguese (`pt-AO`) pilot copy with explicit currency and delivery information |
| Observability | Structured logs, correlation IDs, queue/retry metrics, webhook failures, reconciliation discrepancies |
| Recoverability | Automated backups plus demonstrated restoration and repeatable worker recovery |

---

## 10. Delivery plan and gates

Timings are indicative for two experienced engineers and exclude external provider/Meta approval delays.

### Phase 0 — Validation and technical spikes (1–2 weeks)

- Confirm provider sandbox, merchant onboarding, settlement destination, payment request expiry, webhook behavior, refunds, and reconciliation data.
- Decide direct settlement versus platform-held funds and record the ADR.
- Verify WhatsApp sender onboarding and begin template approval.
- Test the onboarding script with 5–10 target merchants.
- Validate fee assumptions against provider charges and operating costs.
- Produce wireframes for onboarding, draft confirmation, checkout, payment pending/failure, and order commands.

**Gate G0:** provider sandbox payment event verified; settlement model and pilot scope approved.

### Phase 1 — Walking skeleton (approximately 2 weeks)

- Application skeleton, CI, configuration, migration runner, and deployment baseline.
- Chat identity/onboarding and store provisioning.
- Product media, AI draft, merchant correction/approval, and public product/store pages.
- Existing database behavioural tests moved into repeatable CI.

**Gate G1:** a new merchant can publish an approved product and share a working link without developer database access.

### Phase 2 — Transaction loop (3–4 weeks)

- Orders/order items, checkout, stock reservations, and expiry.
- Real payment requests and signed webhook processing.
- Payment/order history, outbox, notifications, merchant order commands, and fulfilment reminders.
- Operator reconciliation and late-payment exception handling.
- Conditional ledger/escrow scope only if the selected settlement model requires it.

**Gate G2:** a real end-to-end transaction is paid, fulfilled, and reconciled without manual database changes.

### Phase 3 — Controlled pilot and hardening (approximately 2 weeks)

- Small merchant cohort and bounded transaction volume.
- Security, concurrency, failure recovery, accessibility, and low-bandwidth testing.
- Backup restoration and operational drills.
- Pilot metrics dashboard/reporting and support runbook.

**Gate G3:** launch acceptance criteria in §11 pass with no unresolved critical defects.

### Phase 4 — Evidence-led expansion

Prioritize using observed friction:

1. Grounded buyer assistance and evaluated semantic retrieval.
2. Low-stock and additional buyer status notifications.
3. Consent-compliant checkout recovery.
4. Validated subscription/fee functionality.
5. Waitlists, external-channel inventory sync, and advanced reporting.
6. Bookings as a separately planned vertical.

---

## 11. Pilot acceptance criteria

- [ ] A merchant can onboard, confirm a product, and obtain a live link using chat alone.
- [ ] AI cannot publish a listing without explicit merchant confirmation.
- [ ] Missing AI-extracted prices remain missing and are requested from the merchant.
- [ ] A buyer can submit checkout on a throttled mobile connection with JavaScript disabled.
- [ ] Two concurrent buyers cannot reserve or pay for the same final unit.
- [ ] Reservation expiry releases stock exactly once.
- [ ] A late payment after expiry cannot create an oversell and enters a visible exception workflow.
- [ ] Replaying a payment event does not duplicate payment application, stock decrement, history, or notifications.
- [ ] Amount, currency, reference, or merchant mismatch prevents automatic `PAID` transition.
- [ ] No unverified receipt or client-reported payment can enter `PAID`.
- [ ] Store A data is inaccessible through Store B web, chat, worker, and operator contexts.
- [ ] Payment, order, reservation, and fulfilment histories explain every current state.
- [ ] An overdue paid order creates a merchant reminder using an approved template.
- [ ] A worker restart does not lose committed payment or notification work.
- [ ] A backup restoration and reconciliation exercise completes successfully.
- [ ] Every pilot payment is either reconciled or present in an operator exception queue.

---

## 12. Test strategy

### Database and security

- Run `test_v7.py` behavior against an ephemeral PostgreSQL 16 environment in CI.
- Remove hard-coded environment assumptions and global database side effects.
- Add RLS/privilege tests for every new tenant table and privileged function.
- Test connection-pool transaction isolation and tenant-context cleanup.

### Application integration

- Exercise real HTTP webhook handlers and workers, not only domain functions.
- Verify raw-body signatures, replay handling, durable inbox, outbox, and retries.
- Use provider contract fixtures plus sandbox contract tests.

### Concurrency and money

- Concurrent final-unit reservations and payment confirmations.
- Duplicate, delayed, and out-of-order provider events.
- Payment after expiry, partial/incorrect amount, wrong currency, and unknown reference.
- Worker crash between database commit and job dispatch.
- If a ledger exists: balanced entries, immutability, idempotent payout/refund application.

### AI and UX

- Invalid structured output, prompt injection, unsupported health claims, and missing fields.
- Merchant correction and approval paths.
- Portuguese copy, form errors, keyboard/accessibility checks, and no-JavaScript checkout.

---

## 13. Pilot metrics

Measure from the first pilot cohort:

- Onboarding completion and time to first published product.
- Product publication completion and median time to publish.
- AI correction rate by field, especially price and description.
- Store-link visits, checkout starts, checkout completion, and verified-payment rate.
- Payment reconciliation discrepancy count and time to resolution.
- Notification failure/retry rate and template delivery outcome.
- Overselling incidents; target zero.
- Time from payment to shipment/delivery and overdue-order count.
- Merchant repeat usage and buyer repeat purchase where measurable.
- AI cost, provider cost, support cost, and contribution margin per merchant/order.

Do not set ambitious numerical growth targets until baseline pilot data exists.

---

## 14. Commercial and risk decisions still requiring evidence

| Decision | Owner/action before commitment |
|---|---|
| Direct settlement availability | Provider technical and commercial confirmation |
| Platform-held funds | Legal, finance, safeguarding, payout, dispute, and reconciliation review |
| Refund responsibility and fee treatment | Written provider and commercial policy |
| 3.5% platform fee | Unit economics and merchant pilot validation |
| Subscription withholding | Separate commercial experiment; not in pilot |
| Marketing follow-up consent | Legal and WhatsApp template/category review |
| Health-related catalogue content | Content policy and specialist review where needed |
| Data retention | Privacy/legal policy covering chat, media, payments, and audit records |

---

## 15. Documentation governance

- This file is the product-scope baseline for v8.
- `SCHEMA_MIGRATION_BACKLOG_v8.md` is the database implementation sequence.
- Record settlement, encryption, money representation, tenant authorization, and notification-consent decisions as ADRs.
- Maintain a single implementation-status table: `Not started`, `In progress`, `Implemented`, `Tested`, `Pilot verified`.
- Do not describe provider integrations, templates, or regulatory arrangements as live until externally verified.
- Changes to P0 scope require an explicit trade-off against pilot time, risk, or validation value.
