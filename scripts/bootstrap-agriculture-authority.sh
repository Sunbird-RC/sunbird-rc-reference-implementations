#!/usr/bin/env bash
# Configures the Agriculture topology in the Authority Service.
#
# This replaces the configuration half of seed-agriculture.sh, which wrote to Sunbird RC
# directly and chose the owning tenant itself. Records now arrive through the Authority
# Service, which assigns the tenant — that is what makes the lifecycle demonstrable at all,
# because a record that merely exists has no state to suspend.
#
# Two Authorities, each PRIMARY for its own tenant, sharing one Authority Service and one
# managed Registry:
#
#     Farmer Authority              Land Authority
#       tenant  T-AGRI-FARMER         tenant  T-AGRI-LAND
#       binding FarmerRecord          binding LandRecord
#       issuer  ISS-FARMER            issuer  ISS-LAND
#       profile P-FARMER              profile P-LAND
#
# Neither tenant can read the other's records. The application correlates across them from
# claims in two credentials, OUTSIDE both, which is the point: correlation must not hand
# either Authority access to the other's Registry.
#
# Idempotent. Every step looks for what it would create and reports it instead. Re-running
# is the normal case — this is configuration, not a migration.
set -euo pipefail

# The Authority Service admin API. Not a public route: it is the authenticated
# administrative surface and is not exposed by the demo's public listener.
BASE="${AUTHORITY_URL:-http://localhost:3334}"
API="$BASE/api/v1"

# Root tenant creation requires a principal listed in the service's BOOTSTRAP_ADMINS.
# These two headers are honoured ONLY when the service runs with ENABLE_AUTH=false, which
# is a local-development escape hatch — the service defaults to authentication on, and a
# deployed environment reaches these routes with a real OIDC token instead.
BOOT_ISSUER="${BOOTSTRAP_ISSUER:-https://idp.test}"
BOOT_SUBJECT="${BOOTSTRAP_SUBJECT:-bootstrap}"

# The two operators, one per Authority. Synthetic identities: no real account is named here.
MEMBER_ISSUER="${MEMBER_ISSUER:-https://idp.test}"
FARMER_OPERATOR="${FARMER_OPERATOR:-agri-farmer-operator}"
LAND_OPERATOR="${LAND_OPERATOR:-agri-land-operator}"
FARMER_OFFICER="${FARMER_OFFICER:-agri-farmer-officer}"
LAND_OFFICER="${LAND_OFFICER:-agri-land-officer}"

green() { printf '  \033[32m✓\033[0m %s\n' "$1" >&2; }
info()  { printf '  \033[2m·\033[0m %s\n' "$1" >&2; }
warn()  { printf '  \033[33m!\033[0m %s\n' "$1" >&2; }
die()   { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }
head1() { printf '\n\033[1m%s\033[0m\n' "$1" >&2; }

# api METHOD PATH [BODY] -> body on stdout; non-2xx is fatal and prints what came back.
api() {
  local method="$1" path="$2" body="${3:-}" out status
  local args=(-sS --max-time 30 -X "$method" "$API$path"
              -H "x-dev-issuer: $BOOT_ISSUER" -H "x-dev-subject: $BOOT_SUBJECT"
              -H 'Content-Type: application/json' -w '\n%{http_code}')
  [ -n "$body" ] && args+=(-d "$body")
  out="$(curl "${args[@]}")" || die "$method $path — could not reach $BASE"
  status="${out##*$'\n'}"
  body="${out%$'\n'*}"
  case "$status" in
    2*) printf '%s' "$body" ;;
    *)  die "$method $path -> $status: $(printf '%s' "$body" | head -c 300)" ;;
  esac
}

# Reads one field out of a JSON object on stdin. Python rather than jq: the repository
# already depends on python3 (scripts/credential-specs.py) and not on jq.
field() { python3 -c 'import sys,json;print(json.load(sys.stdin).get(sys.argv[1]) or "")' "$1"; }

# Finds an element of a JSON array whose "code" matches, and prints its id, or nothing.
id_by_code() {
  python3 -c '
import sys, json
want = sys.argv[1]
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get("items", [])
print(next((i["id"] for i in items if i.get("code") == want), ""))
' "$1"
}

# Same, keyed on entityName — registry bindings have no code.
id_by_entity() {
  python3 -c '
import sys, json
want = sys.argv[1]
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get("items", [])
print(next((i["id"] for i in items if i.get("entityName") == want), ""))
' "$1"
}

command -v python3 >/dev/null || die "python3 is required"
curl -sS --max-time 10 "$BASE/health" >/dev/null 2>&1 \
  || die "Authority Service is not answering at $BASE (set AUTHORITY_URL)"

