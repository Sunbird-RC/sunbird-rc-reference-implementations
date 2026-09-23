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

# How this script authenticates, in either mode. It discovers which mode the service is in
# rather than being told, so the same invocation works against a development stack with
# ENABLE_AUTH=false and against a deployment that requires real tokens.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
. "$ROOT/scripts/lib/authority-auth.sh"

# The two operators, one per Authority. Synthetic identities: no real account is named here.
MEMBER_ISSUER="${MEMBER_ISSUER:-https://idp.test}"
FARMER_OPERATOR="${FARMER_OPERATOR:-agri-farmer-operator}"
LAND_OPERATOR="${LAND_OPERATOR:-agri-land-operator}"
FARMER_OFFICER="${FARMER_OFFICER:-agri-farmer-officer}"
LAND_OFFICER="${LAND_OFFICER:-agri-land-officer}"

# Issuer DIDs. Unset by default: a DID is an environment fact, and the demo stack cannot
# produce a usable one (see the guard below). Set these to publicly resolvable did:web
# values to complete issuer configuration.
# Default to the DIDs THIS deployment minted. scripts/bootstrap.sh creates a did:web for
# each Agriculture issuer under the public origin and records it in deploy/.env, and those
# are the only DIDs identity-service holds a signing key for.
#
# Supplying a DID by hand that the deployment does not know is the failure this defaulting
# removes: the Authority accepts it, records it on the issuer, and then every issuance dies
# at `POST identity:3332/utils/sign -> 404`, surfacing as a 500 from credentials-service and
# an ORPHANED issuance — four services away from the typo that caused it.
_did_from_env() {
  [ -f "$ROOT/deploy/.env" ] || return 0
  sed -n "s/^$1=//p" "$ROOT/deploy/.env" | tail -1
}
ISSUER_DID_FARMER="${ISSUER_DID_FARMER:-$(_did_from_env FARMER_ISSUER_DID)}"
ISSUER_DID_LAND="${ISSUER_DID_LAND:-$(_did_from_env LAND_ISSUER_DID)}"
ISSUER_KEY_ALGORITHM="${ISSUER_KEY_ALGORITHM:-Ed25519}"
# Key references default to the issuer DID: the usual case is a DID that resolves to its own
# verification method. Set these only if the signing key is published somewhere else.
ISSUER_KEY_FARMER="${ISSUER_KEY_FARMER:-}"
ISSUER_KEY_LAND="${ISSUER_KEY_LAND:-}"
ISSUER_KEY_ID="${ISSUER_KEY_ID:-key-0}"

# The permanent identifier for the Agriculture context. The w3id.org redirect is live and
# resolves to the immutable committed document, so credentials carry the permanent URI rather
# than a deployment-local or CDN address — which is what makes them usable as interoperability
# evidence rather than development fixtures.
# The base Verifiable Credentials context. The Authority Service composes a credential's
# @context from contextUris ALONE — it prepends nothing — so without this the VC terms
# themselves (VerifiableCredential, issuer, credentialSubject) have nothing to expand under
# and signing fails in JSON-LD safe mode, reported only as "Error signing the document".
VC_CONTEXT_URI="${VC_CONTEXT_URI:-https://www.w3.org/2018/credentials/v1}"
CONTEXT_URI="${CONTEXT_URI:-https://w3id.org/sunbird-rc/agriculture/v1}"
# The jurisdiction a canonical reference is qualified by, read from the record.
JURISDICTION_PATH="${JURISDICTION_PATH:-state}"
# Where credential schemas are registered. Reached through the demo gateway.
SCHEMA_BASE="${SCHEMA_BASE:-http://127.0.0.1:8088}"
# Credential profile codes. Overridable because a profile cannot be deleted and a RETIRED one
# cannot be modified or reused, so a code burned by a mistake stays burned for the life of
# that database. An override is cheaper than rebuilding a deployment to rename something.
PROFILE_FARMER_CODE="${PROFILE_FARMER_CODE:-P-FARMER-AUTH}"
PROFILE_LAND_CODE="${PROFILE_LAND_CODE:-P-LAND-AUTH}"

