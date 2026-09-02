#!/usr/bin/env bash
# Runs the suites against a REMOTE deployment and writes headed captures.
#
# This exists because the same sequence has now been needed three times and was
# fumbled twice in ways that cost real time:
#
#   * seed-age-citizens.sh reads BASE, not OPS_URL, so `OPS_URL=... ./seed...`
#     silently re-seeded the LOCAL stack and reported success.
#   * the remote deploy/.env carries its own OID4VC_IMAGE, which overrides the
#     compose default, so bumping the tag in docker-compose.yml recreated the
#     services on the OLD image and they reported healthy while doing it.
#
# Both are checked here rather than remembered.
#
# Nothing about the host is hardcoded: the address, ssh key, and remote deploy
# directory are inputs, because those are operational details this repository
# deliberately does not record. Secrets are read from the remote .env into the
# environment of this process only, and are never written to disk.
#
#   DEMO_HOST=user@1.2.3.4 \
#   DEMO_SSH_KEY=~/.ssh/key.pem \
#   DEMO_DIR=/home/user/age-demo \
#   DEMO_ORIGIN=https://1.2.3.4.sslip.io \
#     ./scripts/capture-demo-runs.sh [--expect-image c8beec27]
#
# Writes docs/evidence/03-education/runs/*-deployment.txt.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

HOST="${DEMO_HOST:?set DEMO_HOST, e.g. user@host}"
KEY="${DEMO_SSH_KEY:?set DEMO_SSH_KEY to the ssh private key path}"
DIR="${DEMO_DIR:?set DEMO_DIR to the remote deploy directory}"
ORIGIN="${DEMO_ORIGIN:?set DEMO_ORIGIN, e.g. https://host.sslip.io}"
OPS_PORT="${DEMO_OPS_PORT:-8090}"
EXPECT_IMAGE=""
[ "${1:-}" = "--expect-image" ] && EXPECT_IMAGE="${2:?--expect-image needs a value}"

OUT="docs/evidence/03-education/runs"
# ServerAliveInterval is not decoration: an earlier capture lost its tunnel
# mid-run and produced forty spurious `fetch failed` errors that read exactly
# like test failures.
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=6)

