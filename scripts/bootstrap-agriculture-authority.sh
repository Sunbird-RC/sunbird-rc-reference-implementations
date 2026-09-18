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

# Issuer DIDs. Unset by default: a DID is an environment fact, and the demo stack cannot
# produce a usable one (see the guard below). Set these to publicly resolvable did:web
# values to complete issuer configuration.
ISSUER_DID_FARMER="${ISSUER_DID_FARMER:-}"
ISSUER_DID_LAND="${ISSUER_DID_LAND:-}"
ISSUER_KEY_ALGORITHM="${ISSUER_KEY_ALGORITHM:-Ed25519}"
# Key references default to the issuer DID: the usual case is a DID that resolves to its own
# verification method. Set these only if the signing key is published somewhere else.
ISSUER_KEY_FARMER="${ISSUER_KEY_FARMER:-}"
ISSUER_KEY_LAND="${ISSUER_KEY_LAND:-}"
ISSUER_KEY_ID="${ISSUER_KEY_ID:-key-0}"

# Where the JSON-LD context document is fetched from. The permanent identifier is
# https://w3id.org/sunbird-rc/agriculture/v1; until that redirect is live, development points
# at the same immutable document on a CDN. Credentials issued against anything other than the
# permanent identifier are development fixtures, not interoperability evidence.
CONTEXT_URI="${CONTEXT_URI:-https://cdn.jsdelivr.net/gh/pallakartheekreddy/sunbird-rc-reference-implementations@2eec9cb87845f19e27cf33c4decbf9d39f876c38/contexts/agriculture/v1/context.jsonld}"
# The jurisdiction a canonical reference is qualified by, read from the record.
JURISDICTION_PATH="${JURISDICTION_PATH:-state}"

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
  curl -sS --max-time 25 -X PATCH "$API/issuers/$issuer_id" \
    -H "x-dev-issuer: $BOOT_ISSUER" -H "x-dev-subject: $BOOT_SUBJECT" \
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
ensure_membership "$TENANT_FARMER" "$FARMER_OPERATOR" OPERATOR
ensure_membership "$TENANT_LAND"   "$LAND_OPERATOR"   OPERATOR
# Separation of duties: an OPERATOR may create and submit a record but not approve it.
# Approval requires AUTHORISED_OFFICER or ADMINISTRATOR, so a record cannot be brought into
# force by the same person who entered it. Seeding therefore needs both roles, and they are
# deliberately different subjects — granting one person both would configure the separation
# away while appearing to satisfy it.
ensure_membership "$TENANT_FARMER" "$FARMER_OFFICER"  AUTHORISED_OFFICER
ensure_membership "$TENANT_LAND"   "$LAND_OFFICER"    AUTHORISED_OFFICER


# ensure_profile AUTHORITY_ID BINDING_ID ISSUER_ID CODE NAME CREDENTIAL_TYPE -> id
ensure_profile() {
  local existing
  existing="$(api GET "/credential-profiles?authorityId=$1" | id_by_code "$4")"
  if [ -n "$existing" ]; then info "profile $4 already present"; printf '%s' "$existing"; return; fi
  info "profile $4 created"
  api POST /credential-profiles "$(python3 -c '
import json, sys
authority, binding, issuer, code, name, ctype, context = sys.argv[1:8]
print(json.dumps({
    "authorityId": authority,
    "registryBindingId": binding,
    "issuerId": issuer,
    "code": code,
    "name": name,
    "credentialType": ["VerifiableCredential", ctype],
    "credentialSchemaId": code.lower(),
    "credentialSchemaVersion": "1.0.0",
    # claimVocabulary is deliberately unset: every claim is mapped by the context above, and
    # a vocabulary fallback would let an unmapped claim through as a guess.
    "contextUris": [context],
}))' "$1" "$2" "$3" "$4" "$5" "$6" "$CONTEXT_URI")" | field id
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

head1 "Credential profiles"
if [ -z "$ISSUER_DID_FARMER" ] || [ -z "$ISSUER_DID_LAND" ]; then
  warn "No issuer DIDs configured, so profiles are skipped — a canonical reference needs an"
  warn "  authority base, and inventing one would issue a reference that resolves nowhere."
else
  PROFILE_FARMER="$(ensure_profile "$AUTH_FARMER" "$BIND_FARMER" "$ISS_FARMER" \
    P-FARMER 'Farmer Identity Credential' FarmerIdentityCredential)"
  require_id "profile P-FARMER" "$PROFILE_FARMER"
  PROFILE_LAND="$(ensure_profile "$AUTH_LAND" "$BIND_LAND" "$ISS_LAND" \
    P-LAND 'Land Ownership Credential' LandOwnershipCredential)"
  require_id "profile P-LAND" "$PROFILE_LAND"

  head1 "Claim mappings"
  info "P-FARMER"
  map "$PROFILE_FARMER" "$(qualified_reference farmerId "$ISSUER_DID_FARMER" farmer farmerReference)"
  map "$PROFILE_FARMER" "$(direct registeredFarmer registrationStatus)"

  info "P-LAND"
  # The farmer reference on the LAND credential is qualified with the FARMER Authority's
  # base. This is the line the whole correlation depends on: qualifying it with the Land
  # Authority's own base produces a well-formed reference that silently never matches the
  # one on the Farmer credential, and nothing anywhere reports an error.
  map "$PROFILE_LAND" "$(qualified_reference farmerId "$ISSUER_DID_FARMER" farmer farmerReference)"
  map "$PROFILE_LAND" "$(qualified_reference landId "$ISSUER_DID_LAND" parcel parcelReference)"
  map "$PROFILE_LAND" "$(direct ownershipStatus ownershipStatus)"
  map "$PROFILE_LAND" "$(direct cropType cropType)"
  map "$PROFILE_LAND" "$(direct cultivatedAreaAcres cultivatedArea)"
  # nationalId, district, landAreaAcres and farmerCategory are deliberately NOT mapped. They
  # exist in the registry and must not reach a verifier; the loan uses cultivated area only,
  # so total holding size stays with the farmer.
fi

head1 "Summary"
printf '  tenant    %-16s %s\n' T-AGRI-FARMER "$TENANT_FARMER" T-AGRI-LAND "$TENANT_LAND"
printf '  authority %-16s %s\n' AUTH-FARMER "$AUTH_FARMER" AUTH-LAND "$AUTH_LAND"
printf '  binding   %-16s %s\n' FarmerRecord "$BIND_FARMER" LandRecord "$BIND_LAND"
printf '  issuer    %-16s %s\n' ISS-FARMER "$ISS_FARMER" ISS-LAND "$ISS_LAND"
