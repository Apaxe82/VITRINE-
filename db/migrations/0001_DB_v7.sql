-- =====================================================================
-- Vitrine — Foundation Migration v7
-- =====================================================================
-- Scope: multi-tenant foundation (merchants, stores, products).
-- Deferred: compliance, documents, fiscal, orders, payments, ledger,
--           inventory reservations/movements, product_media,
--           e-mail verification flow.
--
-- Tested on PostgreSQL 16. Guard allows 14+ (grant syntax is version
-- aware) but 14/15 are untested.  Requires pgcrypto (trusted extension).
--
-- RUN WITH:  psql -v ON_ERROR_STOP=1 -1 -f DB_v7.sql   (or as-is: it has
--            its own BEGIN/COMMIT).
--
-- MIGRATION ROLE (must NOT be named vitrine_*, must NOT be superuser):
--   * owns the database (or has CREATE on it)  -> can create schemas
--   * CREATEROLE                               -> can create/alter the
--     vitrine_* roles.  If the roles already exist, the migration role
--     needs ADMIN OPTION on each of them instead.
--   The migration grants itself membership in the *_owner roles for the
--   duration of the run and removes it again at the end.
--
-- AFTER THE MIGRATION (operator steps, see section 20):
--   1. Set passwords (or use cert/scram auth) on the four login roles.
--      Make sure pg_hba.conf does not use "trust" for them.
--   2. Provision the tenant-signing secret(s):
--        SELECT vitrine_internal.provision_tenant_secret(1, <32+ bytes>);
--      The application backend holds the same secret and signs the
--      tenant context.  Until a secret exists RLS fails closed.
--
-- TENANT CONTEXT PROTOCOL (per request, inside the transaction):
--   SELECT set_config('app.merchant_id',     '<uuid, lowercase>', true);
--   SELECT set_config('app.merchant_exp',    '<unix seconds>',    true);
--   SELECT set_config('app.merchant_id_sig',
--          encode(hmac('<uuid>.<exp>', secret, 'sha256'), 'hex'), true);
--   * "true" = transaction-local.  ALWAYS use it behind a pooler in
--     transaction mode, otherwise context can leak between requests.
--   * exp must be in the future and at most 1 hour ahead.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Guards
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF current_setting('server_version_num')::int < 140000 THEN
        RAISE EXCEPTION 'Vitrine requires PostgreSQL 14+; found %',
            current_setting('server_version');
    END IF;
    IF current_user LIKE 'vitrine\_%' THEN
        RAISE EXCEPTION
            'Migration role "%" must not be named vitrine_*', current_user;
    END IF;
    IF (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
        RAISE EXCEPTION
            'Run the migration as a non-superuser role (superusers bypass '
            'the privilege model this migration verifies)';
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 1. Schemas  (nothing is created in "public")
-- ---------------------------------------------------------------------
CREATE SCHEMA vitrine_core;        -- tables, admin functions
CREATE SCHEMA vitrine_internal;    -- security internals, pgcrypto
CREATE SCHEMA vitrine_public_api;  -- public storefront view

REVOKE ALL ON SCHEMA vitrine_core, vitrine_internal, vitrine_public_api
    FROM PUBLIC;

-- ---------------------------------------------------------------------
-- 2. Roles
-- ---------------------------------------------------------------------
DO $$
DECLARE
    spec RECORD;
BEGIN
    FOR spec IN
        SELECT * FROM (VALUES
            ('vitrine_app',                TRUE),
            ('vitrine_public',             TRUE),
            ('vitrine_admin',              TRUE),
            ('vitrine_registration',       TRUE),
            ('vitrine_viewer',             FALSE),
            ('vitrine_security_owner',     FALSE),
            ('vitrine_registration_owner', FALSE),
            ('vitrine_auth_owner',         FALSE),
            ('vitrine_admin_owner',        FALSE),
            ('vitrine_internal_owner',     FALSE)
        ) AS t(rolname, canlogin)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = spec.rolname) THEN
            EXECUTE format(
                'CREATE ROLE %I %s NOSUPERUSER NOBYPASSRLS NOCREATEDB '
                'NOCREATEROLE NOINHERIT NOREPLICATION',
                spec.rolname,
                CASE WHEN spec.canlogin THEN 'LOGIN' ELSE 'NOLOGIN' END);
        END IF;
    END LOOP;
END
$$;

-- Attribute validation (only the roles this migration manages).
DO $$
DECLARE
    r RECORD;
    v_expected_login BOOLEAN;
BEGIN
    FOR r IN
        SELECT rolname, rolsuper, rolbypassrls, rolcreaterole,
               rolcreatedb, rolinherit, rolcanlogin, rolreplication
          FROM pg_roles
         WHERE rolname IN
               ('vitrine_app','vitrine_public','vitrine_admin',
                'vitrine_registration','vitrine_viewer',
                'vitrine_security_owner','vitrine_registration_owner',
                'vitrine_auth_owner','vitrine_admin_owner',
                'vitrine_internal_owner')
    LOOP
        IF r.rolsuper OR r.rolbypassrls OR r.rolcreaterole
           OR r.rolcreatedb OR r.rolinherit OR r.rolreplication
        THEN
            RAISE EXCEPTION
                'Role % has unsafe attributes. Fix with: ALTER ROLE % '
                'NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB '
                'NOINHERIT NOREPLICATION;', r.rolname, r.rolname;
        END IF;

        v_expected_login := r.rolname IN
            ('vitrine_app','vitrine_public','vitrine_admin',
             'vitrine_registration');
        IF r.rolcanlogin <> v_expected_login THEN
            RAISE EXCEPTION
                'Role % has rolcanlogin=%; expected %. Fix with ALTER ROLE % %LOGIN;',
                r.rolname, r.rolcanlogin, v_expected_login, r.rolname,
                CASE WHEN v_expected_login THEN '' ELSE 'NO' END;
        END IF;
    END LOOP;
END
$$;

