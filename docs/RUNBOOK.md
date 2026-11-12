# Operational Runbook: Vitrine

> Purpose: Standard operating procedures for local development, database migrations, CI execution, production deployment, and incident triage.

## 1. Local Development
1. **Prerequisites**: Node.js 22+, PostgreSQL 16, Redis (optional for local mock jobs).
2. **Environment**: Copy `.env.example` to `.env` and configure local connection strings.
3. **Database Bootstrap**: Run bootstrap role script followed by application migrations.
4. **Start Web Service**: `npm run dev` (starts the development server on port 3000).
5. **Start Worker Service**: `npm run worker:dev`.

## 2. Database Migrations
- Application migrations reside in `db/migrations/`.
- Bootstrap role setup resides in `db/bootstrap/`.
- To apply migrations in order: execute SQL migration files sequentially with psql or migration runner.

## 3. Incident Triage
- **Failed Webhooks**: Check dead-letter queues in Redis BullMQ or application error logs.
- **Unverified Payments**: Review pending payment proofs in manual verification queue.
- **RLS Access Errors**: Check transaction session variables (`app.current_merchant_id`).
