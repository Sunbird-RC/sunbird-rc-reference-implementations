#!/usr/bin/env bash
# Seeds the Agriculture fixtures through the Authority Service.
#
# Replaces the write path of seed-agriculture.sh, which posted straight to Sunbird RC. The
# fixtures themselves are unchanged and deliberately so: they are the accepted Iteration 02
# baseline, they cover every branch of the loan decision, and changing the data while
# changing the path would make a regression indistinguishable from a fixture edit.
#
# The difference is that records now arrive in a state. Each one is created by an OPERATOR,
# submitted, and approved by an AUTHORISED_OFFICER — a different subject, because approval
# by the person who entered the record is exactly what separation of duties forbids. A
# record only reaches lifecycle ACTIVE by being approved, and that is what later lets it be
# suspended and reinstated.
#
# Every record here is invented. There is no real farmer, parcel or National ID.
#
# Idempotent: each fixture is looked up by its unique field first.
set -euo pipefail

BASE="${AUTHORITY_URL:-http://localhost:3334}"
API="$BASE/api/v1"
BOOT_ISSUER="${BOOTSTRAP_ISSUER:-https://idp.test}"
BOOT_SUBJECT="${BOOTSTRAP_SUBJECT:-bootstrap}"
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

# call SUBJECT METHOD PATH [BODY] -> body on stdout, status appended after a newline.
call() {
  local subject="$1" method="$2" path="$3" body="${4:-}"
  local args=(-sS --max-time 45 -X "$method" "$API$path"
              -H "x-dev-issuer: $MEMBER_ISSUER" -H "x-dev-subject: $subject"
              -H 'Content-Type: application/json' -w '\n%{http_code}')
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}

# ok SUBJECT METHOD PATH [BODY] -> body; any non-2xx is fatal.
ok() {
  local out status
  out="$(call "$@")" || die "$2 $3 — could not reach $BASE"
  status="${out##*$'\n'}"
  case "$status" in
    2*) printf '%s' "${out%$'\n'*}" ;;
    *)  die "$2 $3 -> $status: $(printf '%s' "${out%$'\n'*}" | head -c 200)" ;;
  esac
}

pyget() { python3 -c "$1" "${@:2}"; }

command -v python3 >/dev/null || die "python3 is required"
curl -sS --max-time 10 "$BASE/health" >/dev/null 2>&1 \
  || die "Authority Service is not answering at $BASE (set AUTHORITY_URL)"

# --- discover the topology -------------------------------------------------------------
# By code, not by id. Ids change every time the stack is reset, and a seed script that has
# to be edited after a reset will be run with stale ids sooner or later.
head1 "Topology"
AUTHORITIES="$(ok "$BOOT_SUBJECT" GET /authorities)"
authority_id() {
  printf '%s' "$AUTHORITIES" | pyget '
import sys, json
want = sys.argv[1]
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get("items", [])
print(next((a["id"] for a in items if a.get("code") == want), ""))
' "$1"
}
AUTH_FARMER="$(authority_id AUTH-FARMER)"
AUTH_LAND="$(authority_id AUTH-LAND)"
[ -n "$AUTH_FARMER" ] && [ -n "$AUTH_LAND" ] \
  || die "AUTH-FARMER and AUTH-LAND are not configured — run scripts/bootstrap-agriculture-authority.sh first"

binding_id() {
  ok "$BOOT_SUBJECT" GET "/authorities/$1/registries" | pyget '
import sys, json
want = sys.argv[1]
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get("items", [])
print(next((b["id"] for b in items if b.get("entityName") == want), ""))
' "$2"
}
BIND_FARMER="$(binding_id "$AUTH_FARMER" FarmerRecord)"
BIND_LAND="$(binding_id "$AUTH_LAND" LandRecord)"
[ -n "$BIND_FARMER" ] && [ -n "$BIND_LAND" ] || die "registry bindings are missing — re-run the bootstrap"
green "FarmerRecord and LandRecord bindings resolved"

