# Test Plan: Vitrine

> Purpose: Defines testing strategy, test levels, coverage standards, CI automation gates, and verification protocols for Vitrine.

## 1. Testing Philosophy
- **Real Over Mock**: Critical financial calculations, database connectivity, state machine transitions, and SQL queries must run against real PostgreSQL 16 instances (ephemeral PostgreSQL 16 in CI).
- **Mandatory Tests**: Every change must ship with accompanying tests. Pull requests and commits failing tests are rejected.
- **CI Strictness**: Tests targeting CI PostgreSQL (such as `/health/ready` returning `200` with `database: "connected"`) MUST FAIL—never skip—when `CI=true` and the database is unreachable or unconfigured.
- **Minor Units Verification**: Every pricing and monetary test explicitly validates integer minor units and forbids floating-point arithmetic.

## 2. Test Tiers
1. **Unit Tests (`*.test.ts`)**: Fast in-memory tests for pure business logic:
   - Money manipulation (`createMoney`, integer minor unit enforcement, `AOA` formatting).
   - Product lifecycle state machine guards (verifying AI cannot transition straight to `PUBLISHED`).
   - Signature validators (WhatsApp HMAC, payment webhook HMAC).
2. **Integration Tests (`apps/web`, `apps/worker`)**:
   - Liveness (`/health/live`, `/health`, `/api/health`) without a database, verifying absence of `environment` and `uptime`.
   - Readiness (`/health/ready`) returning `503` with `database: "disconnected"` on unreachable or unset `DATABASE_URL`.
   - Readiness (`/health/ready`) returning `200` with `database: "connected"` against live CI PostgreSQL 16.
   - Database migrations and `FORCE ROW LEVEL SECURITY` tenant isolation tests.
3. **Production Smoke Test**:
   - Full `npm run build` (Vite client + `esbuild` `dist/server.js`), starting with `NODE_ENV=production`, verifying HTTP 200 on `/health/live`, and clean shutdown.

## 3. CI Gates (`.github/workflows/ci.yml`)
Every pull request and push to `main` must pass all of the following gates in order:
1. **Clean Dependency Install**: `npm ci` against committed `package-lock.json`.
2. **Ephemeral PostgreSQL 16 Role Bootstrap**: `psql -v ON_ERROR_STOP=1` with runtime-generated passwords creating `vitrine_migrator` and `vitrine_app`.
3. **Migration Order & Naming Verification**: Confirms `db/migrations/*.sql` follow `^\d{4}_[A-Za-z0-9_]+\.sql$` with strictly increasing unique prefixes.
4. **Versioned Migrations**: Executes every migration as `vitrine_migrator` with `psql -v ON_ERROR_STOP=1`.
5. **TypeScript Check**: `npm run typecheck` (`tsc --noEmit` with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
6. **Client & Server Build**: `npm run build` (`vite build` + `esbuild` bundling `dist/server.js`).
7. **Client Bundle Secret Scan**: Fails if `dist/index.html` or `dist/assets/*` contain `"GEMINI"`, `"API_KEY"`, or non-scalar `.env.example` values.
8. **Test Suites**: `npm test` executed with `CI=true` connecting to PostgreSQL 16 as `vitrine_app`.
9. **Production Smoke Test**: Starts `NODE_ENV=production npm start`, curls `/health/live`, and tears down cleanly.

## 4. Test Execution
- Run tests locally via `npm test` or `npx vitest run`.
- Run typecheck via `npm run typecheck` (or `npm run lint`).