green() { printf '  \033[32m✓\033[0m %s\n' "$1" >&2; }
info()  { printf '  \033[2m·\033[0m %s\n' "$1" >&2; }
warn()  { printf '  \033[33m!\033[0m %s\n' "$1" >&2; }
die()   { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }
head1() { printf '\n\033[1m%s\033[0m\n' "$1" >&2; }

# api METHOD PATH [BODY] -> body on stdout; non-2xx is fatal and prints what came back.
api() {
  local method="$1" path="$2" body="${3:-}" out status
  authority_headers BOOTSTRAP
  local args=(-sS --max-time 30 -X "$method" "$API$path" "${AUTH_H[@]}"
              -H 'Content-Type: application/json' -w '\n%{http_code}')
  [ -n "$body" ] && args+=(-d "$body")
  out="$(curl "${args[@]}")" || die "$method $path — could not reach $BASE"
  status="${out##*$'\n'}"
  body="${out%$'\n'*}"
  case "$status" in
    2*) printf '%s' "$body" ;;
    409)
      # A create that collides with something this principal cannot see. The usual cause
      # is switching an existing deployment from ENABLE_AUTH=false to real tokens: the
      # bootstrap client is a DIFFERENT principal from the old x-dev-subject, so the
      # listing it reads back is empty and it tries to create what is already there.
      # Nothing here can repair that safely — the existing tenant belongs to the other
      # principal — so say what happened rather than looping.
      die "$method $path -> 409: $(printf '%s' "$body" | head -c 200)
    This resource already exists but is not visible to the principal this script is using
    ($(authority_principal BOOTSTRAP | tr '\t' '|')).
    Switching an existing deployment between authentication modes does that: the tenants
    are owned by the principal that created them. Bootstrap a clean deployment instead." ;;
    *)  die "$method $path -> $status: $(printf '%s' "$body" | head -c 300)" ;;
  esac
}

# Reads one field out of a JSON object on stdin. Python rather than jq: the repository
# already depends on python3 (scripts/credential-specs.py) and not on jq.
# These parse whatever api() produced. api() dies on a non-2xx, but `die` inside a $( )
# ends only the subshell, so a failed call arrives here as an EMPTY string rather than as
# a stopped script. Parsing that with json.load raises, and the traceback buries the real
# error that was printed a line earlier. Return nothing instead and let require_id say so.
_json_or_empty() {
  python3 -c '
import sys, json
raw = sys.stdin.read().strip()
if not raw:
    print("")
    sys.exit(0)
try:
    data = json.loads(raw)
except ValueError:
    print("")
    sys.exit(0)
'"$1" "${2:-}" "${3:-}"
}

