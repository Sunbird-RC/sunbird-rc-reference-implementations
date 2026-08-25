#!/usr/bin/env bash
# One command that answers "what is actually done?" for Iteration 01.
#
#   ./scripts/verify.sh              repo + fork state, and the test suites
#   ./scripts/verify.sh --no-tests   skip the suites (fast, ~5 seconds)
#
# It checks CLAIMS, not vibes: every line below either passes or fails, and the
# last section lists what is deliberately NOT done, so a green run can never be
# mistaken for "the iteration is complete".
#
# Plain text, no colour: this output gets pasted into evidence.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORK="${SUNBIRD_RC_CORE_PATH:-$ROOT/../sunbird-rc-core}"
BASE="${BASE:-http://localhost}"
RUN_TESTS=1
[ "${1:-}" = "--no-tests" ] && RUN_TESTS=0

cd "$ROOT"
PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); printf '  PASS  %s\n' "$1"; }
no()   { FAIL=$((FAIL+1)); printf '  FAIL  %s\n' "$1"; }
skip() { SKIP=$((SKIP+1)); printf '  SKIP  %s  (%s)\n' "$1" "$2"; }
head_() { printf '\n%s\n' "$1"; }
check() { if eval "$2" >/dev/null 2>&1; then ok "$1"; else no "$1"; fi; }
# Inverted check: passes when the thing is ABSENT.
gone()  { if eval "$2" >/dev/null 2>&1; then no "$1"; else ok "$1"; fi; }

printf 'Iteration 01 verification — %s\n' "$(date -u '+%Y-%m-%d %H:%M UTC')"
printf 'repo: %s\nfork: %s\n' "$ROOT" "$FORK"

head_ '1. Branch and working tree'
check "on iteration/age-01-verification" '[ "$(git branch --show-current)" = "iteration/age-01-verification" ]'
check "working tree clean (ignoring node_modules)" '[ -z "$(git status --porcelain | grep -v "^?? node_modules")" ]'

head_ '2. Revised baseline is the authoritative input'
check "CLAUDE.md carries the scripted-client rule" 'grep -q "scripted protocol client" CLAUDE.md'
check "CLAUDE.md forbids substituting a QR/issuer page" 'grep -q "Do not substitute a QR or issuer web page" CLAUDE.md'
check "charter is the revised, three-journey one" 'grep -q "Do not use a QR code for issuance" iterations/01-age/CHARTER.md'
check "review feedback is on the branch" '[ -f docs/reviews/ITERATION-01-FEEDBACK.md ]'

head_ '3. Branch hygiene (review item)'
gone "docs/start/CLAUDE-START.md removed" '[ -f docs/start/CLAUDE-START.md ]'
gone "docs/start/KARTHEEK-START.md removed" '[ -f docs/start/KARTHEEK-START.md ]'
gone "no handshake files tracked by git" '[ -n "$(git ls-files docs/start)" ]'
gone "README has no dangling handshake links" 'grep -q "docs/start" README.md'

head_ '4. Rejected work removed (review item)'
gone "services/issuer-web deleted" '[ -d services/issuer-web ]'
gone "compose no longer mounts it" 'grep -q "issuer-web" deploy/docker-compose.yml'
gone "nginx no longer routes /issuer/" 'grep -q "location /issuer/" deploy/nginx/nginx.conf'
gone "age-issuer dropped the QR dependency" 'grep -q "qrcode-svg" services/age-issuer/package.json'
gone "verifier page no longer prints wallet.sh" 'grep -q "wallet.sh" services/verifier-web/app.js'

head_ '5. Escalation and plan'
check "escalation raised for the Flow 1 gap" '[ -f docs/reviews/ESCALATION-01-oid4vc-authorization-code.md ]'
check "escalation records the Age-database deviation" 'grep -q "Age database deviation" docs/reviews/ESCALATION-01-oid4vc-authorization-code.md'
check "implementation plan reflects Anand's answers" 'grep -q "Decisions now settled" iterations/01-age/IMPLEMENTATION.md'
check "his answers are on the branch" '[ -f docs/reviews/ANSWERS-01-age-from-anand.md ]'
check "escalation is marked resolved" 'grep -q "RESOLVED, 25 August 2026" docs/reviews/ESCALATION-01-oid4vc-authorization-code.md'

