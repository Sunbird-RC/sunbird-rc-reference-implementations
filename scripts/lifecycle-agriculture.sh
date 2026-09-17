#!/usr/bin/env bash
# Moves one Agriculture record through its lifecycle, and shows what changed.
#
#   scripts/lifecycle-agriculture.sh suspend   FRM-KA-0041
#   scripts/lifecycle-agriculture.sh reinstate FRM-KA-0041
#   scripts/lifecycle-agriculture.sh retire    LAND-MYS-820137
#   scripts/lifecycle-agriculture.sh show      FRM-KA-0041
#
# This is the half of the central journey that the application cannot reach on its own: the
# record is not publicly visible, which is the boundary the managed Registry exists to hold.
# A verifier learns about it only through the credential's public status.
#
# Suspension is reversible and inactivation is not. `retire` is named for what it does
# rather than mirroring the API's INACTIVE, because "inactive" reads like a synonym for
# "suspended" and it is the one transition here that cannot be undone.
set -euo pipefail

BASE="${AUTHORITY_URL:-http://localhost:3334}"
API="$BASE/api/v1"
MEMBER_ISSUER="${MEMBER_ISSUER:-https://idp.test}"
BOOT_SUBJECT="${BOOTSTRAP_SUBJECT:-bootstrap}"
# Lifecycle transitions are an officer's decision, not an operator's.
FARMER_OFFICER="${FARMER_OFFICER:-agri-farmer-officer}"
LAND_OFFICER="${LAND_OFFICER:-agri-land-officer}"

green() { printf '  \033[32m✓\033[0m %s\n' "$1" >&2; }
info()  { printf '  \033[2m·\033[0m %s\n' "$1" >&2; }
die()   { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

usage() { sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }
[ $# -eq 2 ] || usage
ACTION="$1"; LOCAL_ID="$2"

call() {
  local subject="$1" method="$2" path="$3" body="${4:-}"
  local args=(-sS --max-time 45 -X "$method" "$API$path"
              -H "x-dev-issuer: $MEMBER_ISSUER" -H "x-dev-subject: $subject"
              -H 'Content-Type: application/json' -w '\n%{http_code}')
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}
ok() {
  local out status
  out="$(call "$@")" || die "$2 $3 — could not reach $BASE"
  status="${out##*$'\n'}"
  case "$status" in
    2*) printf '%s' "${out%$'\n'*}" ;;
    *)  die "$2 $3 -> $status: $(printf '%s' "${out%$'\n'*}" | head -c 200)" ;;
  esac
}

# Which registry a local id belongs to is readable from the id itself, and guessing wrong
# would suspend the wrong record. FRM- is a farmer, LAND- is a parcel.
case "$LOCAL_ID" in
  FRM-*)  AUTH_CODE=AUTH-FARMER; ENTITY=FarmerRecord; FIELD=farmerId; OFFICER="$FARMER_OFFICER" ;;
  LAND-*) AUTH_CODE=AUTH-LAND;   ENTITY=LandRecord;   FIELD=landId;   OFFICER="$LAND_OFFICER" ;;
  *) die "cannot tell which registry \"$LOCAL_ID\" belongs to — expected FRM-… or LAND-…" ;;
esac

case "$ACTION" in
  suspend)   STATE=SUSPENDED; REASON="suspended for review" ;;
  reinstate) STATE=ACTIVE;    REASON="reinstated after review" ;;
  retire)    STATE=INACTIVE;  REASON="retired permanently" ;;
  show)      STATE=""; REASON="" ;;
  *) die "unknown action \"$ACTION\"" ;;
esac

AUTHORITY_ID="$(ok "$BOOT_SUBJECT" GET /authorities | python3 -c '
import sys, json
want = sys.argv[1]
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get("items", [])
print(next((a["id"] for a in items if a.get("code") == want), ""))
' "$AUTH_CODE")"
[ -n "$AUTHORITY_ID" ] || die "$AUTH_CODE is not configured — run the bootstrap first"

BINDING="$(ok "$BOOT_SUBJECT" GET "/authorities/$AUTHORITY_ID/registries" | python3 -c '
import sys, json
want = sys.argv[1]
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get("items", [])
print(next((b["id"] for b in items if b.get("entityName") == want), ""))
' "$ENTITY")"
[ -n "$BINDING" ] || die "$ENTITY has no registry binding"

state_of() {
  ok "$OFFICER" POST "/registries/$BINDING/records/search" \
    "$(printf '{"filters":{"%s":{"eq":"%s"}}}' "$FIELD" "$LOCAL_ID")" | python3 -c '
import sys, json
rows = json.load(sys.stdin).get("data", [])
if not rows:
    print("")
else:
    s = rows[0].get("authorityState") or {}
    print(f'"'"'{rows[0]["osid"]} {s.get("workflowState")} {s.get("lifecycleState")}'"'"')
'
}

# Records are found through the search index, which trails writes by a second or two. A
# record seeded a moment ago is really there and really not findable yet, so absence is
# only believed after polling. Observed directly: a lifecycle call issued immediately after
# a create reported the record missing, and the same call succeeded seconds later. Bounded
# rather than a fixed sleep, which would encode an idle machine's timing and then report
# load instead of behaviour.
BEFORE=""
DEADLINE=$(( $(date +%s) + 20 ))
while :; do
  BEFORE="$(state_of)"
  [ -n "$BEFORE" ] && break
  [ "$(date +%s)" -ge "$DEADLINE" ] && break
  info "waiting for $LOCAL_ID to appear in the index…"
  sleep 1
done
[ -n "$BEFORE" ] || die "$LOCAL_ID is not in $ENTITY (waited 20s for the index)"
read -r OSID WF LC <<<"$BEFORE"

if [ "$ACTION" = show ]; then
  printf '  %s  workflow=%s lifecycle=%s\n' "$LOCAL_ID" "$WF" "$LC"
  exit 0
fi

info "$LOCAL_ID  workflow=$WF lifecycle=$LC"
[ "$LC" = "INACTIVE" ] && die "$LOCAL_ID is INACTIVE, which is terminal — it cannot be $ACTION-ed"
[ "$LC" = "$STATE" ] && { info "already $STATE, nothing to do"; exit 0; }

ok "$OFFICER" POST "/registries/$BINDING/records/$OSID/lifecycle" \
  "$(printf '{"state":"%s","reason":"%s"}' "$STATE" "$REASON")" >/dev/null

read -r _ WF2 LC2 <<<"$(state_of)"
green "$LOCAL_ID  workflow=$WF2 lifecycle=$LC2"

cat >&2 <<NOTE

  The record has moved. Whether a verifier sees that depends on the credential's derived
  status, which reads the record's lifecycle alongside the issuance state — so this is only
  half the journey until credentials can be issued against these records.
NOTE