field() { _json_or_empty '
print(data.get(sys.argv[1]) or "" if isinstance(data, dict) else "")
' "$1"; }

# Finds an element of a JSON array whose "code" matches, and prints its id, or nothing.
id_by_code() { _json_or_empty '
items = data if isinstance(data, list) else data.get("items", [])
print(next((i["id"] for i in items if i.get("code") == sys.argv[1]), ""))
' "$1"; }

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
authority_headers BOOTSTRAP
preflight="$(curl -sS --max-time 15 "$API/tenants" "${AUTH_H[@]}" -w '\n%{http_code}')"
case "${preflight##*$'\n'}" in
  2*) green "bootstrap principal accepted" ;;
  401|403)
    if [ "$(authority_mode)" = token ]; then
      die "the service rejected the bootstrap token.
    Authentication is ON, so root tenant creation needs BOOTSTRAP_ADMINS to name the
    bootstrap client's service account, spelled issuer|subject. Both values are written to
    deploy/.env by scripts/bootstrap-authority-realm.sh — and the Authority Service reads
    BOOTSTRAP_ADMINS only at start, so it must be recreated after that script runs:
      scripts/bootstrap-authority-realm.sh
      docker compose -f deploy/docker-compose.yml up -d --force-recreate --no-deps authority-service
    Expected principal: $(authority_principal BOOTSTRAP | tr '\t' '|')"
    else
      die "the service rejected the bootstrap principal.
    It is running with ENABLE_AUTH=false, so it expects the x-dev headers this script sent,
    and root tenant creation additionally needs BOOTSTRAP_ADMINS to contain
    \"$BOOT_ISSUER|$BOOT_SUBJECT\". Both default to secure values, so a freshly started
    stack will not have them."
    fi ;;
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
# ensure_membership TENANT_ID PRINCIPAL_KEY ROLE
#
# PRINCIPAL_KEY names a principal (FARMER_OFFICER, LAND_OPERATOR, ...) rather than a
# literal subject, because the subject is not the same string in both modes. With
# ENABLE_AUTH=false it is the x-dev-subject header, a readable name. With authentication
# on it is the `sub` of a client-credentials token, which is the service account's id —
# generated by Keycloak, and therefore not knowable when this file was written.
#
# Writing the readable name into the membership would produce a row that looks right and
# matches nothing: every call would authenticate successfully and then be refused for
# lack of a role. The pair is read from the same place the caller's token comes from.
ensure_membership() {
  local tenant="$1" key="$2" role="$3" pair issuer subject existing
  pair="$(authority_principal "$key")"
  issuer="${pair%%$'\t'*}"
  subject="${pair##*$'\t'}"

  existing="$(api GET "/tenants/$tenant/memberships" \
    | python3 -c '
import sys, json
issuer, subject, role = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get("items", [])
print(next((m["id"] for m in items
            if m.get("subject") == subject and m.get("issuer") == issuer
            and m.get("role") == role), ""))
' "$issuer" "$subject" "$role")"
  if [ -n "$existing" ]; then info "membership $key ($role) already present"; return; fi
  api POST "/tenants/$tenant/memberships" \
    "$(printf '{"issuer":"%s","subject":"%s","role":"%s"}' "$issuer" "$subject" "$role")" >/dev/null
  info "membership $key ($role) created as $subject"
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


# An issuer's DID is the one piece of configuration that is published verbatim to anyone,
# unauthenticated, at GET /trust/issuers/{id}. Two things follow, and the demo stack gets
# both wrong by default.
#
# The identity service mints DIDs from WEB_DID_BASE_URL, which defaults to
# http://identity:3332/did/web — its own address inside the compose network. A DID built
# from that reads
#
#   did:web:http%3A::identity%3A3332:did:web:24d82774-...
#
# and publishing it would disclose an internal service location on a public route, which the
# privacy constraint forbids. It is also simply broken: identity publishes no port, so no
# external verifier can resolve it. A trust anchor nobody can resolve is not a trust anchor.
#
# This guard is a heuristic, not a proof — it rejects hosts that cannot be public rather
# than verifying that a host is. That is the direction worth being wrong in.
did_looks_internal() {
  printf '%s' "$1" | python3 -c '
import sys, re, urllib.parse
did = urllib.parse.unquote(sys.stdin.read())
host = ""
m = re.search(r"did:web:(?:https?:/*)?([^:/]+)", did)
if m:
    host = m.group(1).lower()
# No dot at all means a container or host alias, never a public name. The rest are the
# obvious local and private forms.
internal = (
    not host
    or "." not in host
    or host in ("localhost", "host.docker.internal")
    or re.match(r"^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)", host)
)
print("internal" if internal else "public")
'
}

# ensure_issuer_did ISSUER_ID DID LABEL VAR_NAME
ensure_issuer_did() {
  local issuer_id="$1" did="$2" label="$3" var="$4" current version
  if [ -z "$did" ]; then
    warn "$label has no DID — set $var to publish it at /trust/issuers"
    return
  fi
  if [ "$(did_looks_internal "$did")" = internal ] && [ "${ALLOW_LOCAL_ISSUER_DID:-}" = true ]; then
    # Opt-in, loud, and never the default. The reference stack mints
    # did:web:localhost:<uuid> from PUBLIC_URL, so a local end-to-end run cannot use a
    # publishable DID — the demo's own issuers are unresolvable from anywhere but this
    # machine. Allowing that quietly would turn the guard into a formality, so it says what
    # it is permitting every time.
    warn "ALLOW_LOCAL_ISSUER_DID=true — publishing a DID that cannot be resolved off this"
    warn "  machine: $did"
    warn "  Acceptable for a local run. Never for anything a verifier outside this host reads."
  elif [ "$(did_looks_internal "$did")" = internal ]; then
    die "refusing to set $label to a DID that names an internal or unresolvable host:
    $did
    This is published verbatim, unauthenticated, at GET /trust/issuers/{id}. A DID minted by
    the demo identity service is built from WEB_DID_BASE_URL (http://identity:3332/did/web by
    default) and is both a disclosure of internal topology and unresolvable from outside.
    Point WEB_DID_BASE_URL at the Authority's public origin, or supply a did:web you host."
  fi
  current="$(api GET "/issuers/$issuer_id" | field did)"
  if [ "$current" = "$did" ]; then info "$label DID already set"; return; fi
  version="$(api GET "/issuers/$issuer_id" | field version)"
  authority_headers BOOTSTRAP
  curl -sS --max-time 25 -X PATCH "$API/issuers/$issuer_id" "${AUTH_H[@]}" \
    -H 'Content-Type: application/json' -H "If-Match: $version" \
    -d "$(printf '{"did":"%s"}' "$did")" -o /dev/null -w '' || die "could not set $label DID"
  green "$label DID set"
}

# ensure_issuer_key ISSUER_ID KEY_REF LABEL
#
# The key reference is published too. Guarding only the issuer DID is not enough: a
# verification method's reference appears verbatim in the same public response, so an
# internal DID attached as a key leaks exactly what the DID guard was there to prevent.
# Found by fixing the DID and watching the internal address stay in verificationMethods.
ensure_issuer_key() {
  local issuer_id="$1" key_ref="$2" label="$3" existing
  [ -n "$key_ref" ] || return 0
  if [ "$(did_looks_internal "$key_ref")" = internal ] && [ "${ALLOW_LOCAL_ISSUER_DID:-}" = true ]; then
    warn "ALLOW_LOCAL_ISSUER_DID=true — attaching an unresolvable key reference to $label"
  elif [ "$(did_looks_internal "$key_ref")" = internal ]; then
    die "refusing to attach a key to $label whose reference names an internal host:
    $key_ref
    Key references are published in verificationMethods at GET /trust/issuers/{id}, with the
    same consequences as an internal issuer DID."
  fi
  existing="$(api GET "/issuers/$issuer_id/keys" | python3 -c '
import sys, json
want = sys.argv[1]
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get("items", [])
print(next((k["id"] for k in items if k.get("keyRefUri") == want), ""))
' "$key_ref")"
  if [ -n "$existing" ]; then info "$label key already attached"; return; fi
  api POST "/issuers/$issuer_id/keys" \
    "$(printf '{"keyRefType":"IDENTITY_SERVICE_DID","keyRefUri":"%s","kid":"%s","algorithm":"%s"}' \
       "$key_ref" "$ISSUER_KEY_ID" "$ISSUER_KEY_ALGORITHM")" >/dev/null
  green "$label key attached"
}

head1 "Issuer DIDs"
ensure_issuer_did "$ISS_FARMER" "$ISSUER_DID_FARMER" "ISS-FARMER" ISSUER_DID_FARMER
ensure_issuer_did "$ISS_LAND"   "$ISSUER_DID_LAND"   "ISS-LAND"   ISSUER_DID_LAND
ensure_issuer_key "$ISS_FARMER" "${ISSUER_KEY_FARMER:-$ISSUER_DID_FARMER}" ISS-FARMER
ensure_issuer_key "$ISS_LAND"   "${ISSUER_KEY_LAND:-$ISSUER_DID_LAND}"     ISS-LAND

head1 "Memberships"
# Distinct operators per Authority. Neither can read the other's records, and the
# application correlates across them from credentials rather than from access.
ensure_membership "$TENANT_FARMER" FARMER_OPERATOR OPERATOR
ensure_membership "$TENANT_LAND"   LAND_OPERATOR   OPERATOR
# Separation of duties: an OPERATOR may create and submit a record but not approve it.
# Approval requires AUTHORISED_OFFICER or ADMINISTRATOR, so a record cannot be brought into
# force by the same person who entered it. Seeding therefore needs both roles, and they are
# deliberately different subjects — granting one person both would configure the separation
# away while appearing to satisfy it.
ensure_membership "$TENANT_FARMER" FARMER_OFFICER  AUTHORISED_OFFICER
ensure_membership "$TENANT_LAND"   LAND_OFFICER    AUTHORISED_OFFICER


# ensure_profile AUTHORITY_ID BINDING_ID ISSUER_ID CODE NAME CREDENTIAL_TYPE SCHEMA_ID -> id
ensure_profile() {
  local existing
  existing="$(api GET "/credential-profiles?authorityId=$1" | id_by_code "$4")"
  if [ -n "$existing" ]; then
    # Whatever schema this profile was created against is the schema it issues against.
    # credentialSchemaId is deliberately not patchable — changing it would make this a
    # different credential rather than an edit — and profiles cannot be deleted, so there is
    # nothing to converge and nothing useful to do but use it.
    #
    # An earlier version retired a mismatched profile and created a replacement. That is a
    # one-off repair, not a bootstrap step: it fights itself on the next run, because the
    # retired profile still holds the code and the replacement cannot be created.
    info "profile $4 already present"
    printf '%s' "$existing"; return
  fi
  info "profile $4 created"
  api POST /credential-profiles "$(python3 -c '
import json, sys
authority, binding, issuer, code, name, ctype, context, schema_id, vc_context = sys.argv[1:10]
print(json.dumps({
    "authorityId": authority,
    "registryBindingId": binding,
    "issuerId": issuer,
    "code": code,
    "name": name,
    "credentialType": ["VerifiableCredential", ctype],
    "credentialSchemaId": schema_id,
    "credentialSchemaVersion": "1.0.0",
    # claimVocabulary is deliberately unset: every claim is mapped by the context above, and
    # a vocabulary fallback would let an unmapped claim through as a guess.
    "contextUris": [vc_context, context],
}))' "$1" "$2" "$3" "$4" "$5" "$6" "$CONTEXT_URI" "$7" "$VC_CONTEXT_URI")" | field id
}

# map PROFILE_ID JSON — configures one claim. Keyed on the claim, so re-running replaces.
map() {
  api PUT "/credential-profiles/$1/claim-mappings" "$2" >/dev/null
  info "  $(printf '%s' "$2" | python3 -c 'import sys,json;print(json.load(sys.stdin)["targetClaim"])')"
}

# qualified_reference SOURCE_PATH AUTHORITY_BASE RESOURCE_TYPE TARGET -> mapping JSON
qualified_reference() {
  python3 -c '
import json, sys
source, base, rtype, target, jpath = sys.argv[1:6]
print(json.dumps({
    "targetClaim": target,
    "source": "DERIVED",
    "derivation": "QUALIFIED_REFERENCE",
    "sourcePath": source,
    "parameters": {"authorityBase": base, "resourceType": rtype, "jurisdictionPath": jpath},
    "required": True,
}))' "$1" "$2" "$3" "$4" "$JURISDICTION_PATH"
}

direct() {
  python3 -c '
import json, sys
source, target, required = sys.argv[1:4]
print(json.dumps({"targetClaim": target, "source": "DIRECT", "sourcePath": source,
                  "required": required == "true"}))' "$1" "$2" "${3:-true}"
}


# --- credential schemas ----------------------------------------------------------------
# The Authority-issued credentials need their own schemas, and this is a consequence of the
# identifier model rather than a preference.
#
# The existing Agriculture schemas REQUIRE farmerId and landId — the bare local identifiers.
# A credential carrying a bare local number is precisely what the identifier model refuses,
# because two jurisdictions may hold the same one. These schemas require the canonical
# references instead, and carry only the declared minimum: no national identifier, no
# district, no farmer category, no total holding size.
#
# Registered under distinct names because the legacy schemas remain in use by the direct
# issuance path while both coexist, and two schemas with one name under one author cannot be
# told apart afterwards.

# register_schema NAME VCT ID PROPERTIES_JSON REQUIRED_JSON AUTHOR_DID
# schema_in_use AUTHORITY_ID PROFILE_CODE -> the schema an existing profile already uses
#
# Idempotency comes from the profile, not from the schema registry: the registry lists only
# OID4VCI-enabled schemas and these are deliberately not enabled. The profile is in any case
# the thing that records which schema is in use.
schema_in_use() {
  local profile
  profile="$(api GET "/credential-profiles?authorityId=$1" | id_by_code "$2")"
  [ -n "$profile" ] || return 0
  api GET "/credential-profiles/$profile" | field credentialSchemaId
}

register_schema() {
  local name="$1" vct="$2" sid="$3" props="$4" required="$5" author="$6" existing body
  existing="$(curl -fsS --max-time 25 "$SCHEMA_BASE/credential-schema/oid4vci-configs" 2>/dev/null \
    | python3 -c '
import json, sys
want = sys.argv[1]
for c in json.load(sys.stdin):
    if c.get("name") == want:
        print(c.get("schemaId", "")); break
' "$name")"
  if [ -n "$existing" ]; then info "schema $name already registered"; printf '%s' "$existing"; return; fi

  body="$(python3 -c '
import json, sys
name, vct, sid, props, required, author = sys.argv[1:7]
print(json.dumps({
    "schema": {
        "type": "https://w3c-ccg.github.io/vc-json-schemas/",
        "version": "1.0.0",
        "id": sid,
        "name": name,
        "author": author,
        "authored": "2026-01-01T00:00:00.000Z",
        "schema": {
            "$id": sid,
            "$schema": "https://json-schema.org/draft/2019-09/schema",
            "description": name,
            "type": "object",
            "properties": json.loads(props),
            "required": json.loads(required),
            # Must be true: issuance adds credentialSubject.id, which is not one of the
            # schema own claims, and a false here rejects every issuance with an opaque 500.
            "additionalProperties": True,
        },
    },
    "tags": ["agriculture", "authority-service"],
    # PUBLISHED, or the schema exists and is invisible as an issuable credential.
    "status": "PUBLISHED",
    "oid4vciConfig": {
        # FALSE, and this matters. These credentials are issued through the credential
        # service, never offered over OID4VCI. Enabling it makes the schema appear in the
        # OID4VCI metadata of whichever oid4vc issuer shares this author DID, so the Farmer
        # issuer starts advertising two credentials and "each issuer advertises only its own
        # credential" stops being true.
        "oid4vciEnabled": False,
        "oid4vciFormats": ["vc+sd-jwt"],
        "vct": vct,
        "display": [{"name": name, "locale": "en-US"}],
    },
}))' "$name" "$vct" "$sid" "$props" "$required" "$author")"

  # schema.id in the response is the GENERATED did:schema: identifier, not the $id that was
  # submitted. That is the one everything else refers to.
  existing="$(curl -fsS --max-time 30 -X POST "$SCHEMA_BASE/credential-schema" \
    -H 'content-type: application/json' -d "$body" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["schema"]["id"])')" \
    || die "registering schema $name failed"
  case "$existing" in
    did:schema:*) : ;;
    *) die "schema $name did not return a did:schema: identifier (got \"$existing\")" ;;
  esac
  info "schema $name registered"
  printf '%s' "$existing"
}