head1 "Authority Service at $BASE"
green "health ok"

# Preflight, in the main shell where die can actually stop the script.
#
# Everything below runs inside $(...) captures, and `exit` there kills only the subshell —
# the first draft of this script hit a 401 on every call and cheerfully reported creating
# things. Health is a public route and says nothing about whether these headers are
# accepted, so this asks for something that requires a principal.
preflight="$(curl -sS --max-time 15 "$API/tenants" \
  -H "x-dev-issuer: $BOOT_ISSUER" -H "x-dev-subject: $BOOT_SUBJECT" -w '\n%{http_code}')"
case "${preflight##*$'\n'}" in
  2*) green "bootstrap principal accepted" ;;
  401|403)
    die "the service rejected the bootstrap principal — it is running with authentication on.
    These headers work only when the service has ENABLE_AUTH=false, and root tenant creation
    additionally needs BOOTSTRAP_ADMINS to contain \"$BOOT_ISSUER|$BOOT_SUBJECT\".
    Both default to secure values, so a freshly started stack will not have them." ;;
  *) die "unexpected response from $API/tenants: ${preflight##*$'\n'}" ;;
esac

# require_id NAME VALUE — called in the main shell, so this one can stop everything.
require_id() {
  case "$2" in
    ????????-????-????-????-????????????) : ;;
    *) die "$1 did not come back as an id (got \"${2:-empty}\") — refusing to continue" ;;
  esac
}

# Bash 3.2 is what macOS ships, so no associative arrays. With two of everything,
# naming them is clearer than working around the shell anyway.

# ensure_tenant CODE NAME -> id
ensure_tenant() {
  local existing
  existing="$(api GET /tenants | id_by_code "$1")"
  if [ -n "$existing" ]; then info "tenant $1 already present"; printf '%s' "$existing"; return; fi
  info "tenant $1 created"
  api POST /tenants "$(printf '{"code":"%s","name":"%s"}' "$1" "$2")" | field id
}

# ensure_authority CODE NAME TENANT_ID -> id
ensure_authority() {
  local existing
  existing="$(api GET /authorities | id_by_code "$1")"
  if [ -n "$existing" ]; then info "authority $1 already present"; printf '%s' "$existing"; return; fi
  info "authority $1 created, PRIMARY for its tenant"
  api POST /authorities "$(printf '{"code":"%s","name":"%s","tenantId":"%s"}' "$1" "$2" "$3")" | field id
}

