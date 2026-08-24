#!/usr/bin/env bash
# Seeds synthetic AgeCitizen records into the registry.
#
# Idempotent — re-running reports what is already present. Every record is
# invented; there is no real person here, and PRODUCT forbids real data.
#
# Two kinds of fixture, deliberately:
#
#   * Fixed dates of birth for the main cases, so the demo tells the same story
#     every time it is run.
#   * COMPUTED dates for the two boundary cases. "Turns 18 today" cannot be
#     expressed as a constant — a fixed date drifts into "turned 18 years ago"
#     and stops testing the boundary at all. The property is what must be
#     repeatable, not the literal value. Exact-boundary arithmetic is also
#     covered with frozen dates in tests/unit/age-claims.test.mjs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/deploy/.env"
envval() { { grep -E "^$1=" "$ENV_FILE" 2>/dev/null || true; } | cut -d= -f2- | tr -d '\r' | tail -1; }

BASE="${BASE:-$(envval PUBLIC_URL)}"
: "${BASE:=http://localhost}"
REG="$BASE/api/v1"

green() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
info()  { printf '  \033[2m·\033[0m %s\n' "$1"; }
die()   { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

curl -fksS -o /dev/null --max-time 10 -X POST "$REG/AgeCitizen/search" \
  -H 'content-type: application/json' -d '{"filters":{}}' \
  || die "the registry API is not answering at $REG/AgeCitizen/search — is the stack up and AgeCitizen.json mounted?"

# Boundary dates, computed against today in UTC so they mean the same thing
# wherever this runs.
TURNS_18_TODAY="$(python3 -c "
from datetime import date
t = date.today()
print(date(t.year - 18, t.month, t.day).isoformat())
")"
TURNS_18_TOMORROW="$(python3 -c "
from datetime import date, timedelta
t = date.today() + timedelta(days=1)
print(date(t.year - 18, t.month, t.day).isoformat())
")"

seed() {
  local citizen_id="$1" body="$2" label="$3" found
  found="$(curl -fsS -X POST "$REG/AgeCitizen/search" -H 'content-type: application/json' \
    -d "{\"filters\":{\"citizenId\":{\"eq\":\"$citizen_id\"}}}" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d if isinstance(d,list) else d.get("data",[])))')"
  if [ "$found" != "0" ]; then info "$citizen_id already present"; return 0; fi
  curl -fsS -X POST "$REG/AgeCitizen" -H 'content-type: application/json' -d "$body" >/dev/null \
    && green "$label" || die "seeding $citizen_id failed"
}

printf '\033[1mSeeding synthetic AgeCitizen records at %s\033[0m\n' "$REG"

seed AGE-000001 \
  '{"citizenId":"AGE-000001","name":"Meera Nair","dateOfBirth":"1998-04-02","gender":"Female","district":"Ernakulam","state":"Kerala"}' \
  'AGE-000001 Meera Nair — adult, expects APPROVED'

# A minor on purpose. ageOver18 must be present and FALSE, not missing: the
# verifier has to reach a verified DENIED rather than fail verification.
seed AGE-000002 \
  '{"citizenId":"AGE-000002","name":"Arjun Das","dateOfBirth":"2012-08-30","gender":"Male","district":"Kozhikode","state":"Kerala"}' \
  'AGE-000002 Arjun Das — minor, expects DENIED'

seed AGE-000003 \
  "{\"citizenId\":\"AGE-000003\",\"name\":\"Nikhil Rao\",\"dateOfBirth\":\"$TURNS_18_TODAY\",\"gender\":\"Male\",\"district\":\"Dharwad\",\"state\":\"Karnataka\"}" \
  "AGE-000003 Nikhil Rao — turns 18 TODAY ($TURNS_18_TODAY), expects APPROVED"

seed AGE-000004 \
  "{\"citizenId\":\"AGE-000004\",\"name\":\"Sana Iqbal\",\"dateOfBirth\":\"$TURNS_18_TOMORROW\",\"gender\":\"Female\",\"district\":\"Hyderabad\",\"state\":\"Telangana\"}" \
  "AGE-000004 Sana Iqbal — turns 18 TOMORROW ($TURNS_18_TOMORROW), expects DENIED"

# Born on a leap day: the derivation compares calendar fields, so 29 February
# must not shift by a day or resolve to "no birthday this year".
seed AGE-000005 \
  '{"citizenId":"AGE-000005","name":"Leela Menon","dateOfBirth":"1996-02-29","gender":"Female","district":"Thrissur","state":"Kerala"}' \
  'AGE-000005 Leela Menon — leap-day date of birth, expects APPROVED'

TOTAL="$(curl -fsS -X POST "$REG/AgeCitizen/search" -H 'content-type: application/json' -d '{"filters":{}}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d if isinstance(d,list) else d.get("data",[])))')"
printf '\n  %s AgeCitizen record(s) in the registry\n' "$TOTAL"