-- Membership rule: nobody except the migration role (and superusers)
-- may be a member of any vitrine_* role, directly or indirectly, and
-- runtime roles must not reach privileged built-in roles.
CREATE FUNCTION pg_temp.assert_membership(p_allow_migrator BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    bad RECORD;
BEGIN
    FOR bad IN
        SELECT c.rolname AS member_name, p.rolname AS role_name
          FROM pg_auth_members m
          JOIN pg_roles c ON c.oid = m.member
          JOIN pg_roles p ON p.oid = m.roleid
         WHERE p.rolname IN
               ('vitrine_app','vitrine_public','vitrine_admin',
                'vitrine_registration','vitrine_viewer',
                'vitrine_security_owner','vitrine_registration_owner',
                'vitrine_auth_owner','vitrine_admin_owner',
                'vitrine_internal_owner')
           AND NOT c.rolsuper
           AND NOT (p_allow_migrator AND c.rolname = session_user)
           -- PG16+: a bare ADMIN OPTION row (no SET, no INHERIT) is what
           -- CREATEROLE leaves behind; it grants no privileges.
           AND (coalesce((to_jsonb(m)->>'set_option')::BOOLEAN, TRUE)
             OR coalesce((to_jsonb(m)->>'inherit_option')::BOOLEAN, TRUE))
    LOOP
        RAISE EXCEPTION 'Forbidden membership: % is a member of %',
            bad.member_name, bad.role_name;
    END LOOP;

    FOR bad IN
        WITH RECURSIVE reach(child_oid, parent_oid, depth) AS (
            SELECT m.member, m.roleid, 1 FROM pg_auth_members m
             UNION
            SELECT r.child_oid, m.roleid, r.depth + 1
              FROM reach r
              JOIN pg_auth_members m ON m.member = r.parent_oid
             WHERE r.depth < 32
        )
        SELECT DISTINCT c.rolname AS child, p.rolname AS parent
          FROM reach
          JOIN pg_roles c ON c.oid = reach.child_oid
          JOIN pg_roles p ON p.oid = reach.parent_oid
         WHERE c.rolname IN
               ('vitrine_app','vitrine_public','vitrine_viewer',
                'vitrine_registration','vitrine_admin')
           AND (p.rolsuper
                OR p.rolname IN ('pg_read_all_data','pg_write_all_data',
                                 'pg_execute_server_program',
                                 'pg_read_server_files',
                                 'pg_write_server_files',
                                 'pg_monitor'))
    LOOP
        RAISE EXCEPTION 'Forbidden membership path: % reaches %',
            bad.child, bad.parent;
    END LOOP;
END
$$;

SELECT pg_temp.assert_membership(TRUE);

-- Temporary self-membership in the owner roles (removed in section 19).
DO $$
DECLARE
    v_owner TEXT;
BEGIN
    FOREACH v_owner IN ARRAY ARRAY[
        'vitrine_security_owner','vitrine_registration_owner',
        'vitrine_auth_owner','vitrine_admin_owner',
        'vitrine_internal_owner','vitrine_viewer']
    LOOP
        IF current_setting('server_version_num')::int >= 160000 THEN
            EXECUTE format('GRANT %I TO %I WITH INHERIT TRUE, SET TRUE',
                           v_owner, session_user);
        ELSE
            EXECUTE format('GRANT %I TO %I', v_owner, session_user);
        END IF;
    END LOOP;
END
$$;

-- Defaults: functions created by these roles never get PUBLIC EXECUTE.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE vitrine_security_owner
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE vitrine_registration_owner
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE vitrine_auth_owner
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE vitrine_admin_owner
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE vitrine_internal_owner
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Schema privileges.
GRANT USAGE ON SCHEMA vitrine_core TO
    vitrine_app, vitrine_viewer, vitrine_admin,
    vitrine_security_owner, vitrine_registration_owner,
    vitrine_auth_owner, vitrine_admin_owner, vitrine_internal_owner;
-- (vitrine_registration / vitrine_public need nothing in vitrine_core.)

GRANT USAGE ON SCHEMA vitrine_internal TO
    vitrine_app, vitrine_registration,
    vitrine_security_owner, vitrine_registration_owner,
    vitrine_auth_owner, vitrine_internal_owner;

GRANT USAGE ON SCHEMA vitrine_public_api TO vitrine_viewer, vitrine_public;

-- Defence in depth: public schema is not used by Vitrine.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ---------------------------------------------------------------------
-- 3. pgcrypto in vitrine_internal
-- ---------------------------------------------------------------------
DO $$
DECLARE
    v_schema NAME;
BEGIN
    SELECT n.nspname INTO v_schema
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'pgcrypto';

    IF v_schema IS NULL THEN
        CREATE EXTENSION pgcrypto SCHEMA vitrine_internal;
    ELSIF v_schema <> 'vitrine_internal' THEN
        RAISE EXCEPTION
            'pgcrypto is installed in schema "%"; expected vitrine_internal. '
            'Move it with: ALTER EXTENSION pgcrypto SET SCHEMA vitrine_internal;',
            v_schema;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'vitrine_internal' AND p.proname = 'hmac'
           AND pg_get_function_identity_arguments(p.oid) = 'bytea, bytea, text'
    ) THEN
        RAISE EXCEPTION 'vitrine_internal.hmac(bytea, bytea, text) not found';
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 4. Shared trigger functions
-- ---------------------------------------------------------------------
CREATE FUNCTION vitrine_core.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Currency reference
-- ---------------------------------------------------------------------
CREATE TABLE vitrine_core.currencies (
    code VARCHAR(3) PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
    name VARCHAR(100) NOT NULL
);

INSERT INTO vitrine_core.currencies (code, name) VALUES
    ('AOA','Angolan Kwanza'),
    ('USD','US Dollar'),
    ('EUR','Euro'),
    ('GBP','British Pound'),
    ('ZAR','South African Rand'),
    ('BRL','Brazilian Real'),
    ('CNY','Chinese Yuan'),
    ('INR','Indian Rupee');