# ensure_binding AUTHORITY_ID ENTITY NAME UNIQUE_FIELD -> id
ensure_binding() {
  local existing
  existing="$(api GET "/authorities/$1/registries" | id_by_entity "$2")"
  if [ -n "$existing" ]; then info "binding $2 already present"; printf '%s' "$existing"; return; fi
  info "binding $2 created, unique on $4 within the tenant"
  api POST "/authorities/$1/registries" \
    "$(printf '{"name":"%s","rcInstanceRef":"%s","entityName":"%s","uniqueFields":["%s"]}' \
       "$3" "${RC_REGISTRY_URL:-http://registry:8081}" "$2" "$4")" | field id
}

# ensure_issuer AUTHORITY_ID CODE DISPLAY -> id
ensure_issuer() {
  local existing
  existing="$(api GET "/authorities/$1/issuers" | id_by_code "$2")"
  if [ -n "$existing" ]; then info "issuer $2 already present"; printf '%s' "$existing"; return; fi
  info "issuer $2 created"
  api POST "/authorities/$1/issuers" \
    "$(printf '{"code":"%s","displayName":{"en":"%s"}}' "$2" "$3")" | field id
}


# ensure_membership TENANT_ID SUBJECT ROLE
# Membership is keyed on (issuer, subject), so the same person at two Authorities is two
# memberships and never one account spanning both. That is the property the whole topology
# rests on, so the script grants each operator exactly one tenant.
ensure_membership() {
  local existing
  existing="$(api GET "/tenants/$1/memberships" \
    | python3 -c '
import sys, json
subject, role = sys.argv[1], sys.argv[2]
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get("items", [])
print(next((m["id"] for m in items
            if m.get("subject") == subject and m.get("role") == role), ""))
' "$2" "$3")"
  if [ -n "$existing" ]; then info "membership $2 ($3) already present"; return; fi
  api POST "/tenants/$1/memberships" \
    "$(printf '{"issuer":"%s","subject":"%s","role":"%s"}' "$MEMBER_ISSUER" "$2" "$3")" >/dev/null
  info "membership $2 ($3) created"
}

head1 "Tenants"
TENANT_FARMER="$(ensure_tenant T-AGRI-FARMER 'Farmer Authority Tenant')"
require_id "tenant T-AGRI-FARMER" "$TENANT_FARMER"
TENANT_LAND="$(ensure_tenant T-AGRI-LAND 'Land Authority Tenant')"
require_id "tenant T-AGRI-LAND" "$TENANT_LAND"

head1 "Authorities"
AUTH_FARMER="$(ensure_authority AUTH-FARMER 'Farmer Authority' "$TENANT_FARMER")"
require_id "authority AUTH-FARMER" "$AUTH_FARMER"
AUTH_LAND="$(ensure_authority AUTH-LAND 'Land Authority' "$TENANT_LAND")"
require_id "authority AUTH-LAND" "$AUTH_LAND"

head1 "Registry bindings"
# uniqueFields is tenant-scoped, per the identifier decision: no RC global index and no
# platform-wide identifier. Two tenants may legitimately both hold local number F-004821.
#
# These names must match the RC entity schema exactly — farmerId and landId, as defined in
# registry-schemas/. A name that matches nothing does NOT fail: uniqueness is claimed only
# for fields a record actually carries, so a typo silently disables the constraint for every
# record, and uniqueFields cannot be patched afterwards. Verified by getting it wrong first:
# a binding declaring "farmerNumber" accepted two records with the same farmerId.
BIND_FARMER="$(ensure_binding "$AUTH_FARMER" FarmerRecord 'Farmer Records' farmerId)"
require_id "binding FarmerRecord" "$BIND_FARMER"
BIND_LAND="$(ensure_binding "$AUTH_LAND" LandRecord 'Land Records' landId)"
require_id "binding LandRecord" "$BIND_LAND"

head1 "Issuers"
ISS_FARMER="$(ensure_issuer "$AUTH_FARMER" ISS-FARMER 'Farmer Authority')"
require_id "issuer ISS-FARMER" "$ISS_FARMER"
ISS_LAND="$(ensure_issuer "$AUTH_LAND" ISS-LAND 'Land Authority')"
require_id "issuer ISS-LAND" "$ISS_LAND"

head1 "Memberships"
# Distinct operators per Authority. Neither can read the other's records, and the
# application correlates across them from credentials rather than from access.
ensure_membership "$TENANT_FARMER" "$FARMER_OPERATOR" OPERATOR
ensure_membership "$TENANT_LAND"   "$LAND_OPERATOR"   OPERATOR
# Separation of duties: an OPERATOR may create and submit a record but not approve it.
# Approval requires AUTHORISED_OFFICER or ADMINISTRATOR, so a record cannot be brought into
# force by the same person who entered it. Seeding therefore needs both roles, and they are
# deliberately different subjects — granting one person both would configure the separation
# away while appearing to satisfy it.
ensure_membership "$TENANT_FARMER" "$FARMER_OFFICER"  AUTHORISED_OFFICER
ensure_membership "$TENANT_LAND"   "$LAND_OFFICER"    AUTHORISED_OFFICER

warn "No signing key is configured here — see the note at the end of this script."

head1 "Summary"
printf '  tenant    %-16s %s\n' T-AGRI-FARMER "$TENANT_FARMER" T-AGRI-LAND "$TENANT_LAND"
printf '  authority %-16s %s\n' AUTH-FARMER "$AUTH_FARMER" AUTH-LAND "$AUTH_LAND"
printf '  binding   %-16s %s\n' FarmerRecord "$BIND_FARMER" LandRecord "$BIND_LAND"
printf '  issuer    %-16s %s\n' ISS-FARMER "$ISS_FARMER" ISS-LAND "$ISS_LAND"

cat <<'NOTE'

Not configured yet, and deliberately not faked:

  Signing keys   Each issuer needs a key before it can sign. The key reference is an
                 environment fact (an identity-service DID, a KMS URI or a JWKS URL), not
                 something this script should invent — inventing one would produce an
                 issuer that looks configured and cannot sign.

  Profiles and   Blocked on the canonical-reference decision. The credential profiles
  claim mappings cannot be completed while farmerReference and parcelReference have no
                 way to be produced: the Authority Service's claim mappings are a closed
                 set (DIRECT, CONSTANT, DERIVED with AGE_OVER or FIELD_PRESENT) and none
                 of them can build "{authority}:{jurisdiction}:{local}". Configuring the
                 profiles with a bare local number instead would issue exactly the value
                 the identifier decision refuses.
NOTE
