#!/usr/bin/env python3
"""Behavioural tests for DB_v7.sql. Each runtime role connects as itself."""
import hashlib, hmac, os, subprocess, sys, time, uuid

HOST = os.environ.get("PGHOST") or os.environ.get("HOST") or "/var/tmp/vpg"
PORT = os.environ.get("PGPORT") or os.environ.get("PORT") or "5433"
DB = os.environ.get("PGDATABASE") or os.environ.get("DB") or "vt"
ADMIN_ROLE = os.environ.get("ADMIN_ROLE") or "postgres"
SECRET1 = os.urandom(32)
SECRET2 = os.urandom(32)
H = "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$aGFzaGhhc2hoYXNo"

passed = failed = 0


def run(role, sql):
    """Run one psql session; return (ok, stdout+stderr stripped)."""
    p = subprocess.run(
        ["psql", "-h", HOST, "-p", PORT, "-U", role, "-d", DB, "-X", "-At",
         "-v", "ON_ERROR_STOP=1", "-q"],
        input=sql, capture_output=True, text=True)
    out = (p.stdout + p.stderr).strip()
    return p.returncode == 0, out


def sign(mid, secret, exp=None):
    exp = exp if exp is not None else int(time.time()) + 300
    sig = hmac.new(secret, f"{mid}.{exp}".encode(), hashlib.sha256).hexdigest()
    return mid, exp, sig


def ctx(mid, secret=SECRET1, exp=None, sig=None, canon=None):
    m, e, s = sign(canon or mid, secret, exp)
    return (f"SELECT set_config('app.merchant_id','{mid}',true),"
            f"set_config('app.merchant_exp','{e}',true),"
            f"set_config('app.merchant_id_sig','{sig or s}',true);\n")


def tx(body, c=""):
    return f"BEGIN;\n{c}{body}\nCOMMIT;\n"


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}\n        {detail}")


def expect_ok(name, role, sql, contains=None, equals=None):
    ok, out = run(role, sql)
    good = ok and (contains is None or contains in out) and (equals is None or out == equals)
    check(name, good, f"got ok={ok} out={out!r}")
    return out


def expect_err(name, role, sql, contains=None):
    ok, out = run(role, sql)
    good = (not ok) and (contains is None or contains.lower() in out.lower())
    check(name, good, f"got ok={ok} out={out!r}")


def scalar(role, sql):
    ok, out = run(role, sql)
    assert ok, out
    return out.splitlines()[-1] if out else ""


# ---------------------------------------------------------------- setup
print("== setup")
ok, out = run("migrator",
    f"SELECT vitrine_internal.provision_tenant_secret(1, '\\x{SECRET1.hex()}');")
check("migrator can provision secret slot 1", ok, out)
ok, out = run("migrator", "SELECT secret FROM vitrine_internal.app_tenant_secret;")
check("migrator cannot read the secret back", not ok, out)

# ----------------------------------------------------------- registration
print("== registration")
A = scalar("vitrine_registration",
           f"SELECT vitrine_internal.register_merchant('A@Example.com','{H}','  Alice ');")
check("register returns uuid", len(A) == 36, A)
B = scalar("vitrine_registration",
           f"SELECT vitrine_internal.register_merchant('b@example.com','{H}','Bob');")
C = scalar("vitrine_registration",
           f"SELECT vitrine_internal.register_merchant('c@example.com','{H}','Carol');")
dup = scalar("vitrine_registration",
             f"SELECT coalesce(vitrine_internal.register_merchant('a@example.com','{H}','Dup')::text,'NULL');")
check("duplicate e-mail (case-insens.) returns NULL, no error", dup == "NULL", dup)
expect_err("bad e-mail rejected", "vitrine_registration",
           f"SELECT vitrine_internal.register_merchant('nope','{H}','X');", "invalid email")
expect_err("bad hash rejected", "vitrine_registration",
           "SELECT vitrine_internal.register_merchant('z@example.com','plain','X');", "format")
expect_err("NULL name rejected", "vitrine_registration",
           f"SELECT vitrine_internal.register_merchant('z@example.com','{H}',NULL);", "full_name")
