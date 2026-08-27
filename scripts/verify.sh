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
check "working tree clean (ignoring node_modules)" '[ -z "$(git status --porcelain | grep -vE "^\?\? ([^ ]*/)?node_modules")" ]'

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
gone "nginx no longer routes /issuer/" 'grep -q "location /issuer/" deploy/nginx/routes.conf'
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
  # Anand's showcase note: only the real credential may appear in a customer-facing
  # issuer directory. The negative fixture is provisioned by the tests that need
  # it and retired again, so a clean stack advertises exactly one.
  check "exactly ONE credential is advertised to wallets" 'curl -s --max-time 8 $BASE/.well-known/openid-credential-issuer | python3 -c "import json,sys; raise SystemExit(0 if len(json.load(sys.stdin)[\"credential_configurations_supported\"])==1 else 1)"'

  # The wallet's trust screen renders these. A trusted entity whose logo 404s
  # shows a placeholder, which reads as a half-configured issuer on a demo.
  check "the wallet trust logos are served" 'for l in national-identity-authority age-check; do curl -sf --max-time 8 -o /dev/null "$BASE/assets/logos/$l.png" || exit 1; done'
  gone "no unlisted-issuer credential in the directory" 'curl -s --max-time 8 $BASE/.well-known/openid-credential-issuer | grep -qi unlisted'
else
  skip "running-stack checks" "stack not up at $BASE — cd deploy && docker compose up -d"
fi

head_ '7. Gateway exposure (public deployment)'
check "routes are split by audience" '[ -f deploy/nginx/routes-citizen.conf ] && [ -f deploy/nginx/routes-ops.conf ] && [ -f deploy/nginx/routes-denied.conf ]'
check "the public listeners serve citizen routes plus refusals" 'grep -q "routes-citizen.conf" deploy/nginx/nginx.conf && grep -q "routes-denied.conf" deploy/nginx/nginx.conf && grep -q "routes-denied.conf" deploy/nginx/nginx-tls.conf'
check "operator routes are served ONLY on the loopback listener" '! grep -q "routes-ops.conf" <(awk "/listen 80;/,/^}/" deploy/nginx/nginx.conf) && grep -q "routes-ops.conf" <(awk "/listen 8088;/,/^}/" deploy/nginx/nginx.conf)'
check "the operator listener is published on 127.0.0.1 only" 'grep -q "127.0.0.1:8088:8088" deploy/docker-compose.yml && grep -q "127.0.0.1:8088:8088" deploy/docker-compose.tls.yml'
for route in "/api/issuer/" "/api/v1" "/registry/" "/credential-schema" "/credentials" "/did" "/utils" "/auth/admin"; do
  check "operator-only: $route" "grep -q \"location $route\" deploy/nginx/routes-ops.conf && ! grep -q \"location $route \" deploy/nginx/routes-citizen.conf"
done
# These sit UNDER wallet-facing prefixes, so omission is not enough - they must
# be refused explicitly or the broader prefix serves them.
for route in "/oid4vc/offer" "/vp/request" "/vp/status" "/auth/admin"; do
  check "refused on public listeners: $route" "grep -q \"$route\" deploy/nginx/routes-denied.conf"
