# Test Plan: Vitrine

> Purpose: Defines testing strategy, test levels, coverage standards, CI automation, and verification protocols for Vitrine.

## 1. Testing Philosophy
- **Real Over Mock**: Critical financial calculations, state machine transitions, and database queries must run against real PostgreSQL instances (e.g., ephemeral PostgreSQL in CI).
- **Mandatory Tests**: Every change must ship with accompanying tests. Pull requests and commits failing tests are rejected.
- **Minor Units Verification**: Every pricing and monetary test explicitly validates minor units and forbids floating point arithmetic.

## 2. Test Tiers
1. **Unit Tests (`*.test.ts`)**: Fast in-memory tests for pure business logic:
   - Money manipulation (addition, subtraction, formatting).
   - Product lifecycle state machine guards (e.g. verifying AI cannot transition straight to `PUBLISHED`).
   - Signature validators (WhatsApp HMAC, payment webhook HMAC).
2. **Integration Tests (`apps/web`, `apps/worker`)**:
   - HTTP endpoint integration tests (e.g. `health.test.ts`, order placement).
   - Database migrations and RLS tenant separation tests.
3. **End-to-End Simulation Tests**:
   - Webhook simulated dispatch -> draft created -> approval simulation -> order placed.

## 3. Test Execution
- Run tests via `npm test` or `npx vitest run`.
- CI pipeline automatically provisions ephemeral PostgreSQL 16, runs migrations, and runs all test suites.