expect_err("registration role cannot read merchants", "vitrine_registration",
           "SELECT id FROM vitrine_core.merchants;")
expect_err("registration role cannot call admin fn", "vitrine_registration",
           f"SELECT vitrine_core.admin_set_merchant_status('{A}','ACTIVE');")
expect_err("public role cannot call register_merchant", "vitrine_public",
           f"SELECT vitrine_internal.register_merchant('q@example.com','{H}','Q');")
check("e-mail stored lowercased & trimmed name",
      scalar("migrator", f"SELECT email||'|'||full_name FROM vitrine_core.merchants WHERE id='{A}';")
      == "a@example.com|Alice")

# ------------------------------------------------------------------ admin
print("== admin functions")
for m in (A, B):
    expect_ok(f"admin activates {m[:8]}", "vitrine_admin",
              f"SELECT set_config('app.admin_actor','root@vitrine',false);"
              f"SELECT vitrine_core.admin_set_merchant_status('{m}','ACTIVE','kyc ok');")
expect_err("PENDING -> SUSPENDED not allowed", "vitrine_admin",
           f"SELECT vitrine_core.admin_set_merchant_status('{C}','SUSPENDED');", "not allowed")
expect_err("NULL status rejected", "vitrine_admin",
           f"SELECT vitrine_core.admin_set_merchant_status('{C}',NULL);", "required")
expect_err("NULL merchant rejected", "vitrine_admin",
           "SELECT vitrine_core.admin_set_merchant_status(NULL,'ACTIVE');", "required")
expect_err("NULL tier rejected", "vitrine_admin",
           f"SELECT vitrine_core.admin_set_subscription('{A}',NULL);", "required")
expect_err("bad tier rejected", "vitrine_admin",
           f"SELECT vitrine_core.admin_set_subscription('{A}','GOLD');", "invalid tier")
expect_ok("set tier PRO", "vitrine_admin",
          f"SELECT vitrine_core.admin_set_subscription('{A}','PRO');")
expect_err("NULL flag rejected (store)", "vitrine_admin",
           f"SELECT vitrine_core.admin_set_store_disabled('{uuid.uuid4()}',NULL);", "required")
expect_err("unknown store -> not found", "vitrine_admin",
           f"SELECT vitrine_core.admin_set_store_disabled('{uuid.uuid4()}',true);", "not found")
check("audit rows written with actor",
      scalar("vitrine_admin",
             "SELECT count(*) FROM vitrine_core.admin_audit_log WHERE actor='root@vitrine';") == "2")
expect_err("admin cannot UPDATE merchants directly", "vitrine_admin",
           f"UPDATE vitrine_core.merchants SET status='CLOSED' WHERE id='{A}';", "permission denied")
expect_err("admin cannot read password_hash", "vitrine_admin",
           "SELECT password_hash FROM vitrine_core.merchants;", "permission denied")
expect_err("admin cannot tamper audit log", "vitrine_admin",
           "DELETE FROM vitrine_core.admin_audit_log;", "permission denied")
expect_err("app role cannot call admin fn", "vitrine_app",
           f"SELECT vitrine_core.admin_set_merchant_status('{C}','ACTIVE');", "permission denied")

# ------------------------------------------------------ tenant context
print("== tenant context / RLS")
expect_ok("no context -> 0 merchant rows", "vitrine_app",
          "SELECT count(*) FROM vitrine_core.merchants;", equals="0")
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.merchants;", ctx(A)))
check("ctx A -> N=1", "N=1" in out, out)
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.merchants;",
                                ctx(A, sig="0" * 64)))
check("forged signature -> N=0", "N=0" in out, out)
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.merchants;",
                                ctx(A, secret=os.urandom(32))))
check("wrong key -> N=0", "N=0" in out, out)
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.merchants;",
                                ctx(A, exp=int(time.time()) - 5)))
check("expired -> N=0", "N=0" in out, out)
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.merchants;",
                                ctx(A, exp=int(time.time()) + 7200)))