head1 "Credential schemas"
if [ -z "$ISSUER_DID_FARMER" ] || [ -z "$ISSUER_DID_LAND" ]; then
  warn "No issuer DIDs configured, so schemas are skipped — a schema records its author."
  SCHEMA_FARMER=""; SCHEMA_LAND=""
else
SCHEMA_FARMER="$(register_schema \
  'Farmer Identity Credential (Authority-issued)' farmer-identity-credential-authority \
  FarmerIdentityCredential \
  '{"farmerReference":{"type":"string","description":"Canonical reference to the farmer record held by the Farmer Authority."},"registrationStatus":{"type":"boolean","description":"Whether the Authority lists this person as a registered farmer."}}' \
  '["farmerReference","registrationStatus"]' "$ISSUER_DID_FARMER" \
  "$(schema_in_use "$AUTH_FARMER" "$PROFILE_FARMER_CODE")")"
SCHEMA_LAND="$(register_schema \
  'Land Ownership Credential (Authority-issued)' land-ownership-credential-authority \
  LandOwnershipCredential \
  '{"farmerReference":{"type":"string","description":"Canonical reference to the owning farmer, in the FARMER Authority namespace, so a lender can correlate this credential with the Farmer credential."},"parcelReference":{"type":"string","description":"Canonical reference to the parcel, in the Land Authority namespace."},"ownershipStatus":{"type":"string","description":"ACTIVE, INACTIVE, DISPUTED or TRANSFERRED. Only ACTIVE is fundable."},"cropType":{"type":"string","description":"Controlled vocabulary; the rate is looked up from published policy."},"cultivatedArea":{"type":"number","description":"Cultivated area in acres, the authoritative input to the loan calculation."}}' \
  '["farmerReference","parcelReference","ownershipStatus","cropType","cultivatedArea"]' "$ISSUER_DID_LAND" \
  "$(schema_in_use "$AUTH_LAND" "$PROFILE_LAND_CODE")")"