# --- one record, all the way through ---------------------------------------------------
# find BINDING OPERATOR FIELD VALUE -> "osid workflowState", or empty if absent.
#
# The state matters as much as the existence. A record that exists is not necessarily a
# record that is usable: an earlier run interrupted between create and approve leaves a
# DRAFT, and treating "present" as "done" would skip it forever while reporting success.
# Found the hard way — a hand-created record stayed DRAFT through a clean-looking seed.
find_record() {
  ok "$2" POST "/registries/$1/records/search" \
    "$(printf '{"filters":{"%s":{"eq":"%s"}}}' "$3" "$4")" \
  | pyget '
import sys, json
rows = json.load(sys.stdin).get("data", [])
if rows:
    state = (rows[0].get("authorityState") or {}).get("workflowState") or "DRAFT"
    print(rows[0]["osid"], state)
'
}

# seed BINDING OPERATOR OFFICER FIELD VALUE LABEL BODY
seed() {
  local binding="$1" operator="$2" officer="$3" field="$4" value="$5" label="$6" body="$7"
  local found osid state verb

  found="$(find_record "$binding" "$operator" "$field" "$value")"
  osid="${found%% *}"; state="${found##* }"

  if [ -z "$osid" ]; then
    osid="$(ok "$operator" POST "/registries/$binding/records" "$body" | pyget '
import sys, json
try:
    print(json.load(sys.stdin)["osid"])
except Exception:
    pass')"
    # `ok` calls die on a non-2xx, but this runs inside $(), where exit ends only the
    # subshell. Without this check the empty result flows onward and the failure surfaces
    # as a JSON parse error several lines later, describing nothing useful.
    case "$osid" in
      ?*) : ;;
      *) die "$value could not be created — see the response above" ;;
    esac
    state=DRAFT; verb="$label"
  elif [ "$state" = "APPROVED" ]; then
    # Present and approved, but possibly written before a field existed. Converge it: a seed
    # that only ever creates cannot repair its own earlier output, and the alternative is
    # asking someone to wipe a stack to add one field.
    ok "$operator" PUT "/registries/$binding/records/$osid" "$body" >/dev/null
    info "$value  already approved, record converged"
    return
  else
    verb="resumed from $state"
  fi

  [ "$state" = "DRAFT" ] \
    && ok "$operator" POST "/registries/$binding/records/$osid/submit" '{"reason":"seed"}' >/dev/null
  # Approved by a different subject. The service enforces this; approving as the operator
  # would simply fail, which is the point of the separation rather than an inconvenience.
  ok "$officer" POST "/registries/$binding/records/$osid/approve" '{"reason":"seed"}' >/dev/null
  green "$value  $verb"
}

# --- fixtures --------------------------------------------------------------------------
# The same six people as seed-agriculture.sh, with the same identifiers, because this script
# REPLACES that one for Agriculture rather than running beside it.
#
# It has to replace rather than coexist. Sunbird RC indexes farmerId AND nationalId as
# unique, so the Authority cannot manage a record for a holder the direct path already
# seeded. A wallet signs in as that holder, so the Authority is the one that must own the
# record: run both and the demo users' records sit outside the Authority Service, where no
# credential can be issued through it and no status can be asked about them.
#
# `state` is the jurisdiction the canonical reference is qualified by, and is per fixture
# rather than one value for the file, so two farmers in different states produce references
# that cannot collide even if their local numbers ever did.
FIXTURES='
NAT-90018472|FRM-KA-0041|true |Small     |Mysuru   |Karnataka  |LAND-MYS-820137|ACTIVE  |6.5|PADDY    |4   |eligible: paddy, 4 acres
NAT-90023815|FRM-PB-0117|true |SemiMedium|Ludhiana |Punjab     |LAND-LDH-450922|ACTIVE  |4  |WHEAT    |2.5 |eligible: wheat, 2.5 acres
NAT-90031164|FRM-KA-0058|true |Marginal  |Mysuru   |Karnataka  |LAND-MYS-820455|INACTIVE|3  |PADDY    |3   |not eligible: ownership is not ACTIVE
NAT-90042093|FRM-MH-0203|true |Medium    |Nagpur   |Maharashtra|LAND-NAG-771208|ACTIVE  |8  |MILLET   |5   |not eligible: crop outside the lending policy
NAT-90066021|FRM-KA-0088|false|Small     |Mysuru   |Karnataka  |LAND-MYS-830611|ACTIVE  |5  |SUGARCANE|2   |not eligible: not a registered farmer
NAT-90055010|FRM-KA-0072|true |Small     |Mysuru   |Karnataka  |-              |-       |-  |-        |-   |fails safely: farmer with no land record
NAT-90077001|FRM-KA-0901|true |Small     |Mysuru   |Karnataka  |LAND-MYS-900101|ACTIVE  |6  |PADDY    |4   |reserved: the inactivation case
NAT-90077002|FRM-KA-0902|true |Small     |Mysuru   |Karnataka  |LAND-MYS-900102|ACTIVE  |6  |PADDY    |4   |reserved: the revocation case
'