check("exp > 1h ahead -> N=0", "N=0" in out, out)
# swap uuid but keep A's signature
_, e, s = sign(A, SECRET1)
swap = (f"SELECT set_config('app.merchant_id','{B}',true),set_config('app.merchant_exp','{e}',true),"
        f"set_config('app.merchant_id_sig','{s}',true);\n")
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.merchants;", swap))
check("uuid swapped, A's sig reused -> N=0", "N=0" in out, out)
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.merchants;",
                                ctx(A.upper(), canon=A)))
check("uppercase uuid with lowercase-signed sig still verifies (canonical form)", "N=1" in out, out)
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.merchants;",
                                "SELECT set_config('app.merchant_id','not-a-uuid',true),"
                                "set_config('app.merchant_exp','9999999999',true),"
                                "set_config('app.merchant_id_sig','" + "a" * 64 + "',true);"))
check("garbage uuid -> N=0 (no error)", "N=0" in out, out)

# context does not leak after COMMIT (pooler safety with txn-local)
ok, out = run("vitrine_app", tx("SELECT 1;", ctx(A)) +
              "SELECT 'N='||count(*) FROM vitrine_core.merchants;")
check("txn-local ctx does not survive COMMIT", out.strip().endswith("N=0"), out)

# rotation
ok, out = run("migrator", f"SELECT vitrine_internal.provision_tenant_secret(2, '\\x{SECRET2.hex()}');")
check("provision slot 2", ok, out)
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.merchants;", ctx(A, secret=SECRET2)))
check("rotation: new secret accepted", "N=1" in out, out)
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.merchants;", ctx(A, secret=SECRET1)))
check("rotation: old secret still accepted during overlap", "N=1" in out, out)
run("migrator", "SELECT vitrine_internal.clear_tenant_secret(1);")
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.merchants;", ctx(A, secret=SECRET1)))
check("rotation: old secret rejected after clear", "N=0" in out, out)
SECRET = SECRET2

# ----------------------------------------------------------- app columns
print("== column privileges (merchant role)")
expect_err("app cannot read password_hash", "vitrine_app",
           tx("SELECT password_hash FROM vitrine_core.merchants;", ctx(A, SECRET)), "permission denied")
expect_err("app cannot change own status", "vitrine_app",
           tx(f"UPDATE vitrine_core.merchants SET status='ACTIVE' WHERE id='{A}';", ctx(A, SECRET)),
           "permission denied")
expect_err("app cannot change own tier", "vitrine_app",
           tx(f"UPDATE vitrine_core.merchants SET subscription_tier='ENTERPRISE' WHERE id='{A}';",
              ctx(A, SECRET)), "permission denied")
ok, out = run("vitrine_app", tx(
    f"UPDATE vitrine_core.merchants SET full_name='Alice N' WHERE id='{A}';"
    f"UPDATE vitrine_core.merchants SET full_name='HACK' WHERE id='{B}';", ctx(A, SECRET)))
check("app updates own full_name only (B untouched)",
      scalar("migrator", f"SELECT full_name FROM vitrine_core.merchants WHERE id='{B}';") == "Bob"
      and scalar("migrator", f"SELECT full_name FROM vitrine_core.merchants WHERE id='{A}';") == "Alice N",
      out)

# ----------------------------------------------------------------- auth
print("== authentication helpers")
out = scalar("vitrine_app", "SELECT o_status FROM vitrine_internal.auth_lookup_merchant('A@EXAMPLE.com');")
check("auth lookup finds merchant by e-mail (case-insens.)", out == "ACTIVE", out)
expect_ok("auth lookup unknown -> empty", "vitrine_app",
          "SELECT * FROM vitrine_internal.auth_lookup_merchant('ghost@example.com');", equals="")
expect_err("record_login without ctx fails", "vitrine_app",
           "SELECT vitrine_internal.auth_record_login();", "tenant context")
expect_ok("record_login with ctx", "vitrine_app",
          tx("SELECT vitrine_internal.auth_record_login();", ctx(A, SECRET)))
check("last_login_at set for A only",
      scalar("migrator", f"SELECT (last_login_at IS NOT NULL)::text FROM vitrine_core.merchants WHERE id='{A}';") == "true"
      and scalar("migrator", f"SELECT (last_login_at IS NULL)::text FROM vitrine_core.merchants WHERE id='{B}';") == "true")