fi

head1 "Credential profiles"
if [ -z "$ISSUER_DID_FARMER" ] || [ -z "$ISSUER_DID_LAND" ]; then
  warn "No issuer DIDs configured, so profiles are skipped — a canonical reference needs an"
  warn "  authority base, and inventing one would issue a reference that resolves nowhere."
else
  PROFILE_FARMER="$(ensure_profile "$AUTH_FARMER" "$BIND_FARMER" "$ISS_FARMER" \
    "$PROFILE_FARMER_CODE" 'Farmer Identity Credential' FarmerIdentityCredential "$SCHEMA_FARMER")"
  require_id "profile $PROFILE_FARMER_CODE" "$PROFILE_FARMER"
  PROFILE_LAND="$(ensure_profile "$AUTH_LAND" "$BIND_LAND" "$ISS_LAND" \
    "$PROFILE_LAND_CODE" 'Land Ownership Credential' LandOwnershipCredential "$SCHEMA_LAND")"
  require_id "profile $PROFILE_LAND_CODE" "$PROFILE_LAND"

  head1 "Claim mappings"
  info "$PROFILE_FARMER_CODE"
  map "$PROFILE_FARMER" "$(qualified_reference farmerId "$ISSUER_DID_FARMER" farmer farmerReference)"
  map "$PROFILE_FARMER" "$(direct registeredFarmer registrationStatus)"

  info "$PROFILE_LAND_CODE"
  # The farmer reference on the LAND credential is qualified with the FARMER Authority's
  # base. This is the line the whole correlation depends on: qualifying it with the Land
  # Authority's own base produces a well-formed reference that silently never matches the
  # one on the Farmer credential, and nothing anywhere reports an error.
  map "$PROFILE_LAND" "$(qualified_reference farmerId "$ISSUER_DID_FARMER" farmer farmerReference)"
  map "$PROFILE_LAND" "$(qualified_reference landId "$ISSUER_DID_LAND" parcel parcelReference)"
  map "$PROFILE_LAND" "$(direct ownershipStatus ownershipStatus)"
  map "$PROFILE_LAND" "$(direct cropType cropType)"
  map "$PROFILE_LAND" "$(direct cultivatedAreaAcres cultivatedArea)"
  # nationalId, district, landAreaAcres and farmerCategory are deliberately NOT mapped, and
  # could not be even if they were wanted: the published JSON-LD context defines seven terms
  # and is immutable, so a claim outside it does not expand and signing fails in safe mode.
  # Widening the credential means a new context version, not a new claim mapping. They
  # exist in the registry and must not reach a verifier; the loan uses cultivated area only,
  # so total holding size stays with the farmer.
