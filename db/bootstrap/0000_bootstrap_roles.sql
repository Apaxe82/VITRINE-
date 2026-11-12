-- ============================================================================
-- Vitrine - Database Role Bootstrap (PostgreSQL 16)
-- File: db/bootstrap/0000_bootstrap_roles.sql
-- ============================================================================
-- Purpose: Provision database roles, grants, and schemas isolated from
-- application migrations. Must not rely on global database settings.
-- ============================================================================

DO $$
BEGIN
    -- Provision the restricted application role if it doesn't already exist
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vitrine_app') THEN
        CREATE ROLE vitrine_app WITH LOGIN PASSWORD 'change_me' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END
$$;

-- Ensure public schema exists and assign standard privileges
CREATE SCHEMA IF NOT EXISTS public;

GRANT USAGE ON SCHEMA public TO vitrine_app;
GRANT CREATE ON SCHEMA public TO vitrine_app;

-- Default privileges for future tables created by the migration runner
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vitrine_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO vitrine_app;