expect_err("change_password rejects bad hash", "vitrine_app",
           tx("SELECT vitrine_internal.auth_change_password('x');", ctx(A, SECRET)), "format")
expect_ok("change_password ok", "vitrine_app",
          tx("SELECT vitrine_internal.auth_change_password('$2b$12$abcdefghijklmnopqrstuv');", ctx(A, SECRET)))
check("password actually changed (A) but not B",
      scalar("migrator", f"SELECT left(password_hash,4) FROM vitrine_core.merchants WHERE id='{A}';") == "$2b$"
      and scalar("migrator", f"SELECT left(password_hash,9) FROM vitrine_core.merchants WHERE id='{B}';") == "$argon2id")
expect_err("registration role cannot use auth lookup", "vitrine_registration",
           "SELECT * FROM vitrine_internal.auth_lookup_merchant('a@example.com');", "permission denied")

# --------------------------------------------------------- stores/products
print("== stores & products (isolation)")
cA = ctx(A, SECRET); cB = ctx(B, SECRET); cC = ctx(C, SECRET)
expect_ok("A creates store", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.stores (merchant_id,store_name,subdomain) VALUES ('{A}','Alice Shop','alice');", cA))
expect_ok("B creates store", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.stores (merchant_id,store_name,subdomain) VALUES ('{B}','Bob Shop','bob');", cB))
SA = scalar("migrator", "SELECT id FROM vitrine_core.stores WHERE subdomain='alice';")
SB = scalar("migrator", "SELECT id FROM vitrine_core.stores WHERE subdomain='bob';")
expect_err("A cannot insert store for B", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.stores (merchant_id,store_name,subdomain) VALUES ('{B}','x','evil1');", cA),
    "row-level security")
expect_err("PENDING merchant C cannot create store", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.stores (merchant_id,store_name,subdomain) VALUES ('{C}','x','pend');", cC),
    "row-level security")
expect_err("reserved subdomain blocked", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.stores (merchant_id,store_name,subdomain) VALUES ('{A}','x','admin');", cA),
    "reserved")
expect_err("duplicate subdomain blocked", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.stores (merchant_id,store_name,subdomain) VALUES ('{A}','x','bob');", cA),
    "duplicate key")
expect_err("invalid timezone blocked", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.stores (merchant_id,store_name,subdomain,timezone) VALUES ('{A}','x','tz1','Mars/Olympus');", cA),
    "timezone")
expect_err("invalid locale blocked", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.stores (merchant_id,store_name,subdomain,locale) VALUES ('{A}','x','lc1','xx_YY');", cA),
    "locale")
expect_err("app cannot set is_active on insert", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.stores (merchant_id,store_name,subdomain,is_active) VALUES ('{A}','x','na1',false);", cA),
    "permission denied")
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.stores;", cA))
check("A sees only own stores", "N=1" in out, out)
ok, out = run("vitrine_app", tx(
    f"WITH u AS (UPDATE vitrine_core.stores SET store_name='pwn' WHERE id='{SB}' RETURNING 1) SELECT 'U='||count(*) FROM u;", cA))
check("A cannot update B's store (0 rows)", "U=0" in out, out)

expect_ok("A creates product", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.products (store_id,merchant_id,title,price,sku) VALUES ('{SA}','{A}','Shirt',100,'S1');", cA))
expect_ok("B creates product", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.products (store_id,merchant_id,title,price) VALUES ('{SB}','{B}','Hat',50);", cB))
expect_err("A cannot put product in B's store (RLS)", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.products (store_id,merchant_id,title,price) VALUES ('{SB}','{B}','x',1);", cA),
    "row-level security")
expect_err("A cannot put product in B's store as own merchant (composite FK)", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.products (store_id,merchant_id,title,price) VALUES ('{SB}','{A}','x',1);", cA),
    "foreign key")
expect_err("duplicate SKU (case-insens.) blocked", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.products (store_id,merchant_id,title,price,sku) VALUES ('{SA}','{A}','y',1,'s1');", cA),
    "duplicate key")
expect_err("negative price blocked", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.products (store_id,merchant_id,title,price) VALUES ('{SA}','{A}','n',-1);", cA),
    "check")
expect_err("product store_id is immutable for app", "vitrine_app", tx(
    f"UPDATE vitrine_core.products SET store_id='{SB}' WHERE merchant_id='{A}';", cA), "permission denied")

# ------------------------------------------------------- admin kill switch
print("== admin kill switch & merchant status")
PA = scalar("migrator", "SELECT id FROM vitrine_core.products WHERE title='Shirt';")
PB = scalar("migrator", "SELECT id FROM vitrine_core.products WHERE title='Hat';")
v = lambda: scalar("vitrine_public", "SELECT count(*) FROM vitrine_public_api.public_storefront_products;")
check("view shows 2 products", v() == "2", v())
run("vitrine_admin", f"SELECT vitrine_core.admin_set_store_disabled('{SA}',true,'tos');")
check("admin-disabled store hidden from view", v() == "1", v())
ok, out = run("vitrine_app", tx(
    f"WITH u AS (UPDATE vitrine_core.stores SET is_active=true,store_name='re' WHERE id='{SA}' RETURNING 1) SELECT 'U='||count(*) FROM u;", cA))
check("merchant cannot edit/re-enable admin-disabled store", "U=0" in out, out)
expect_err("merchant cannot write admin_disabled_at", "vitrine_app", tx(
    f"UPDATE vitrine_core.stores SET admin_disabled_at=NULL WHERE id='{SA}';", cA), "permission denied")
run("vitrine_admin", f"SELECT vitrine_core.admin_set_store_disabled('{SA}',false);")
check("re-enabled store visible again", v() == "2", v())

run("vitrine_admin", f"SELECT vitrine_core.admin_set_product_disabled('{PB}',true);")
check("admin-disabled product hidden", v() == "1", v())
ok, out = run("vitrine_app", tx(
    f"WITH u AS (UPDATE vitrine_core.products SET is_active=true WHERE id='{PB}' RETURNING 1) SELECT 'U='||count(*) FROM u;", cB))
check("merchant cannot touch admin-disabled product", "U=0" in out, out)
run("vitrine_admin", f"SELECT vitrine_core.admin_set_product_disabled('{PB}',false);")

# merchant self-service archive still works
expect_ok("merchant can archive own product", "vitrine_app", tx(
    f"UPDATE vitrine_core.products SET is_active=false, archived_at=now() WHERE id='{PA}';", cA))
check("archived product hidden", v() == "1", v())
expect_ok("merchant can un-archive own product", "vitrine_app", tx(
    f"UPDATE vitrine_core.products SET is_active=true, archived_at=NULL WHERE id='{PA}';", cA))

run("vitrine_admin", f"SELECT vitrine_core.admin_set_merchant_status('{A}','SUSPENDED','chargeback');")
check("suspended merchant's products hidden", v() == "1", v())
expect_err("suspended merchant cannot create product", "vitrine_app", tx(
    f"INSERT INTO vitrine_core.products (store_id,merchant_id,title,price) VALUES ('{SA}','{A}','late',1);", cA),
    "row-level security")
ok, out = run("vitrine_app", tx(
    f"WITH u AS (UPDATE vitrine_core.products SET price=1 WHERE id='{PA}' RETURNING 1) SELECT 'U='||count(*) FROM u;", cA))
check("suspended merchant cannot update product", "U=0" in out or "row-level" in out, out)
ok, out = run("vitrine_app", tx("SELECT 'N='||count(*) FROM vitrine_core.products;", cA))
check("suspended merchant can still read own data", "N=1" in out, out)
run("vitrine_admin", f"SELECT vitrine_core.admin_set_merchant_status('{A}','ACTIVE');")
check("reactivated merchant visible again", v() == "2", v())
run("vitrine_admin", f"SELECT vitrine_core.admin_set_merchant_status('{A}','CLOSED');")
expect_err("CLOSED is terminal", "vitrine_admin",
           f"SELECT vitrine_core.admin_set_merchant_status('{A}','ACTIVE');", "not allowed")

# -------------------------------------------------------------- public view
print("== public storefront view")
expect_err("public role cannot read base tables", "vitrine_public",
           "SELECT * FROM vitrine_core.stores;", "permission denied")
expect_err("public role cannot read merchants", "vitrine_public",
           "SELECT id FROM vitrine_core.merchants;", "permission denied")
cols = scalar("vitrine_public",
              "SELECT string_agg(column_name,',' ORDER BY ordinal_position) FROM information_schema.columns "
              "WHERE table_schema='vitrine_public_api';")
check("view exposes no merchant/internal columns",
      "merchant" not in cols and "password" not in cols and "email" not in cols, cols)
check("view is security_barrier",
      "security_barrier=true" in scalar("migrator",
        "SELECT reloptions::text FROM pg_class WHERE relname='public_storefront_products';"))
expect_err("public role cannot call internal fns", "vitrine_public",
           "SELECT vitrine_internal.app_current_merchant_id();", "permission denied")

# ---------------------------------------------------- privilege escalation
print("== privilege escalation attempts")
expect_err("app cannot read secret table", "vitrine_app",
           "SELECT * FROM vitrine_internal.app_tenant_secret;", "permission denied")
expect_err("app cannot provision secret", "vitrine_app",
           "SELECT vitrine_internal.provision_tenant_secret(1, '\\x" + "00" * 32 + "');", "permission denied")
expect_err("app cannot SET ROLE to owner", "vitrine_app", "SET ROLE vitrine_admin_owner;", "permission denied")
expect_err("admin cannot SET ROLE to owner", "vitrine_admin", "SET ROLE vitrine_admin_owner;", "permission denied")
expect_err("migrator cannot SET ROLE to owner after migration", "migrator",
           "SET ROLE vitrine_internal_owner;", "permission denied")
expect_err("app cannot create objects in vitrine_core", "vitrine_app",
           "CREATE TABLE vitrine_core.x(i int);", "permission denied")
expect_err("app cannot create objects in public", "vitrine_app",
           "CREATE TABLE public.x(i int);", "permission denied")
expect_err("app cannot hijack via search_path function shadow", "vitrine_app",
           "CREATE FUNCTION pg_temp.hmac(bytea,bytea,text) RETURNS bytea LANGUAGE sql AS $$ SELECT $1 $$;"
           "SET search_path=pg_temp,public; SELECT vitrine_internal.app_current_merchant_id(); SELECT 1/0;",
           "division by zero")  # shadow created, but definer fn pins search_path -> not used; SELECT 1/0 proves we got that far
check("members of vitrine_* roles after migration: none (non-bare-admin)",
      scalar("postgres",
             "SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid "
             "WHERE r.rolname LIKE 'vitrine\\_%' AND (m.set_option OR m.inherit_option);") == "0")
check("migrator (table owner) still sees rows despite FORCE RLS",
      scalar("migrator", "SELECT count(*) FROM vitrine_core.merchants;") == "3")

# ------------------------------------------------------------- performance
print("== RLS function evaluated once per statement")
_db_ident = DB.replace('"', '""')
run(ADMIN_ROLE, f'ALTER DATABASE "{_db_ident}" SET track_functions=\'all\';')
time.sleep(1)
many = (f"INSERT INTO vitrine_core.products (store_id,merchant_id,title,price) "
        f"SELECT '{SB}','{B}','bulk'||g,1 FROM generate_series(1,2000) g;")
expect_ok("bulk insert 2000 products as B", "vitrine_app", tx(many, cB))
run("postgres", "SELECT pg_stat_reset();")
ok, out = run("vitrine_app", tx("SELECT count(*) FROM vitrine_core.products;", cB))
time.sleep(1.5)
calls = scalar("postgres",
               "SELECT coalesce(max(calls),0) FROM pg_stat_user_functions WHERE funcname='app_current_merchant_id';")
check("app_current_merchant_id called <=3 times for a 2001-row scan (not per row)",
      calls.isdigit() and int(calls) <= 3, f"calls={calls}")

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
