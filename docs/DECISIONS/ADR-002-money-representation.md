# ADR-002: Exact Monetary Representation (`NUMERIC(20,2)` & String-Parsed Minor Units)

> Purpose: Formalizes the money representation architecture under amended Project Rule 3 and `SCHEMA_MIGRATION_BACKLOG_v8` principle 8.

## Status
PROPOSED (User approval pending — tracked in `docs/OPEN_QUESTIONS.md` as `OQ-004`)

## Context
- **Amended Project Rule 3** states:
  *"Money is exact. Database columns use NUMERIC (AOA pilot: NUMERIC(20,2), per SCHEMA_MIGRATION_BACKLOG_v8 principle 8). Never floating point. Application code converts DB NUMERIC (returned by pg as a string) to the integer-minor-unit Money type only by exact string parsing, never via Number()/parseFloat. Add tests for the conversion boundary (e.g. '12345678.90' round-trips exactly; '0.10' + '0.20' totals '0.30')."*
- **Preserved Baseline (`DB_v7.sql`)** defines `vitrine_core.products.price` as `NUMERIC(12,2) NOT NULL CHECK (price >= 0)` and exposes `p.price` with `s.currency` in `vitrine_public_api.public_storefront_products`. `DB_v7.sql` must remain byte-for-byte untouched in `db/migrations/0001_DB_v7.sql`.
- Future v8 migrations (`docs/SCHEMA_MIGRATION_BACKLOG_v8.md`) will introduce `orders`, `order_items`, `payments`, and conditional `ledger` tables requiring `NUMERIC(20,2)` precision for AOA pilot scale.

## Proposed Decision
1. **Database Storage**: Use PostgreSQL `NUMERIC(20,2)` (plus explicit ISO 4217 `currency` code) for all v8 monetary columns per `docs/SCHEMA_MIGRATION_BACKLOG_v8.md` principle 8, and widen `vitrine_core.products.price` from `NUMERIC(12,2)` to `NUMERIC(20,2)` in a forward versioned migration (leaving `0001_DB_v7.sql` untouched).
2. **Application Conversion Boundary**: Because `node-postgres` (`pg`) returns `NUMERIC` columns as decimal strings, `packages/shared` converts between DB `NUMERIC` strings and in-memory integer-minor-unit `Money` (`{ amount: number, currency: string }`) strictly via exact string/BigInt parsing (`parseNumericToMoney`, `moneyToNumericString`, `addMoney`). `Number(decimalString)` and `parseFloat(decimalString)` are strictly forbidden.

## Consequences
### Positive
- Eliminates mismatch between PostgreSQL fixed-point storage and TypeScript integer-minor-unit domain logic while preserving exact arithmetic end-to-end.
- Zero floating-point rounding drift in serialization, database reads/writes, and totals.

### Negative & Trade-offs
- Requires updating `vitrine_core.products.price` (and any dependent views such as `vitrine_public_api.public_storefront_products`) cleanly in a forward migration per `docs/SCHEMA_MIGRATION_BACKLOG_v8.md` once this ADR is approved.
- JavaScript `Money.amount` uses safe integers (`Number.isSafeInteger`), capping single values at `90,071,992,547,409.91` minor-adjusted (well within `NUMERIC(20,2)` range for pilot AOA volumes, with bounds checked explicitly via `BigInt` in `parseNumericToMoney`).

## Compliance & Invariants
- `packages/shared/src/index.ts` enforces safe integer minor units and exact regex/`BigInt` string parsing (`parseNumericToMoney`, `moneyToNumericString`, `addMoney`, `formatMoney`).
- Boundary unit tests in `packages/shared/src/index.test.ts` verify exact round-trips (`'12345678.90'`) and exact decimal totals (`'0.10' + '0.20' === '0.30'`).