head1 "Farmer records  (tenant T-AGRI-FARMER)"
printf '%s\n' "$FIXTURES" | while IFS='|' read -r nat fid reg cat dist st land own total crop cult label; do
  [ -z "${fid// /}" ] && continue
  fid="${fid// /}"; nat="${nat// /}"; reg="${reg// /}"
  body="$(python3 -c '
import json, sys
fid, nat, reg, cat, dist, state = (a.strip() for a in sys.argv[1:7])
print(json.dumps({"record": {
    "farmerId": fid,
    "nationalId": nat,
    "registeredFarmer": reg == "true",
    "farmerCategory": cat,
    "district": dist,
    # The jurisdiction the canonical reference is qualified by. Without it the reference
    # cannot be built, and a profile that requires one refuses to issue rather than
    # quietly dropping the claim.
    "state": state,
}}))' "$fid" "$nat" "$reg" "$cat" "$dist" "$st")"
  seed "$BIND_FARMER" "$FARMER_OPERATOR" "$FARMER_OFFICER" farmerId "$fid" "$(echo "$label" | sed 's/^ *//')" "$body"
done

head1 "Land records  (tenant T-AGRI-LAND)"
printf '%s\n' "$FIXTURES" | while IFS='|' read -r nat fid reg cat dist st land own total crop cult label; do
  [ -z "${fid// /}" ] && continue
  land="${land// /}"
  [ "$land" = "-" ] && { info "${fid// /}  no land record, on purpose"; continue; }
  # The registry cannot express cultivatedAreaAcres <= landAreaAcres, so the fixture is
  # refused here rather than left for the decision module to meet impossible data.
  body="$(python3 -c '
import json, sys
land, nat, fid, own, total, crop, cult, dist, state = (a.strip() for a in sys.argv[1:10])
total_f, cult_f = float(total), float(cult)
if not 0 <= cult_f <= total_f:
    raise SystemExit(f"fixture {land}: cultivated {cult_f} is not within 0..{total_f} acres")
if round(cult_f, 2) != cult_f:
    raise SystemExit(f"fixture {land}: cultivated {cult_f} has more than two decimals")
print(json.dumps({"record": {
    "landId": land,
    "nationalId": nat,
    "farmerId": fid,
    "ownershipStatus": own,
    "landAreaAcres": total_f,
    "cropType": crop,
    "cultivatedAreaAcres": cult_f,
    "district": dist,
    "state": state,
}}))' "$land" "$nat" "${fid// /}" "$own" "$total" "$crop" "$cult" "$dist" "$st")" \
    || die "fixture $land is invalid — see the message above"
  seed "$BIND_LAND" "$LAND_OPERATOR" "$LAND_OFFICER" landId "$land" "$(echo "$label" | sed 's/^ *//')" "$body"
done

head1 "Result"
count() {
  ok "$2" POST "/registries/$1/records/search" '{"limit":100}' | python3 -c '
import sys, json
rows = json.load(sys.stdin)["data"]
states = {}
for r in rows:
    s = r.get("authorityState") or {}
    key = f'"'"'{s.get("workflowState")}/{s.get("lifecycleState")}'"'"'
    states[key] = states.get(key, 0) + 1
print(f'"'"'{len(rows)} record(s)  '"'"' + ", ".join(f'"'"'{k}: {v}'"'"' for k, v in sorted(states.items())))
'
}
printf '  FarmerRecord  %s\n' "$(count "$BIND_FARMER" "$FARMER_OPERATOR")"
printf '  LandRecord    %s\n' "$(count "$BIND_LAND" "$LAND_OPERATOR")"