head_ '6. Running stack reflects the removals'
if curl -fsS -o /dev/null --max-time 5 "$BASE/gateway-health" 2>/dev/null; then
  check "/issuer/ is gone (404)" '[ "$(curl -s -o /dev/null -w %{http_code} --max-time 8 $BASE/issuer/)" = "404" ]'
  check "/api/issuer/citizens is gone (404)" '[ "$(curl -s -o /dev/null -w %{http_code} --max-time 8 $BASE/api/issuer/citizens)" = "404" ]'
  check "/verifier/ still serves (200)" '[ "$(curl -s -o /dev/null -w %{http_code} --max-time 8 $BASE/verifier/)" = "200" ]'
  gone "issuer response carries no rendered QR" 'curl -s --max-time 10 -X POST $BASE/api/issuer/offers -H "content-type: application/json" -d "{\"citizenId\":\"AGE-000001\"}" | grep -q qrSvg'
  # Adoption of the ported build is now the approved state (answer 1), so the
  # check is no longer "is it unadopted" but "is exactly one service off the
  # official baseline, and is it the pinned build we tested".
  check "oid4vc-service runs the PINNED ported build" 'docker inspect sunbird-rc-age-oid4vc-service-1 --format "{{.Config.Image}}" | grep -q "v2.1.0-authcode\."'
  check "every other Sunbird service still runs an official ghcr image" 'test "$(for c in registry identity credential credential-schema; do docker inspect sunbird-rc-age-$c-1 --format "{{.Config.Image}}" 2>/dev/null; done | grep -cv "^ghcr.io/sunbird-rc/")" = "0"'
  check "Keycloak is serving the age realm" '[ "$(curl -s -o /dev/null -w %{http_code} --max-time 8 $BASE/auth/realms/age/.well-known/openid-configuration)" = "200" ]'
  check "issuer advertises Keycloak first, itself second" 'curl -s --max-time 8 $BASE/.well-known/openid-credential-issuer | python3 -c "import json,sys; a=json.load(sys.stdin)[\"authorization_servers\"]; raise SystemExit(0 if len(a)==2 and \"/realms/age\" in a[0] else 1)"'
  check "issuer names itself, so a wallet issuer list is readable" 'curl -s --max-time 8 $BASE/.well-known/openid-credential-issuer | python3 -c "import json,sys; d=json.load(sys.stdin); raise SystemExit(0 if (d.get(\"display\") or [{}])[0].get(\"name\") else 1)"'
else
  skip "running-stack checks" "stack not up at $BASE — cd deploy && docker compose up -d"
fi

head_ '7. Data model matches the approved design'
# A generated .env silently overrides both the compose default and env.example.
# That is exactly how the registry ended up still pointing at a per-domain
# database after the design changed to one shared database - it started, failed
# to connect, and reported only "database age does not exist" deep in a pool log.
check "deploy/.env points the registry at the shared database" 'grep -q "^AGE_REGISTRY_JDBC=jdbc:postgresql://db:5432/registry$" deploy/.env'
gone "no per-use-case database remains" 'docker compose -f deploy/docker-compose.yml exec -T db psql -U postgres -At -c "select datname from pg_database" 2>/dev/null | grep -qxE "age|agriculture|education"'

