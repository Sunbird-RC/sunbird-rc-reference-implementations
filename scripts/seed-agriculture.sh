#!/usr/bin/env bash
# Seeds synthetic FarmerRecord and LandRecord fixtures into the registry.
#
# Idempotent — re-running reports what is already present. Every record is
# invented; there is no real farmer, land parcel or National ID here, and PRODUCT
# forbids real data.
#
# The fixtures are chosen to cover REQUIREMENTS §7 and, between them, every
# branch of the loan decision. Two of them are deliberately INCOMPLETE — a farmer
# with no land record, and a Keycloak account whose National ID has no farmer
# record at all — because "fails safely" is a requirement and cannot be
# demonstrated without a case that fails.
#
# The registry cannot express the one cross-field rule that matters
# (cultivatedAreaAcres <= landAreaAcres), so this script refuses to seed a record
# that breaks it rather than leaving the decision module to meet impossible data.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The registry API is an operator route, served only on the loopback operator
# listener (see deploy/nginx/routes-ops.conf).
BASE="${BASE:-http://127.0.0.1:${OPS_PORT:-8088}}"
REG="$BASE/api/v1"

green() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
info()  { printf '  \033[2m·\033[0m %s\n' "$1"; }
warn()  { printf '  \033[33m!\033[0m %s\n' "$1"; }
die()   { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

for entity in FarmerRecord LandRecord; do
  curl -fksS -o /dev/null --max-time 10 -X POST "$REG/$entity/search" \
    -H 'content-type: application/json' -d '{"filters":{}}' \
    || die "the registry API is not answering at $REG/$entity/search — is the stack up and $entity.json mounted?"
done

# Returns the existing record as JSON, or empty when absent.
fetch_record() {
  local entity="$1" field="$2" value="$3"
  curl -fsS -X POST "$REG/$entity/search" -H 'content-type: application/json' \
    -d "{\"filters\":{\"$field\":{\"eq\":\"$value\"}}}" \
    | python3 -c '
import json, sys
d = json.load(sys.stdin)
rows = d if isinstance(d, list) else d.get("data", [])
print(json.dumps(rows[0]) if rows else "")
'
}

# seed <entity> <key-field> <key-value> <label> <json-body>
#
# Creates when absent, updates in place when the fixture has changed, and says so
# either way. An update matters more than it sounds: a re-run after editing a
# fixture must change the record, or the demo silently keeps telling the old
# story.
seed() {
  local entity="$1" field="$2" value="$3" label="$4" body="$5" existing osid updated
  existing="$(fetch_record "$entity" "$field" "$value")"

  if [ -z "$existing" ]; then
    curl -fsS -X POST "$REG/$entity" -H 'content-type: application/json' -d "$body" >/dev/null \
      || die "creating $entity $value failed"
    green "$value  $label"
    return 0
  fi

  osid="$(printf '%s' "$existing" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("osid",""))')"
  updated="$(python3 -c '
import json, sys
existing, wanted = json.loads(sys.argv[1]), json.loads(sys.argv[2])
# Compare only the fields this fixture declares: the registry adds osid and
# internal metadata, and treating those as drift would rewrite every record on
# every run.
drift = {k: v for k, v in wanted.items() if existing.get(k) != v}
print(json.dumps(drift))
' "$existing" "$body")"

  if [ "$updated" = "{}" ]; then
    info "$value  $label (already present)"
    return 0
  fi
  if [ -z "$osid" ]; then
    warn "$value differs from the fixture but has no osid to update"
    return 0
  fi
  curl -fsS -X PUT "$REG/$entity/$osid" -H 'content-type: application/json' -d "$body" >/dev/null \
    || die "updating $entity $value failed"
  green "$value  $label (updated)"
}

printf '\033[1mSeeding synthetic Agriculture fixtures at %s\033[0m\n' "$REG"

# --- the fixture table -------------------------------------------------------
#
# One line per farmer, so the whole demo's data is readable in one place. The
# generator below turns each into a FarmerRecord and, where the farmer has land,
# a LandRecord — and refuses anything that breaks the acreage rule.
#
#   nationalId | farmerId | registered | category | district | landId | ownership | total | crop | cultivated | label
FIXTURES="$(cat <<'ROWS'
NAT-90018472|FRM-KA-0041|true |Small     |Mysuru   |LAND-MYS-820137|ACTIVE  |6.5|PADDY    |4   |eligible: paddy, 4 acres -> ₹1,20,000
NAT-90023815|FRM-PB-0117|true |SemiMedium|Ludhiana |LAND-LDH-450922|ACTIVE  |4  |WHEAT    |2.5 |eligible: wheat, 2.5 acres -> ₹1,00,000
NAT-90031164|FRM-KA-0058|true |Marginal  |Mysuru   |LAND-MYS-820455|INACTIVE|3  |PADDY    |3   |not eligible: ownership is not ACTIVE
NAT-90042093|FRM-MH-0203|true |Medium    |Nagpur   |LAND-NAG-771208|ACTIVE  |8  |MILLET   |5   |not eligible: crop outside the lending policy
NAT-90066021|FRM-KA-0088|false|Small     |Mysuru   |LAND-MYS-830611|ACTIVE  |5  |SUGARCANE|2   |not eligible: not a registered farmer
NAT-90055010|FRM-KA-0072|true |Small     |Mysuru   |-              |-       |-  |-        |-   |fails safely: farmer with no land record
ROWS
)"