done
check "the TLS overlay exists and mounts the certificate read-only" 'grep -q "/etc/letsencrypt:/etc/letsencrypt:ro" deploy/docker-compose.tls.yml'
check "setup scripts use the operator listener, not the public origin" 'grep -q "127.0.0.1:\$OPS_PORT" scripts/bootstrap.sh && grep -q "127.0.0.1:\${OPS_PORT:-8088}" scripts/seed-age-citizens.sh'
check "the suites know where operator endpoints live" 'grep -q "export function opsBase" tests/e2e/lib/stack.mjs'
check "Keycloak brute-force protection is on in the realm" 'python3 -c "import json;raise SystemExit(0 if json.load(open(\"deploy/keycloak/realm-age.json\"))[\"bruteForceProtected\"] else 1)"'
check "the realm does not interrupt first sign-in with a profile form" 'python3 -c "import json;r=json.load(open(\"deploy/keycloak/realm-age.json\"));raise SystemExit(0 if all(not a[\"enabled\"] for a in r[\"requiredActions\"] if a[\"alias\"]==\"VERIFY_PROFILE\") else 1)"'
check "bootstrap rotates Keycloak's default admin password" 'grep -q "rotated the Keycloak admin password" scripts/bootstrap.sh'
check "schemas store the vct as a slug, so type metadata resolves" 'grep -q "VCT_SLUG" scripts/bootstrap.sh'
check "a DID from another origin is never reused" 'grep -q "was minted under another host" scripts/bootstrap.sh'
check "enabling https is a script, not a runbook" '[ -x scripts/enable-https.sh ]'
check "a refusal is distinguished from a verification failure" 'grep -q "declined" services/verifier/src/server.mjs && grep -q "REFUSAL_SIGNATURES" services/verifier/src/core/checks.mjs'
check "the page renders a refusal without a failure verdict" 'grep -q "NO DATA SHARED" services/verifier-web/app.js && grep -q "decision.neutral" services/web-assets/styles.css'
check "a cancelled check is enforced server-side, not just labelled" 'grep -q "sessions/:id/cancel\|abandoned" services/verifier/src/server.mjs && grep -q "cancel" services/verifier-mobile/App.js'
check "the negative fixture is owned by the tests, not bootstrap" 'grep -q "ensureNegativeFixture" tests/e2e/lib/stack.mjs && ! grep -q "create_schema .Age Verification Credential (unlisted" scripts/bootstrap.sh'
check "the installed mobile verifier exists and calls the shared service" '[ -f services/verifier-mobile/App.js ] && grep -q "api/verifier/sessions" services/verifier-mobile/App.js'
gone "the mobile verifier does not verify anything itself" 'grep -qiE "jose|sd-jwt|verifyJwt|createHash" services/verifier-mobile/App.js'

head_ '8. Data model matches the approved design'
# A generated .env silently overrides both the compose default and env.example.
# That is exactly how the registry ended up still pointing at a per-domain
# database after the design changed to one shared database - it started, failed
# to connect, and reported only "database age does not exist" deep in a pool log.
check "deploy/.env points the registry at the shared database" 'grep -q "^AGE_REGISTRY_JDBC=jdbc:postgresql://db:5432/registry$" deploy/.env'
gone "no per-use-case database remains" 'docker compose -f deploy/docker-compose.yml exec -T db psql -U postgres -At -c "select datname from pg_database" 2>/dev/null | grep -qxE "age|agriculture|education"'

head_ '9. Fork: the prepared oid4vc-service port'
if [ -d "$FORK/.git" ]; then
  check "fork main is untouched (== origin/main)" 'git -C "$FORK" rev-parse main | grep -q "$(git -C "$FORK" rev-parse origin/main)"'
  check "fork main sits on the v2.1.0 tag" 'git -C "$FORK" rev-parse main | grep -q "$(git -C "$FORK" rev-parse v2.1.0)"'
  # Exact count on purpose: the port is meant to stay narrow, so an unexplained
  # extra commit should show up here rather than in review. Raise it deliberately
  # when the port legitimately grows.
  check "port branch is 4 commits off v2.1.0 (port, alg, narrowing, issuer display)" '[ "$(git -C "$FORK" log --oneline v2.1.0..oid4vc-keycloak-as-v2.1.0 | wc -l | tr -d " ")" = "4" ]'
  check "ported image is built" 'docker images -q sunbird-rc-oid4vc-service:v2.1.0-authcode.4889fbdb | grep -q .'
  check "the ported build is pinned by source commit in its tag" 'grep -qE "sunbird-rc-oid4vc-service:v2.1.0-authcode\.[0-9a-f]{7,}" deploy/docker-compose.yml'
else
  skip "fork checks" "no checkout at $FORK — set SUNBIRD_RC_CORE_PATH"
fi