-- ---------------------------------------------------------------------
-- 6. MERCHANTS
-- ---------------------------------------------------------------------
CREATE TABLE vitrine_core.merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Lowercase is enforced by CHECK, so a plain UNIQUE is sufficient.
    email VARCHAR(255) NOT NULL UNIQUE
        CHECK (email = lower(email))
        CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    password_hash VARCHAR(255) NOT NULL
        CHECK (password_hash ~ '^\$(argon2id|argon2i|argon2d|2a|2b|2y|scrypt)\$'),
    full_name VARCHAR(100) NOT NULL
        CHECK (length(btrim(full_name)) >= 1),

    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'FREE'
        CHECK (subscription_tier IN ('FREE','STARTER','PRO','ENTERPRISE')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','CLOSED')),

    email_verified_at TIMESTAMPTZ,
    last_login_at     TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_merchants_status ON vitrine_core.merchants (status);
CREATE TRIGGER trg_merchants_updated_at
    BEFORE UPDATE ON vitrine_core.merchants
    FOR EACH ROW EXECUTE FUNCTION vitrine_core.set_updated_at();

-- ---------------------------------------------------------------------
-- 7. STORES
-- ---------------------------------------------------------------------
CREATE TABLE vitrine_core.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    merchant_id UUID NOT NULL
        REFERENCES vitrine_core.merchants(id) ON DELETE RESTRICT,

    store_name VARCHAR(100) NOT NULL
        CHECK (length(btrim(store_name)) >= 1),
    subdomain  VARCHAR(50) NOT NULL UNIQUE
        CHECK (subdomain ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$'),
    custom_domain VARCHAR(255) UNIQUE
        CHECK (
            custom_domain IS NULL OR custom_domain ~
            '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
        ),
    currency VARCHAR(3) NOT NULL DEFAULT 'AOA'
        REFERENCES vitrine_core.currencies(code)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Africa/Luanda',
    locale   VARCHAR(10) NOT NULL DEFAULT 'pt-AO'
        CHECK (locale ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),

    -- Merchant-controlled lifecycle.
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    closed_at TIMESTAMPTZ,
    -- Platform-controlled switch: only admin_* functions may write it.
    -- A merchant cannot re-enable (or even edit) an admin-disabled row.
    admin_disabled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_stores_id_merchant UNIQUE (id, merchant_id),
    CONSTRAINT ck_stores_closed CHECK ((is_active = TRUE) OR (closed_at IS NOT NULL))
);

CREATE INDEX idx_stores_merchant_id ON vitrine_core.stores (merchant_id);
CREATE TRIGGER trg_stores_updated_at
    BEFORE UPDATE ON vitrine_core.stores
    FOR EACH ROW EXECUTE FUNCTION vitrine_core.set_updated_at();

CREATE TABLE vitrine_core.reserved_subdomains (
    subdomain VARCHAR(50) PRIMARY KEY
        CHECK (subdomain ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$')
);

INSERT INTO vitrine_core.reserved_subdomains (subdomain) VALUES
    ('www'),('api'),('admin'),('app'),('mail'),('smtp'),
    ('support'),('help'),('billing'),('pay'),('payments'),
    ('status'),('docs'),('blog'),('cdn'),('static'),('assets'),
    ('auth'),('login'),('signup'),('account'),('store'),
    ('loja'),('vitrine'),('painel'),('sistema');

CREATE FUNCTION vitrine_core.check_store_settings()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = vitrine_core, pg_catalog, pg_temp AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM vitrine_core.reserved_subdomains
                WHERE subdomain = NEW.subdomain) THEN
        RAISE EXCEPTION 'subdomain "%" is reserved', NEW.subdomain
            USING ERRCODE = 'unique_violation';
    END IF;

    BEGIN
        PERFORM now() AT TIME ZONE NEW.timezone;
    EXCEPTION WHEN invalid_parameter_value THEN
        RAISE EXCEPTION 'unknown timezone "%"', NEW.timezone
            USING ERRCODE = '22023';
    END;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stores_check_settings
    BEFORE INSERT OR UPDATE OF subdomain, timezone ON vitrine_core.stores
    FOR EACH ROW EXECUTE FUNCTION vitrine_core.check_store_settings();

-- ---------------------------------------------------------------------
-- 8. PRODUCTS
-- ---------------------------------------------------------------------
CREATE TABLE vitrine_core.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    store_id    UUID NOT NULL,
    merchant_id UUID NOT NULL,

    title VARCHAR(255) NOT NULL
        CHECK (length(btrim(title)) >= 1),
    description TEXT,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    sku   VARCHAR(100),
    stock_quantity INTEGER NOT NULL DEFAULT 0
        CHECK (stock_quantity >= 0),
    image_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
        CHECK (cardinality(image_urls) <= 20),

    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    archived_at TIMESTAMPTZ,
    admin_disabled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_products_store_merchant
        FOREIGN KEY (store_id, merchant_id)
        REFERENCES vitrine_core.stores (id, merchant_id)
        ON DELETE RESTRICT,
    CONSTRAINT ck_products_archived
        CHECK (is_active = TRUE OR archived_at IS NOT NULL)
);

CREATE INDEX idx_products_store_id    ON vitrine_core.products (store_id);
CREATE INDEX idx_products_merchant_id ON vitrine_core.products (merchant_id);
CREATE INDEX idx_products_store_active_created
    ON vitrine_core.products (store_id, created_at DESC)
    WHERE is_active = TRUE AND admin_disabled_at IS NULL;
CREATE UNIQUE INDEX uq_products_store_sku
    ON vitrine_core.products (store_id, lower(sku))
    WHERE sku IS NOT NULL;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON vitrine_core.products
    FOR EACH ROW EXECUTE FUNCTION vitrine_core.set_updated_at();

