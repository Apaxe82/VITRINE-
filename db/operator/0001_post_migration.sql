-- ============================================================================
-- Vitrine - Operator Post-Migration Provisioning (PostgreSQL 16)
-- File: db/operator/0001_post_migration.sql
-- ============================================================================
-- Purpose: Executed after DB_v7.sql by the operator / migration role to:
--   1. Set passwords on the four DB_v7 login roles:
--      vitrine_app, vitrine_public, vitrine_admin, vitrine_registration
--   2. Provision slot 1 of the HMAC tenant-signing secret via:
--      vitrine_internal.provision_tenant_secret(1, <32+ byte secret>)
--
-- Security invariant:
--   No passwords or secrets are committed in this file. All values are passed
--   at runtime via psql variables sourced from environment variables.
--
-- Usage:
--   psql -v ON_ERROR_STOP=1 \
--        -v app_password="$APP_PASSWORD" \
--        -v public_password="$PUBLIC_PASSWORD" \
--        -v admin_password="$ADMIN_PASSWORD" \
--        -v registration_password="$REGISTRATION_PASSWORD" \
--        -v tenant_secret_hex="$TENANT_CONTEXT_SECRET" \
--        -f db/operator/0001_post_migration.sql
-- ============================================================================

BEGIN;

SELECT set_config('vitrine.app_password', :'app_password', true) AS _ \gset
SELECT set_config('vitrine.public_password', :'public_password', true) AS _ \gset
SELECT set_config('vitrine.admin_password', :'admin_password', true) AS _ \gset
SELECT set_config('vitrine.registration_password', :'registration_password', true) AS _ \gset
SELECT set_config('vitrine.tenant_secret_hex', :'tenant_secret_hex', true) AS _ \gset
\unset _

DO $$
DECLARE
    v_app_pw          TEXT := current_setting('vitrine.app_password', true);
    v_public_pw       TEXT := current_setting('vitrine.public_password', true);
    v_admin_pw        TEXT := current_setting('vitrine.admin_password', true);
    v_registration_pw TEXT := current_setting('vitrine.registration_password', true);
    v_secret_hex      TEXT := current_setting('vitrine.tenant_secret_hex', true);
    v_secret_bytes    BYTEA;
BEGIN
    IF v_app_pw IS NULL OR length(btrim(v_app_pw)) = 0
       OR v_public_pw IS NULL OR length(btrim(v_public_pw)) = 0
       OR v_admin_pw IS NULL OR length(btrim(v_admin_pw)) = 0
       OR v_registration_pw IS NULL OR length(btrim(v_registration_pw)) = 0 THEN
        RAISE EXCEPTION 'All four role password psql variables must be non-empty';
    END IF;

    IF v_secret_hex IS NULL OR v_secret_hex !~ '^[0-9a-fA-F]{64,}$' OR (length(v_secret_hex) % 2) <> 0 THEN
        RAISE EXCEPTION 'tenant_secret_hex must be a hex string representing at least 32 bytes (64+ hex characters)';
    END IF;

    EXECUTE format('ALTER ROLE vitrine_app WITH PASSWORD %L', v_app_pw);
    EXECUTE format('ALTER ROLE vitrine_public WITH PASSWORD %L', v_public_pw);
    EXECUTE format('ALTER ROLE vitrine_admin WITH PASSWORD %L', v_admin_pw);
    EXECUTE format('ALTER ROLE vitrine_registration WITH PASSWORD %L', v_registration_pw);

    v_secret_bytes := decode(v_secret_hex, 'hex');
    PERFORM vitrine_internal.provision_tenant_secret(1, v_secret_bytes);
END
$$;

COMMIT;