head_ '10. Committed secrets'
# These used to live inside the fork section above, which meant a checkout
# without the sibling fork skipped them silently. They have nothing to do with
# the fork, and they cover ~500 more files now that the wallet is vendored.
#
# Takes the ACTUAL generated secret and proves it appears in no tracked file. The
# first version grepped for a pattern and matched its own pattern string in this
# file - a check that fails for the wrong reason is barely better than no check.
check "the generated demo password is absent from every tracked file" 'PW=$(grep "^DEMO_CITIZEN_PASSWORD=" deploy/.env 2>/dev/null | cut -d= -f2); test -z "$PW" || ! git ls-files -z | xargs -0 grep -l -- "$PW" 2>/dev/null | grep -q .'
gone "the realm import carries no credentials" 'grep -q "\"credentials\"" deploy/keycloak/realm-age.json'
# The check above tests the LOCAL .env value, so a password set on a different
# host slips through - and one did: `abcd@123` reached a tracked document because
# the local .env still held an older generated value. This is the backstop: the
# shapes of demo password we have actually used, denied outright.
gone "no demo password of any known shape is committed" 'git ls-files -z | xargs -0 grep -lE "abcd@123|demo-[0-9a-f]{10}|kcadmin-[0-9a-f]{12}" 2>/dev/null | grep -v "^scripts/verify.sh$" | grep -q .'

head_ '11. The vendored wallet'
W=vendor/paradym-wallet
check "the wallet is vendored, not a sibling checkout" '[ -f $W/apps/wallet/src/constants.ts ]'
gone  "no wallet .git came along" '[ -e $W/.git ]'
check "upstream's Apache-2.0 licence is retained" 'grep -q "Apache License" $W/LICENSE && grep -q "Apache License" $W/packages/sdk/LICENSE'
check "NOTICE states that files were modified, and by whom" 'grep -q "were modified for the Sunbird RC" $W/NOTICE && grep -q "Animo Solutions" $W/NOTICE'
check "the change index names the upstream commit we forked from" 'grep -q "2d68168" $W/SUNBIRD-CHANGES.md'
# Vendoring must not smuggle in generated or signed material. git archive only
# emits tracked blobs, so these assert the import stayed that way.
gone "no Expo prebuild output is tracked" 'git ls-files $W | grep -qE "/(android|ios)/"'
gone "no build output, APK or keystore is tracked" 'git ls-files $W | grep -qE "node_modules/|\.(apk|aab|keystore|jks|p12|jsbundle)$"'
# Keeps the secret greps above scanning source rather than a 77 MB binary.
check "the vendored tree stays source-only (under 20 MB tracked)" '[ "$(git ls-files -z $W | xargs -0 du -ck 2>/dev/null | tail -1 | cut -f1)" -lt 20480 ]'
# Someone running `eas build` here would build against another organisation's
# Expo project and App Store listing.
# Excluding the change index, which names these identifiers precisely because it
# records their removal. The same trap the demo-password check fell into once.
gone "Animo's release identity is not carried" 'git ls-files -z $W | xargs -0 grep -lE "b5f457fa-bcab-4c6e-8092-8cdf1239027a|ascAppId|owner: .animo-id." 2>/dev/null | grep -v "SUNBIRD-CHANGES.md" | grep -q .'
check "building the wallet is a script, not a runbook" '[ -x scripts/build-wallet.sh ]'
check "the importer is re-runnable for the next upstream bump" '[ -x scripts/vendor-wallet.sh ]'

# The wallet's trust entries are build-time constants compiled into an APK, so a
# re-bootstrap mints a new verifier DID and the installed wallet silently reverts
# to "Organization not verified" with nothing in any log to say why. That failure
# is invisible until someone points a phone at a QR, on camera.
C="$W/apps/wallet/src/constants.ts"
# Env first, deploy/.env second — the same override the e2e suite takes, so this
# can be pointed at the deployment the APK was actually built for rather than
# only at whatever stack this checkout last bootstrapped.
VDID="${VERIFIER_DID:-}"; PURL="${PUBLIC_URL:-}"
if [ -z "$VDID$PURL" ] && [ -f deploy/.env ]; then
  VDID="$(grep '^VERIFIER_DID=' deploy/.env | cut -d= -f2-)"
  PURL="$(grep '^PUBLIC_URL=' deploy/.env | cut -d= -f2-)"
