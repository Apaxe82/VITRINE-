-- ============================================================================
-- Vitrine - Database Role Bootstrap (PostgreSQL 16)
-- File: db/bootstrap/0000_bootstrap_roles.sql
-- ============================================================================
-- Purpose: Provision vitrine_migrator (schema owner) and vitrine_app
-- (restricted runtime role) isolated from application migrations.
--
-- Usage:
--   psql -v ON_ERROR_STOP=1 \
--        -v migrator_password="$MIGRATOR_PASSWORD" \
--        -v app_password="$APP_PASSWORD" \
--        -f db/bootstrap/0000_bootstrap_roles.sql
--
-- Security invariant:
--   No passwords are stored in this file. Values are passed at runtime via
--   psql variables and bound via transaction-local configuration parameters.
-- ============================================================================

BEGIN;

SELECT set_config('vitrine.migrator_password', :'migrator_password', true);
SELECT set_config('vitrine.app_password', :'app_password', true);

DO $$
DECLARE
    v_migrator_pw text := current_setting('vitrine.migrator_password', true);
    v_app_pw text := current_setting('vitrine.app_password', true);
BEGIN
    IF v_migrator_pw IS NULL OR length(trim(v_migrator_pw)) = 0 THEN
        RAISE EXCEPTION 'psql variable migrator_password must be non-empty';
    END IF;

    IF v_app_pw IS NULL OR length(trim(v_app_pw)) = 0 THEN
        RAISE EXCEPTION 'psql variable app_password must be non-empty';
    END IF;

    -- 1. Migrator role: NOSUPERUSER, owns schema objects, runs versioned migrations
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vitrine_migrator') THEN
        EXECUTE format(
            'CREATE ROLE vitrine_migrator WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
            v_migrator_pw
        );
    ELSE
        EXECUTE format(
            'ALTER ROLE vitrine_migrator WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
            v_migrator_pw
        );
    END IF;

    -- 2. Application runtime role: restricted, NOBYPASSRLS, non-owner, no schema CREATE
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vitrine_app') THEN
        EXECUTE format(
            'CREATE ROLE vitrine_app WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT',
            v_app_pw
        );
    ELSE
        EXECUTE format(
            'ALTER ROLE vitrine_app WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT',
            v_app_pw
        );
    END IF;
END
$$;

-- Ensure public schema is owned by vitrine_migrator and restricted for vitrine_app
CREATE SCHEMA IF NOT EXISTS public;
ALTER SCHEMA public OWNER TO vitrine_migrator;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM vitrine_app;

GRANT USAGE ON SCHEMA public TO vitrine_app;
GRANT ALL ON SCHEMA public TO vitrine_migrator;

-- Grant DML privileges on future objects created by vitrine_migrator to vitrine_app
-- (vitrine_app does NOT own tables, ensuring FORCE ROW LEVEL SECURITY applies)
ALTER DEFAULT PRIVILEGES FOR ROLE vitrine_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vitrine_app;
ALTER DEFAULT PRIVILEGES FOR ROLE vitrine_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO vitrine_app;

COMMIT;