printf '\n  Farmer Registry\n'
printf '%s\n' "$FIXTURES" | while IFS='|' read -r nat fid reg cat dist land own total crop cult label; do
  [ -z "${nat// /}" ] && continue
  body="$(python3 -c '
import json, sys
nat, fid, reg, cat, dist = (a.strip() for a in sys.argv[1:6])
print(json.dumps({
    "farmerId": fid,
    "nationalId": nat,
    "registeredFarmer": reg == "true",
    "farmerCategory": cat,
    "district": dist,
    "state": {"Mysuru": "Karnataka", "Ludhiana": "Punjab", "Nagpur": "Maharashtra"}.get(dist, "Karnataka"),
}))
' "$nat" "$fid" "$reg" "$cat" "$dist")"
  seed FarmerRecord farmerId "$(printf '%s' "$fid" | tr -d ' ')" "$(printf '%s' "$label" | sed 's/^ *//')" "$body"
done

printf '\n  Land Registry\n'
printf '%s\n' "$FIXTURES" | while IFS='|' read -r nat fid reg cat dist land own total crop cult label; do
  [ -z "${nat// /}" ] && continue
  land="$(printf '%s' "$land" | tr -d ' ')"
  [ "$land" = "-" ] && { info "$(printf '%s' "$fid" | tr -d ' ')  no land record, on purpose"; continue; }
  body="$(python3 -c '
import json, sys
land, nat, fid, own, total, crop, cult, dist = (a.strip() for a in sys.argv[1:9])
total_f, cult_f = float(total), float(cult)
# The rule the registry schema cannot express. Seeding data the decision module
# could never legitimately receive would make a passing test meaningless.
if not 0 <= cult_f <= total_f:
    raise SystemExit(f"fixture {land}: cultivated {cult_f} is not within 0..{total_f} acres")
if round(cult_f, 2) != cult_f:
    raise SystemExit(f"fixture {land}: cultivated {cult_f} has more than two decimals")
print(json.dumps({
    "landId": land,
    "nationalId": nat,
    "farmerId": fid,
    "ownershipStatus": own,
    "landAreaAcres": total_f,
    "cropType": crop,
    "cultivatedAreaAcres": cult_f,
    "district": dist,
    "state": {"Mysuru": "Karnataka", "Ludhiana": "Punjab", "Nagpur": "Maharashtra"}.get(dist, "Karnataka"),
}))
' "$land" "$nat" "$fid" "$own" "$total" "$crop" "$cult" "$dist")" \
    || die "fixture $land is invalid — see the message above"
  seed LandRecord landId "$land" "$(printf '%s' "$label" | sed 's/^ *//')" "$body"
done

# NAT-90099999 (farmer.norecord) is deliberately absent from both registries: an
# authenticated National ID with no record anywhere is how "fails safely" is
# demonstrated rather than asserted.
printf '\n'
info "NAT-90099999 has no record in either registry, on purpose"

FARMERS="$(curl -fsS -X POST "$REG/FarmerRecord/search" -H 'content-type: application/json' -d '{"filters":{}}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d if isinstance(d,list) else d.get("data",[])))')"
LANDS="$(curl -fsS -X POST "$REG/LandRecord/search" -H 'content-type: application/json' -d '{"filters":{}}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d if isinstance(d,list) else d.get("data",[])))')"
printf '  %s FarmerRecord and %s LandRecord fixture(s) in the registry\n' "$FARMERS" "$LANDS"