fi
if [ -n "$PURL" ]; then
  # The host the wallet was built for, taken from the logo URLs, which only this
  # repository serves. A local .env legitimately describes a different deployment
  # from the one the installed APK targets, and comparing the two then reports a
  # failure that says nothing about the code - so compare only when they agree.
  WHOST="$(grep -oE 'https://[^/]+/assets/logos/' "$C" | head -1 | sed -E 's|https://||; s|/assets/logos/||')"
  EHOST="$(printf '%s' "$PURL" | sed -E 's|^https?://||; s|/.*$||')"
  if [ -n "$WHOST" ] && [ "$WHOST" = "$EHOST" ]; then
    check "the wallet pins THIS deployment's verifier DID" 'test -n "$VDID" && grep -q "$VDID" "$C"'
    check "the wallet pins THIS deployment's issuer origin" 'grep -q "$PURL" "$C"'
  else
    skip "wallet trust pinning" "the wallet is built for ${WHOST:-an unknown host}; this deploy/.env describes ${EHOST:-nothing}"
  fi
else
  skip "wallet trust pinning" "no PUBLIC_URL in the environment or deploy/.env"
fi

# Drift: when the fork is still around, every vendored blob must match it apart
# from the files the adaptation commit deliberately changed. Compares object
# hashes, so this is content equality and not a file listing.
WFORK="${WALLET_FORK_PATH:-$ROOT/../paradym-wallet}"
if [ -d "$WFORK/.git" ]; then
  # No `exit` in a check body: check() evals in the current shell, so an exit here
  # terminates verify.sh and every later check is silently skipped. Ask instead
  # whether the filtered difference is empty.
  ADAPTED="NOTICE|SUNBIRD-CHANGES\.md|apps/wallet/(app\.config\.js|base\.app\.config\.js|eas\.json)"
  # ls-tree --format rather than awk: an awk program written inside a string that
  # check() later evals loses its \$3 to the shell, and awk then fails with a
  # syntax error the check reports as drift that does not exist.
  check "the vendored copy matches the fork, apart from the recorded adaptation" \
    '[ -z "$(diff <(git -C "$WFORK" ls-tree -r --format="%(objectname) %(path)" cbe9407 | sort) <(git ls-tree -r --format="%(objectname) %(path)" "HEAD:$W" | sort) | grep -E "^[<>]" | grep -vE "($ADAPTED)$")" ]'
else
  skip "wallet drift vs the fork" "no checkout at $WFORK - set WALLET_FORK_PATH"
fi

head_ '12. Test suites'
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
cat <<'JOURNEYS'
  The charter's three journeys, and exactly how far each is evidenced. A green
  run above proves the stack; it does not by itself prove a journey, because a
  journey has to be seen on the real applications.

  Flow 1  authenticated wallet-driven issuance, no QR
          RUN ON A REAL DEVICE (Samsung SM-A055F, Android 15): the wallet listed
          the issuer, signed the citizen in at Keycloak, and fetched the
          credential. Covered end to end by tests/e2e/flow1-wallet-issuance.test.mjs,
          including the credential scope a real wallet actually asks for, and
          recorded for the demo video, including a cold-restart persistence
          take: swiped out of recents, restarted, same card and issue date.
  Flow 2  cross-device web QR — RUN ON A REAL DEVICE, laptop verifier page and
          phone wallet, with APPROVED, DENIED and the neutral NO DATA SHARED all
          recorded. Cancellation is enforced server side, not drawn by the page.
  Flow 3  same-device deep link from an INSTALLED mobile verifier app —
          services/verifier-mobile is built and installed (package
          id.sunbird.ageverifier), the round trip has been run on the device,
          and both outcomes are recorded with the return to the app on screen:
          APPROVED for the adult, DENIED for the minor.

  Trust identity: the wallet names the issuer and the verifier instead of
  reporting an unknown organization, confirmed on the device and on camera. This
  needed a fix in the wallet fork's SDK, not only configuration — see
  docs/design/COMPATIBILITY.md. A refusal now also reaches the verifier from the
  wallet itself, so NO DATA SHARED appears within about two seconds without
  anyone cancelling the check.

  Evidence for a reviewer: docs/evidence/01-age/README.md, the line-by-line
  status in docs/evidence/01-age/VALIDATION.md, and captured runs under
  docs/evidence/01-age/runs/.
JOURNEYS

head_ 'Summary'
printf '  %s passed, %s failed, %s skipped\n' "$PASS" "$FAIL" "$SKIP"
if [ "$FAIL" -gt 0 ]; then
  printf '  RESULT: something regressed — see the FAIL lines above.\n'
  exit 1
fi
printf '  RESULT: the deployment is intact. See the journeys above for what is evidenced on real devices and what is still missing.\n'