head_ '8. Fork: the prepared oid4vc-service port'
if [ -d "$FORK/.git" ]; then
  check "fork main is untouched (== origin/main)" 'git -C "$FORK" rev-parse main | grep -q "$(git -C "$FORK" rev-parse origin/main)"'
  check "fork main sits on the v2.1.0 tag" 'git -C "$FORK" rev-parse main | grep -q "$(git -C "$FORK" rev-parse v2.1.0)"'
  # Exact count on purpose: the port is meant to stay narrow, so an unexplained
  # extra commit should show up here rather than in review. Raise it deliberately
  # when the port legitimately grows.
  check "port branch is 4 commits off v2.1.0 (port, alg, narrowing, issuer display)" '[ "$(git -C "$FORK" log --oneline v2.1.0..oid4vc-keycloak-as-v2.1.0 | wc -l | tr -d " ")" = "4" ]'
  check "ported image is built" 'docker images -q sunbird-rc-oid4vc-service:v2.1.0-authcode.4889fbdb | grep -q .'
  check "the ported build is pinned by source commit in its tag" 'grep -qE "sunbird-rc-oid4vc-service:v2.1.0-authcode\.[0-9a-f]{7,}" deploy/docker-compose.yml'
  # Takes the ACTUAL generated secret and proves it appears in no tracked file.
  # The first version of this check grepped for a pattern and matched its own
  # pattern string in this file - a check that fails for the wrong reason is
  # barely better than no check.
  check "the generated demo password is absent from every tracked file" 'PW=$(grep "^DEMO_CITIZEN_PASSWORD=" deploy/.env 2>/dev/null | cut -d= -f2); test -z "$PW" || ! git ls-files -z | xargs -0 grep -l -- "$PW" 2>/dev/null | grep -q .'
  gone "the realm import carries no credentials" 'grep -q "\"credentials\"" deploy/keycloak/realm-age.json'
else
  skip "fork checks" "no checkout at $FORK — set SUNBIRD_RC_CORE_PATH"
fi

head_ '9. Test suites'
if [ "$RUN_TESTS" = "1" ]; then
  if npm run --silent test:unit >/tmp/verify-unit.log 2>&1; then
    ok "unit: $(grep -E '^. pass' /tmp/verify-unit.log | tail -1 | tr -s ' ')"
  else
    no "unit suite (see /tmp/verify-unit.log)"
  fi
  if curl -fsS -o /dev/null --max-time 5 "$BASE/gateway-health" 2>/dev/null; then
    if npm run --silent test:e2e >/tmp/verify-e2e.log 2>&1; then
      ok "e2e: $(grep -E '^. pass' /tmp/verify-e2e.log | tail -1 | tr -s ' ')"
    else
      no "e2e suite (see /tmp/verify-e2e.log)"
    fi
  else
    skip "e2e suite" "stack not up"
  fi
  if [ -d "$FORK/services/oid4vc-service/node_modules" ]; then
    if (cd "$FORK/services/oid4vc-service" && npx jest --silent >/tmp/verify-fork.log 2>&1); then
      ok "fork port branch: $(grep -E '^Tests:' /tmp/verify-fork.log | tr -s ' ')"
    else
      no "fork suite (see /tmp/verify-fork.log)"
    fi
  else
    skip "fork suite" "dependencies not installed in the fork"
  fi
else
  skip "test suites" "--no-tests"
fi

head_ 'NOT DONE — the three mandatory journeys'
cat <<'NOTDONE'
  These are the charter's acceptance criteria and NONE is demonstrated. A green
  run above does not mean the iteration is complete.

  Flow 1  authenticated wallet-driven issuance, no QR
          SERVER SIDE READY: Keycloak is the authorization server, the signed-in
          citizen resolves to their own record, and the issuer names itself for a
          wallet's issuer list. NEVER YET RUN WITH A REAL WALLET - which is the
          only thing that counts as acceptance.
  Flow 2  cross-device web QR — protocol works, but the REAL WALLET consent
          screen has never been captured
  Flow 3  same-device mobile verifier by deep link — does not exist yet

  Also outstanding: the wallet build pointed at this stack, an installed mobile
  verifier app for Flow 3, and the real-device recordings that are now the
  required form of evidence (answer 6).
NOTDONE

head_ 'Summary'
printf '  %s passed, %s failed, %s skipped\n' "$PASS" "$FAIL" "$SKIP"
if [ "$FAIL" -gt 0 ]; then
  printf '  RESULT: something regressed — see the FAIL lines above.\n'
  exit 1
fi
printf '  RESULT: Step 0 and the prepared port are intact. The three journeys are still to build.\n'