say() { printf '\033[1m%s\033[0m\n' "$1"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

say "1. reaching the host"
"${SSH[@]}" "$HOST" 'echo ok' >/dev/null 2>&1 || die \
  "ssh to $HOST failed. Port 22 is commonly restricted to one source network on
   this sandbox while 80/443 stay open, so check the network rule against your
   current address before assuming the host is down."

say "2. what the deployment actually runs"
running="$("${SSH[@]}" "$HOST" \
  "docker inspect sunbird-rc-age-oid4vc-school-1 --format '{{.Config.Image}}'" 2>/dev/null || true)"
[ -n "$running" ] || die "could not read the running oid4vc image"
echo "   $running"
if [ -n "$EXPECT_IMAGE" ] && ! printf '%s' "$running" | grep -q "$EXPECT_IMAGE"; then
  die "the deployment runs '$running', not '$EXPECT_IMAGE'.
   Check OID4VC_IMAGE in the REMOTE $DIR/.env — it overrides the compose default,
   and a stale value there recreates the services on the old image while they
   still report healthy."
fi

say "3. operator tunnel on 127.0.0.1:$OPS_PORT"
pkill -f "$OPS_PORT:127.0.0.1:8088" 2>/dev/null || true
"${SSH[@]}" -f -N -L "$OPS_PORT:127.0.0.1:8088" "$HOST"
trap 'pkill -f "$OPS_PORT:127.0.0.1:8088" 2>/dev/null || true' EXIT
sleep 3
curl -fsS -o /dev/null --max-time 10 "http://127.0.0.1:$OPS_PORT/health" \
  || die "the tunnel is up but the operator endpoint did not answer"

# Read into this process only. Never echoed, never written to a file: verify.sh
# asserts no password of any shape we have used is committed.
val() { "${SSH[@]}" "$HOST" "grep -E \"^$1=\" $DIR/.env | cut -d= -f2- | tr -d '\r' | tail -1"; }
export BASE="$ORIGIN" PUBLIC_URL="$ORIGIN" OPS_URL="http://127.0.0.1:$OPS_PORT"
export AGE_ISSUER_DID="$(val AGE_ISSUER_DID)"
export VERIFIER_DID="$(val VERIFIER_DID)"
export UNTRUSTED_ISSUER_DID="$(val UNTRUSTED_ISSUER_DID)"
export DEMO_CITIZEN_PASSWORD="$(val DEMO_CITIZEN_PASSWORD)"
[ -n "$AGE_ISSUER_DID" ] && [ -n "$DEMO_CITIZEN_PASSWORD" ] \
  || die "could not read AGE_ISSUER_DID / DEMO_CITIZEN_PASSWORD from $DIR/.env"

say "4. refreshing the boundary fixtures"
# BASE, not OPS_URL: seed-age-citizens.sh addresses the registry through the
# operator listener and reads BASE. Passing OPS_URL instead silently seeds
# whatever is on localhost — which is how the local stack got re-seeded while
# this script's author believed the remote had been.
BASE="http://127.0.0.1:$OPS_PORT" ./scripts/seed-age-citizens.sh | tail -4

header() {
  cat <<EOF
# Captured run — $1
#
# Command      $2
# Environment  the PUBLIC demo deployment over HTTPS, $ORIGIN
#              oid4vc services on $running
# Branch       $(git rev-parse --abbrev-ref HEAD)
# Commit       $(git rev-parse HEAD)$( [ -n "$(git status --porcelain)" ] && echo '   (WORKING TREE DIRTY)' || echo '   (clean working tree)')
# Node         $(node --version)
# Captured     $(date -u '+%Y-%m-%d %H:%M UTC')

=== output ===
EOF
}

# Keycloak's realm sets failureFactor 20 / waitIncrementSeconds 30, so several
# suites driven through the same demo accounts inside a few minutes trip a
# temporary lockout. It surfaces as "Keycloak refused the advertised scope ...
# login not accepted (HTTP 200)" in Flow 1 and is the protection working, not a
# defect — so the suites are spaced rather than run back to back.
run() {
  local name="$1" cmd="$2"; shift 2
  say "5. $name"
  header "$name" "$cmd" > "$OUT/$name"
  if "$@" >> "$OUT/$name" 2>&1; then
    printf '   \033[32m✓\033[0m %s\n' "$(grep -E '^# pass|^  [0-9]+ passed' "$OUT/$name" | tail -1)"
  else
    printf '   \033[31m✗ failures — see %s\033[0m\n' "$OUT/$name"
  fi
  sleep "${DEMO_SPACING:-45}"
}

run test-unit-deployment.txt "npm run test:unit" npm run test:unit
run test-e2e-deployment.txt "npm run test:e2e" npm run test:e2e
run regression-01-02-deployment.txt \
  "node --test tests/e2e/{age-verification,flow1-wallet-issuance,agriculture,flow2-agriculture-issuance,algorithm-policy,data-isolation}.test.mjs" \
  node --test tests/e2e/age-verification.test.mjs tests/e2e/flow1-wallet-issuance.test.mjs \
       tests/e2e/agriculture.test.mjs tests/e2e/flow2-agriculture-issuance.test.mjs \
       tests/e2e/algorithm-policy.test.mjs tests/e2e/data-isolation.test.mjs
run verify-deployment.txt "./scripts/verify.sh --no-tests" ./scripts/verify.sh --no-tests

say "done — captures in $OUT"
grep -HE '^# pass|^# fail|^  [0-9]+ passed' "$OUT"/*-deployment.txt | sed 's|.*/||'