fi

# Everything the issuing services and the verifier need in order to USE what was just
# configured. Written to deploy/.env rather than pasted into a hand-made compose overlay:
# the profile ids are minted here and change on every reset, so a file a human maintains
# is a file that is quietly wrong after the next bootstrap.
if [ -n "$PROFILE_FARMER" ] && [ -n "$PROFILE_LAND" ]; then
  head1 "Wiring"
  ENV_FILE="$ROOT/deploy/.env"
  set_env() {
    touch "$ENV_FILE"
    if grep -qE "^$1=" "$ENV_FILE"; then
      grep -vE "^$1=" "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
    fi
    printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
  }
  set_env AUTHORITY_BASE_URL "http://authority-service:3334"
  set_env AGRI_CLAIM_SOURCE authority
  set_env AUTHORITY_PROFILE_MAP_FARMER "{\"Farmer Identity Credential\":\"$PROFILE_FARMER\"}"
  set_env AUTHORITY_PROFILE_MAP_LAND "{\"Land Ownership Credential\":\"$PROFILE_LAND\"}"
  set_env VERIFIER_TRUST_POLICY_FILE /app/config/trust/issuers.authority.json
  set_env AUTHORITY_ISSUER_FARMER "$ISS_FARMER"
  set_env AUTHORITY_ISSUER_LAND "$ISS_LAND"
  green "profile ids and claim source written to deploy/.env"

  # The verifier's Agriculture trust policy names Farmer and Land by AUTHORITY ISSUER ID
  # rather than by DID, because their keys are resolved from the Authority at boot. Those
  # ids are minted here and change on every reset, so the committed file cannot hold the
  # right ones — it holds the shape, and this writes today's ids into it.
  python3 - "$ROOT/config/trust/issuers.authority.json" "$ISS_FARMER" "$ISS_LAND" <<'TRUST'
