-- ============================================================================
-- Vitrine - Migration Role Bootstrap (PostgreSQL 16)
-- File: db/bootstrap/0000_bootstrap_migrator.sql
-- ============================================================================
-- Purpose: Provision ONLY the external migration role (e.g. `migrator`)
-- required to run DB_v7.sql and subsequent migrations.
--
-- Role requirements (per DB_v7.sql):
--   * LOGIN, NOSUPERUSER, CREATEROLE
--   * Owns the target database
--   * Name MUST NOT start with `vitrine_`
--   * Password and role name supplied via psql variables, never committed.
--
-- Usage:
--   psql -v ON_ERROR_STOP=1 \
--        -v migrator_role="migrator" \
--        -v migrator_password="$MIGRATOR_PASSWORD" \
--        -d "$TARGET_DB" \
--        -f db/bootstrap/0000_bootstrap_migrator.sql
-- ============================================================================

BEGIN;

SELECT set_config('vitrine.migrator_role', :'migrator_role', true) AS _ \gset
SELECT set_config('vitrine.migrator_password', :'migrator_password', true) AS _ \gset
\unset _

DO $$
DECLARE
    v_role     TEXT := current_setting('vitrine.migrator_role', true);
    v_password TEXT := current_setting('vitrine.migrator_password', true);
BEGIN
    IF v_role IS NULL OR length(btrim(v_role)) = 0 THEN
        RAISE EXCEPTION 'psql variable migrator_role must be non-empty';
    END IF;

    IF v_role LIKE 'vitrine\_%' THEN
        RAISE EXCEPTION 'Migration role "%" must not start with vitrine_', v_role;
    END IF;

    IF v_password IS NULL OR length(btrim(v_password)) = 0 THEN
        RAISE EXCEPTION 'psql variable migrator_password must be non-empty';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = v_role) THEN
        EXECUTE format(
            'CREATE ROLE %I WITH LOGIN NOSUPERUSER CREATEROLE NOCREATEDB PASSWORD %L',
            v_role, v_password
        );
    ELSE
        EXECUTE format(
            'ALTER ROLE %I WITH LOGIN NOSUPERUSER CREATEROLE NOCREATEDB PASSWORD %L',
            v_role, v_password
        );
    END IF;

    EXECUTE format('ALTER DATABASE %I OWNER TO %I', current_database(), v_role);
END
$$;

COMMIT;