-- ---------------------------------------------------------------------
-- 9. Admin audit trail (append-only for every runtime role)
-- ---------------------------------------------------------------------
CREATE TABLE vitrine_core.admin_audit_log (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    db_role     TEXT NOT NULL,           -- session_user (login role)
    actor       TEXT,                    -- optional app.admin_actor (human)
    action      TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id   UUID NOT NULL,
    details     JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_admin_audit_target ON vitrine_core.admin_audit_log (target_id, at DESC);

-- ---------------------------------------------------------------------
-- 10. Base-table privileges (explicit, column-level where it matters)
-- ---------------------------------------------------------------------
REVOKE ALL ON vitrine_core.merchants, vitrine_core.stores,
              vitrine_core.products, vitrine_core.currencies,
              vitrine_core.reserved_subdomains,
              vitrine_core.admin_audit_log
    FROM PUBLIC;

-- merchants: password_hash is NEVER readable by runtime roles directly.
GRANT SELECT (id, email, full_name, subscription_tier, status,
              email_verified_at, last_login_at, created_at, updated_at)
    ON vitrine_core.merchants TO vitrine_app, vitrine_admin;
GRANT UPDATE (full_name) ON vitrine_core.merchants TO vitrine_app;

GRANT SELECT (id, status) ON vitrine_core.merchants TO vitrine_viewer;

GRANT INSERT (id, email, password_hash, full_name, status)
    ON vitrine_core.merchants TO vitrine_registration_owner;

GRANT SELECT (id, email, password_hash, status)
    ON vitrine_core.merchants TO vitrine_auth_owner;
GRANT UPDATE (password_hash, last_login_at)
    ON vitrine_core.merchants TO vitrine_auth_owner;

GRANT SELECT (id, status, subscription_tier)
    ON vitrine_core.merchants TO vitrine_admin_owner;
GRANT UPDATE (status, subscription_tier)
    ON vitrine_core.merchants TO vitrine_admin_owner;

-- stores: admin_disabled_at / is_active-on-insert / closed_at-on-insert
-- are not writable by the merchant role.
GRANT SELECT ON vitrine_core.stores TO vitrine_app, vitrine_admin;
GRANT INSERT (merchant_id, store_name, subdomain, custom_domain,
              currency, timezone, locale)
    ON vitrine_core.stores TO vitrine_app;
GRANT UPDATE (store_name, subdomain, custom_domain, currency,
              timezone, locale, is_active, closed_at)
    ON vitrine_core.stores TO vitrine_app;

GRANT SELECT (id, merchant_id, store_name, subdomain, currency,
              is_active, admin_disabled_at)
    ON vitrine_core.stores TO vitrine_viewer;
GRANT SELECT (id, admin_disabled_at) ON vitrine_core.stores TO vitrine_admin_owner;
GRANT UPDATE (admin_disabled_at)     ON vitrine_core.stores TO vitrine_admin_owner;

-- products
GRANT SELECT ON vitrine_core.products TO vitrine_app, vitrine_admin;
GRANT INSERT (store_id, merchant_id, title, description, price, sku,
              stock_quantity, image_urls, is_active, archived_at)
    ON vitrine_core.products TO vitrine_app;
GRANT UPDATE (title, description, price, sku, stock_quantity,
              image_urls, is_active, archived_at)
    ON vitrine_core.products TO vitrine_app;

GRANT SELECT (id, store_id, title, description, price, image_urls,
              created_at, is_active, admin_disabled_at)
    ON vitrine_core.products TO vitrine_viewer;
GRANT SELECT (id, admin_disabled_at) ON vitrine_core.products TO vitrine_admin_owner;
GRANT UPDATE (admin_disabled_at)     ON vitrine_core.products TO vitrine_admin_owner;

-- reference data
GRANT SELECT ON vitrine_core.currencies          TO vitrine_app, vitrine_admin;
GRANT SELECT ON vitrine_core.reserved_subdomains TO vitrine_app, vitrine_admin;
GRANT INSERT, UPDATE, DELETE ON vitrine_core.reserved_subdomains TO vitrine_admin;

-- audit: admin can read; only admin_owner functions can append.
GRANT SELECT ON vitrine_core.admin_audit_log TO vitrine_admin;
GRANT INSERT ON vitrine_core.admin_audit_log TO vitrine_admin_owner;

-- ---------------------------------------------------------------------
-- 11. Tenant secret (two slots => zero-downtime rotation)
-- ---------------------------------------------------------------------
GRANT CREATE ON SCHEMA vitrine_internal
    TO vitrine_internal_owner, vitrine_security_owner,
       vitrine_registration_owner, vitrine_auth_owner;

SET LOCAL ROLE vitrine_internal_owner;

CREATE TABLE vitrine_internal.app_tenant_secret (
    slot   INT PRIMARY KEY CHECK (slot IN (1, 2)),
    secret BYTEA NOT NULL CHECK (length(secret) >= 32)
);
REVOKE ALL ON vitrine_internal.app_tenant_secret FROM PUBLIC;
GRANT SELECT ON vitrine_internal.app_tenant_secret TO vitrine_security_owner;

CREATE FUNCTION vitrine_internal.provision_tenant_secret(
    p_slot INT, p_secret BYTEA
) RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = vitrine_internal, pg_temp
AS $$
    INSERT INTO vitrine_internal.app_tenant_secret (slot, secret)
    VALUES (p_slot, p_secret)
    ON CONFLICT (slot) DO UPDATE SET secret = EXCLUDED.secret;
$$;

CREATE FUNCTION vitrine_internal.clear_tenant_secret(p_slot INT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = vitrine_internal, pg_temp
AS $$
    DELETE FROM vitrine_internal.app_tenant_secret WHERE slot = p_slot;
$$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 12. Tenant-context helper (signed, expiring)
-- ---------------------------------------------------------------------
SET LOCAL ROLE vitrine_security_owner;

CREATE FUNCTION vitrine_internal.app_current_merchant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = vitrine_internal, pg_temp
AS $$
DECLARE
    v_uuid     TEXT := current_setting('app.merchant_id', TRUE);
    v_exp      TEXT := current_setting('app.merchant_exp', TRUE);
    v_sig      TEXT := current_setting('app.merchant_id_sig', TRUE);
    v_uuid_val UUID;
    v_exp_val  BIGINT;
    v_now      BIGINT;
    v_msg      BYTEA;
    v_actual   BYTEA;
    v_key      BYTEA;
BEGIN
    IF coalesce(v_uuid, '') = '' OR coalesce(v_exp, '') = ''
       OR coalesce(v_sig, '') = '' THEN
        RETURN NULL;
    END IF;
    IF v_sig !~ '^[0-9a-f]{64}$' OR v_exp !~ '^[0-9]{1,12}$' THEN
        RETURN NULL;
    END IF;

    BEGIN
        v_uuid_val := v_uuid::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN NULL;
    END;

    v_exp_val := v_exp::BIGINT;
    v_now     := extract(epoch FROM now())::BIGINT;
    IF v_exp_val <= v_now OR v_exp_val - v_now > 3600 THEN
        RETURN NULL;
    END IF;

    v_msg    := convert_to(v_uuid_val::TEXT || '.' || v_exp_val::TEXT, 'UTF8');
    v_actual := decode(v_sig, 'hex');

    FOR v_key IN SELECT secret FROM vitrine_internal.app_tenant_secret
                  ORDER BY slot
    LOOP
        IF vitrine_internal.hmac(v_msg, v_key, 'sha256') = v_actual THEN
            RETURN v_uuid_val;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 13. Merchant registration  (no RETURNING: avoids SELECT requirement)
-- ---------------------------------------------------------------------
SET LOCAL ROLE vitrine_registration_owner;

-- Returns the new merchant id, or NULL when the e-mail is already
-- registered (so callers can answer generically and not leak existence).
CREATE FUNCTION vitrine_internal.register_merchant(
    p_email         TEXT,
    p_password_hash TEXT,
    p_full_name     TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vitrine_internal, pg_temp
AS $$
DECLARE
    v_id UUID := gen_random_uuid();
    v_rows INT;
BEGIN
    IF p_email IS NULL
       OR p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
        RAISE EXCEPTION 'invalid email' USING ERRCODE = '22023';
    END IF;
    IF p_full_name IS NULL OR length(btrim(p_full_name)) = 0 THEN
        RAISE EXCEPTION 'full_name is required' USING ERRCODE = '22023';
    END IF;
    IF p_password_hash IS NULL
       OR p_password_hash !~ '^\$(argon2id|argon2i|argon2d|2a|2b|2y|scrypt)\$' THEN
        RAISE EXCEPTION 'password_hash format not recognized'
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO vitrine_core.merchants (id, email, password_hash, full_name, status)
    VALUES (v_id, lower(p_email), p_password_hash, btrim(p_full_name), 'PENDING')
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RETURN NULL;
    END IF;
    RETURN v_id;
END;
$$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 14. Authentication functions
-- ---------------------------------------------------------------------
SET LOCAL ROLE vitrine_auth_owner;

-- Pre-login lookup (no tenant context exists yet).
CREATE FUNCTION vitrine_internal.auth_lookup_merchant(p_email TEXT)
RETURNS TABLE (o_id UUID, o_password_hash TEXT, o_status TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = vitrine_internal, pg_temp
AS $$
    SELECT m.id, m.password_hash::TEXT, m.status::TEXT
      FROM vitrine_core.merchants m
     WHERE m.email = lower(p_email);
$$;

-- Post-login bookkeeping for the *current signed tenant*.
CREATE FUNCTION vitrine_internal.auth_record_login()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = vitrine_internal, pg_temp
AS $$
DECLARE
    v_id UUID := vitrine_internal.app_current_merchant_id();
BEGIN
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'no valid tenant context' USING ERRCODE = '42501';
    END IF;
    UPDATE vitrine_core.merchants SET last_login_at = CURRENT_TIMESTAMP
     WHERE id = v_id AND status = 'ACTIVE';
END;
$$;

CREATE FUNCTION vitrine_internal.auth_change_password(p_new_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = vitrine_internal, pg_temp
AS $$
DECLARE
    v_id UUID := vitrine_internal.app_current_merchant_id();
BEGIN
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'no valid tenant context' USING ERRCODE = '42501';
    END IF;
    IF p_new_hash IS NULL
       OR p_new_hash !~ '^\$(argon2id|argon2i|argon2d|2a|2b|2y|scrypt)\$' THEN
        RAISE EXCEPTION 'password_hash format not recognized'
            USING ERRCODE = '22023';
    END IF;
    UPDATE vitrine_core.merchants SET password_hash = p_new_hash
     WHERE id = v_id AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'merchant not active' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- 15. Admin functions (all audited, all NULL-safe)
-- ---------------------------------------------------------------------
GRANT CREATE ON SCHEMA vitrine_core TO vitrine_admin_owner;
SET LOCAL ROLE vitrine_admin_owner;

CREATE FUNCTION vitrine_core.admin_set_merchant_status(
    p_merchant_id UUID, p_status TEXT, p_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = vitrine_core, pg_temp AS $$
DECLARE
    v_old TEXT;
BEGIN
    IF p_merchant_id IS NULL OR p_status IS NULL THEN
        RAISE EXCEPTION 'merchant id and status are required'
            USING ERRCODE = '22004';
    END IF;
    IF p_status NOT IN ('PENDING','ACTIVE','SUSPENDED','CLOSED') THEN
        RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;

    SELECT status INTO v_old FROM vitrine_core.merchants
     WHERE id = p_merchant_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'merchant not found' USING ERRCODE = 'P0002';
    END IF;

    IF NOT (   (v_old = 'PENDING'   AND p_status IN ('ACTIVE','CLOSED'))
            OR (v_old = 'ACTIVE'    AND p_status IN ('SUSPENDED','CLOSED'))
            OR (v_old = 'SUSPENDED' AND p_status IN ('ACTIVE','CLOSED')))
    THEN
        RAISE EXCEPTION 'transition % -> % not allowed', v_old, p_status
            USING ERRCODE = '22023';
    END IF;

    UPDATE vitrine_core.merchants SET status = p_status
     WHERE id = p_merchant_id;

    INSERT INTO vitrine_core.admin_audit_log
        (db_role, actor, action, target_type, target_id, details)
    VALUES (session_user, current_setting('app.admin_actor', TRUE),
            'set_merchant_status', 'merchant', p_merchant_id,
            jsonb_build_object('from', v_old, 'to', p_status,
                               'reason', p_reason));
END;
$$;

CREATE FUNCTION vitrine_core.admin_set_subscription(
    p_merchant_id UUID, p_tier TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = vitrine_core, pg_temp AS $$
DECLARE
    v_old TEXT;
BEGIN
    IF p_merchant_id IS NULL OR p_tier IS NULL THEN
        RAISE EXCEPTION 'merchant id and tier are required'
            USING ERRCODE = '22004';
    END IF;
    IF p_tier NOT IN ('FREE','STARTER','PRO','ENTERPRISE') THEN
        RAISE EXCEPTION 'invalid tier' USING ERRCODE = '22023';
    END IF;

    SELECT subscription_tier INTO v_old FROM vitrine_core.merchants
     WHERE id = p_merchant_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'merchant not found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE vitrine_core.merchants SET subscription_tier = p_tier
     WHERE id = p_merchant_id;

    INSERT INTO vitrine_core.admin_audit_log
        (db_role, actor, action, target_type, target_id, details)
    VALUES (session_user, current_setting('app.admin_actor', TRUE),
            'set_subscription', 'merchant', p_merchant_id,
            jsonb_build_object('from', v_old, 'to', p_tier));
END;
$$;

-- Platform-level disable/enable of a store. Independent from the
-- merchant's own is_active flag, so a merchant cannot undo it.
CREATE FUNCTION vitrine_core.admin_set_store_disabled(
    p_store_id UUID, p_disabled BOOLEAN, p_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = vitrine_core, pg_temp AS $$
BEGIN
    IF p_store_id IS NULL OR p_disabled IS NULL THEN
        RAISE EXCEPTION 'store id and flag are required'
            USING ERRCODE = '22004';
    END IF;

    UPDATE vitrine_core.stores
       SET admin_disabled_at =
           CASE WHEN p_disabled THEN COALESCE(admin_disabled_at, CURRENT_TIMESTAMP)
                ELSE NULL END
     WHERE id = p_store_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'store not found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO vitrine_core.admin_audit_log
        (db_role, actor, action, target_type, target_id, details)
    VALUES (session_user, current_setting('app.admin_actor', TRUE),
            'set_store_disabled', 'store', p_store_id,
            jsonb_build_object('disabled', p_disabled, 'reason', p_reason));
END;
$$;

CREATE FUNCTION vitrine_core.admin_set_product_disabled(
    p_product_id UUID, p_disabled BOOLEAN, p_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = vitrine_core, pg_temp AS $$
BEGIN
    IF p_product_id IS NULL OR p_disabled IS NULL THEN
        RAISE EXCEPTION 'product id and flag are required'
            USING ERRCODE = '22004';
    END IF;

    UPDATE vitrine_core.products
       SET admin_disabled_at =
           CASE WHEN p_disabled THEN COALESCE(admin_disabled_at, CURRENT_TIMESTAMP)
                ELSE NULL END
     WHERE id = p_product_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'product not found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO vitrine_core.admin_audit_log
        (db_role, actor, action, target_type, target_id, details)
    VALUES (session_user, current_setting('app.admin_actor', TRUE),
            'set_product_disabled', 'product', p_product_id,
            jsonb_build_object('disabled', p_disabled, 'reason', p_reason));
END;
$$;

RESET ROLE;

REVOKE CREATE ON SCHEMA vitrine_internal
    FROM vitrine_internal_owner, vitrine_security_owner,
         vitrine_registration_owner, vitrine_auth_owner;
REVOKE CREATE ON SCHEMA vitrine_core FROM vitrine_admin_owner;

-- ---------------------------------------------------------------------
-- 16. Function privileges (explicit allow-list)
-- ---------------------------------------------------------------------
-- Sweep: no function in our schemas keeps PUBLIC EXECUTE
-- (extension-owned pgcrypto functions are left to the extension).
DO $$
DECLARE
    f RECORD;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS sig
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname IN ('vitrine_core','vitrine_internal','vitrine_public_api')
           AND NOT EXISTS (SELECT 1 FROM pg_depend d
                            WHERE d.classid = 'pg_proc'::regclass
                              AND d.objid = p.oid AND d.deptype = 'e')
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    END LOOP;
END
$$;

GRANT EXECUTE ON FUNCTION vitrine_internal.app_current_merchant_id()
    TO vitrine_app, vitrine_auth_owner;
-- RLS policies of vitrine_app call it; admin/viewer policies do not.

GRANT EXECUTE ON FUNCTION vitrine_internal.register_merchant(TEXT, TEXT, TEXT)
    TO vitrine_registration;

GRANT EXECUTE ON FUNCTION vitrine_internal.auth_lookup_merchant(TEXT),
                          vitrine_internal.auth_record_login(),
                          vitrine_internal.auth_change_password(TEXT)
    TO vitrine_app;

GRANT EXECUTE ON FUNCTION
    vitrine_core.admin_set_merchant_status(UUID, TEXT, TEXT),
    vitrine_core.admin_set_subscription(UUID, TEXT),
    vitrine_core.admin_set_store_disabled(UUID, BOOLEAN, TEXT),
    vitrine_core.admin_set_product_disabled(UUID, BOOLEAN, TEXT)
    TO vitrine_admin;

-- Provisioning is for the migration role only (it can write the secret
-- but never read it back).
DO $$
BEGIN
    EXECUTE format(
        'GRANT EXECUTE ON FUNCTION '
        'vitrine_internal.provision_tenant_secret(INT, BYTEA), '
        'vitrine_internal.clear_tenant_secret(INT) TO %I', session_user);
    EXECUTE format('GRANT USAGE ON SCHEMA vitrine_internal TO %I', session_user);
END
$$;

-- ---------------------------------------------------------------------
-- 17. Row-Level Security
-- ---------------------------------------------------------------------
ALTER TABLE vitrine_core.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitrine_core.stores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitrine_core.products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitrine_core.merchants FORCE ROW LEVEL SECURITY;
ALTER TABLE vitrine_core.stores    FORCE ROW LEVEL SECURITY;
ALTER TABLE vitrine_core.products  FORCE ROW LEVEL SECURITY;

-- Table owner (= migration role) keeps access despite FORCE, so future
-- data migrations still work.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['merchants','stores','products'] LOOP
        EXECUTE format(
            'CREATE POLICY %I ON vitrine_core.%I FOR ALL TO %I '
            'USING (TRUE) WITH CHECK (TRUE)',
            t || '_migrator_all', t, current_user);
    END LOOP;
END
$$;

-- NOTE: "(SELECT f())" makes Postgres evaluate the signature check once
-- per statement (InitPlan) instead of once per row.

-- ---- vitrine_app: merchants
CREATE POLICY merchants_select_own ON vitrine_core.merchants
    FOR SELECT TO vitrine_app
    USING (id = (SELECT vitrine_internal.app_current_merchant_id()));
CREATE POLICY merchants_update_own ON vitrine_core.merchants
    FOR UPDATE TO vitrine_app
    USING      (id = (SELECT vitrine_internal.app_current_merchant_id()))
    WITH CHECK (id = (SELECT vitrine_internal.app_current_merchant_id()));

-- ---- vitrine_app: stores (writes need an ACTIVE merchant and a row the
--      platform has not disabled)
CREATE POLICY stores_select_own ON vitrine_core.stores
    FOR SELECT TO vitrine_app
    USING (merchant_id = (SELECT vitrine_internal.app_current_merchant_id()));
CREATE POLICY stores_insert_own ON vitrine_core.stores
    FOR INSERT TO vitrine_app
    WITH CHECK (
        merchant_id = (SELECT vitrine_internal.app_current_merchant_id())
        AND EXISTS (SELECT 1 FROM vitrine_core.merchants m
                     WHERE m.id = merchant_id AND m.status = 'ACTIVE'));
CREATE POLICY stores_update_own ON vitrine_core.stores
    FOR UPDATE TO vitrine_app
    USING (merchant_id = (SELECT vitrine_internal.app_current_merchant_id())
           AND admin_disabled_at IS NULL)
    WITH CHECK (
        merchant_id = (SELECT vitrine_internal.app_current_merchant_id())
        AND admin_disabled_at IS NULL
        AND EXISTS (SELECT 1 FROM vitrine_core.merchants m
                     WHERE m.id = merchant_id AND m.status = 'ACTIVE'));

-- ---- vitrine_app: products
CREATE POLICY products_select_own ON vitrine_core.products
    FOR SELECT TO vitrine_app
    USING (merchant_id = (SELECT vitrine_internal.app_current_merchant_id()));
CREATE POLICY products_insert_own ON vitrine_core.products
    FOR INSERT TO vitrine_app
    WITH CHECK (
        merchant_id = (SELECT vitrine_internal.app_current_merchant_id())
        AND EXISTS (SELECT 1 FROM vitrine_core.merchants m
                     WHERE m.id = merchant_id AND m.status = 'ACTIVE'));
CREATE POLICY products_update_own ON vitrine_core.products
    FOR UPDATE TO vitrine_app
    USING (merchant_id = (SELECT vitrine_internal.app_current_merchant_id())
           AND admin_disabled_at IS NULL)
    WITH CHECK (
        merchant_id = (SELECT vitrine_internal.app_current_merchant_id())
        AND admin_disabled_at IS NULL
        AND EXISTS (SELECT 1 FROM vitrine_core.merchants m
                     WHERE m.id = merchant_id AND m.status = 'ACTIVE'));

-- ---- registration_owner: only PENDING inserts
CREATE POLICY merchants_insert_registration ON vitrine_core.merchants
    FOR INSERT TO vitrine_registration_owner
    WITH CHECK (status = 'PENDING');

-- ---- auth_owner: lookups + two specific updates (column grants limit them)
CREATE POLICY merchants_auth_select ON vitrine_core.merchants
    FOR SELECT TO vitrine_auth_owner USING (TRUE);
CREATE POLICY merchants_auth_update ON vitrine_core.merchants
    FOR UPDATE TO vitrine_auth_owner USING (TRUE) WITH CHECK (TRUE);

-- ---- admin_owner: only what the admin_* functions need
CREATE POLICY merchants_admin_owner_sel ON vitrine_core.merchants
    FOR SELECT TO vitrine_admin_owner USING (TRUE);
CREATE POLICY merchants_admin_owner_upd ON vitrine_core.merchants
    FOR UPDATE TO vitrine_admin_owner USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY stores_admin_owner_sel ON vitrine_core.stores
    FOR SELECT TO vitrine_admin_owner USING (TRUE);
CREATE POLICY stores_admin_owner_upd ON vitrine_core.stores
    FOR UPDATE TO vitrine_admin_owner USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY products_admin_owner_sel ON vitrine_core.products
    FOR SELECT TO vitrine_admin_owner USING (TRUE);
CREATE POLICY products_admin_owner_upd ON vitrine_core.products
    FOR UPDATE TO vitrine_admin_owner USING (TRUE) WITH CHECK (TRUE);

-- ---- vitrine_admin (LOGIN): read-only; writes only via functions
CREATE POLICY merchants_admin_read ON vitrine_core.merchants
    FOR SELECT TO vitrine_admin USING (TRUE);
CREATE POLICY stores_admin_read ON vitrine_core.stores
    FOR SELECT TO vitrine_admin USING (TRUE);
CREATE POLICY products_admin_read ON vitrine_core.products
    FOR SELECT TO vitrine_admin USING (TRUE);

-- ---- vitrine_viewer: narrow read for the public view
CREATE POLICY merchants_public_read ON vitrine_core.merchants
    FOR SELECT TO vitrine_viewer USING (status = 'ACTIVE');
CREATE POLICY stores_public_read ON vitrine_core.stores
    FOR SELECT TO vitrine_viewer
    USING (is_active = TRUE AND admin_disabled_at IS NULL);
CREATE POLICY products_public_read ON vitrine_core.products
    FOR SELECT TO vitrine_viewer
    USING (is_active = TRUE AND admin_disabled_at IS NULL);

-- ---------------------------------------------------------------------
-- 18. Public storefront view (owned by vitrine_viewer, security barrier)
-- ---------------------------------------------------------------------
GRANT CREATE ON SCHEMA vitrine_public_api TO vitrine_viewer;
SET LOCAL ROLE vitrine_viewer;

CREATE VIEW vitrine_public_api.public_storefront_products
    WITH (security_barrier = true) AS
SELECT
    s.id          AS store_id,
    s.store_name,
    s.subdomain,
    s.currency,
    p.id          AS product_id,
    p.title,
    p.description,
    p.price,
    p.image_urls,
    p.created_at
FROM vitrine_core.stores s
JOIN vitrine_core.merchants m ON m.id = s.merchant_id
JOIN vitrine_core.products  p ON p.store_id = s.id
WHERE m.status = 'ACTIVE'
  AND s.is_active = TRUE AND s.admin_disabled_at IS NULL
  AND p.is_active = TRUE AND p.admin_disabled_at IS NULL;

RESET ROLE;
REVOKE CREATE ON SCHEMA vitrine_public_api FROM vitrine_viewer;

REVOKE ALL ON vitrine_public_api.public_storefront_products FROM PUBLIC;
GRANT SELECT ON vitrine_public_api.public_storefront_products TO vitrine_public;

-- ---------------------------------------------------------------------
-- 19. Login-role hardening, then drop temporary memberships
-- ---------------------------------------------------------------------
DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO vitrine_app, '
                   'vitrine_public, vitrine_admin, vitrine_registration',
                   current_database());
    -- Optional, once you are sure no other role relies on PUBLIC CONNECT:
    --   REVOKE CONNECT ON DATABASE <db> FROM PUBLIC;
END
$$;

ALTER ROLE vitrine_app          SET statement_timeout = '15s';
ALTER ROLE vitrine_app          SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE vitrine_public       SET statement_timeout = '5s';
ALTER ROLE vitrine_public       SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE vitrine_registration SET statement_timeout = '5s';
ALTER ROLE vitrine_registration SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE vitrine_admin        SET statement_timeout = '60s';
ALTER ROLE vitrine_admin        SET idle_in_transaction_session_timeout = '60s';

DO $$
DECLARE
    v_owner TEXT;
BEGIN
    FOREACH v_owner IN ARRAY ARRAY[
        'vitrine_security_owner','vitrine_registration_owner',
        'vitrine_auth_owner','vitrine_admin_owner',
        'vitrine_internal_owner','vitrine_viewer']
    LOOP
        EXECUTE format('REVOKE %I FROM %I', v_owner, session_user);
    END LOOP;
END
$$;

-- ---------------------------------------------------------------------
-- 20. Final self-verification (fails the whole migration if violated)
-- ---------------------------------------------------------------------
DO $$
DECLARE
    v_role TEXT;
    v_schema TEXT;
BEGIN
    -- no runtime role can create objects anywhere we care about
    FOREACH v_role IN ARRAY ARRAY['vitrine_app','vitrine_public',
        'vitrine_viewer','vitrine_registration','vitrine_admin',
        'vitrine_security_owner','vitrine_registration_owner',
        'vitrine_auth_owner','vitrine_admin_owner','vitrine_internal_owner']
    LOOP
        FOREACH v_schema IN ARRAY ARRAY['public','vitrine_core',
            'vitrine_internal','vitrine_public_api']
        LOOP
            IF has_schema_privilege(v_role, v_schema, 'CREATE') THEN
                RAISE EXCEPTION '% still has CREATE on schema %', v_role, v_schema;
            END IF;
        END LOOP;
    END LOOP;

    -- RLS on and forced
    IF EXISTS (SELECT 1 FROM pg_class c
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'vitrine_core'
                  AND c.relname IN ('merchants','stores','products')
                  AND NOT (c.relrowsecurity AND c.relforcerowsecurity)) THEN
        RAISE EXCEPTION 'RLS not enabled+forced on a tenant table';
    END IF;

    -- password hash never readable by runtime roles
    FOREACH v_role IN ARRAY ARRAY['vitrine_app','vitrine_public',
        'vitrine_viewer','vitrine_registration','vitrine_admin']
    LOOP
        IF has_column_privilege(v_role, 'vitrine_core.merchants',
                                'password_hash', 'SELECT') THEN
            RAISE EXCEPTION '% can read password_hash', v_role;
        END IF;
    END LOOP;

    -- merchant role cannot write platform-controlled columns
    IF has_column_privilege('vitrine_app','vitrine_core.stores',
                            'admin_disabled_at','UPDATE')
    OR has_column_privilege('vitrine_app','vitrine_core.products',
                            'admin_disabled_at','UPDATE') THEN
        RAISE EXCEPTION 'vitrine_app can write admin_disabled_at';
    END IF;

    -- no PUBLIC EXECUTE on our functions
    IF EXISTS (SELECT 1 FROM pg_proc p
                 JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname IN ('vitrine_core','vitrine_internal','vitrine_public_api')
                  AND NOT EXISTS (SELECT 1 FROM pg_depend d
                                   WHERE d.classid='pg_proc'::regclass
                                     AND d.objid=p.oid AND d.deptype='e')
                  AND has_function_privilege('public', p.oid, 'EXECUTE')) THEN
        RAISE EXCEPTION 'a Vitrine function is executable by PUBLIC';
    END IF;
END
$$;

-- After this migration nobody (not even the migration role) is a member
-- of any vitrine_* role.
SELECT pg_temp.assert_membership(FALSE);

COMMIT;