import json, sys
path, farmer, land = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path) as handle:
    policy = json.load(handle)
seen = []
for issuer in policy.get("issuers", []):
    if issuer.get("name") == "Farmer Registry":
        issuer["authorityIssuer"] = farmer
        seen.append("Farmer Registry")
    elif issuer.get("name") == "Land Registry":
        issuer["authorityIssuer"] = land
        seen.append("Land Registry")
if len(seen) != 2:
    raise SystemExit(
        "expected Farmer Registry and Land Registry in %s, found %s" % (path, seen)
    )
with open(path, "w") as handle:
    json.dump(policy, handle, indent=2)
    handle.write("\n")
TRUST
  green "config/trust/issuers.authority.json points at this deployment's issuers"
  info "recreate the issuers and the verifier to pick them up:"
  info "  docker compose -f deploy/docker-compose.yml up -d --force-recreate --no-deps \\"
  info "    oid4vc-farmer oid4vc-land verifier"
fi

head1 "Summary"
printf '  tenant    %-16s %s\n' T-AGRI-FARMER "$TENANT_FARMER" T-AGRI-LAND "$TENANT_LAND"
printf '  authority %-16s %s\n' AUTH-FARMER "$AUTH_FARMER" AUTH-LAND "$AUTH_LAND"
printf '  binding   %-16s %s\n' FarmerRecord "$BIND_FARMER" LandRecord "$BIND_LAND"
printf '  issuer    %-16s %s\n' ISS-FARMER "$ISS_FARMER" ISS-LAND "$ISS_LAND"
