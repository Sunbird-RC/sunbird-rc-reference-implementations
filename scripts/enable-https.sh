#!/usr/bin/env bash
# Puts the stack behind a real Let's Encrypt certificate.
#
#   ./scripts/enable-https.sh 135.235.192.9.sslip.io
#   ./scripts/enable-https.sh my.host.example  ops@example.org
#
# WHY this exists at all: `did:web` mandates https, so over plain HTTP our
# issuer's identifier only resolves for a client that has been told to relax
# that rule. A real wallet is entitled not to. HTTPS removes the whole question,
# and it is also where the citizen types their password.
#
# WHY sslip.io: it resolves <anything>.<ip>.sslip.io to that IP, with no DNS to
# own, which is enough for Let's Encrypt's HTTP-01 challenge to succeed against
# a bare cloud VM. Nothing in the stack depends on sslip.io — any hostname that
# resolves to this machine works.
#
# It is safe to re-run: an existing, still-valid certificate is left alone.
#
# AFTER this script the public origin has CHANGED, and that origin is baked into
# the issuer DID and the credential type. Anything issued under the old origin
# stops verifying, so the script ends by telling you to re-bootstrap rather than
# pretending the switch is transparent.
set -euo pipefail

HOST="${1:-}"
EMAIL="${2:-${LE_EMAIL:-}}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY="$ROOT/deploy"
COMPOSE=(docker compose -f "$DEPLOY/docker-compose.yml")
TLS_COMPOSE=(docker compose -f "$DEPLOY/docker-compose.yml" -f "$DEPLOY/docker-compose.tls.yml")
CERTBOT_IMAGE="${CERTBOT_IMAGE:-certbot/certbot:v3.1.0}"
WEBROOT=/var/www/certbot

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m  %s\033[0m\n' "$*"; }
info()  { printf '  %s\n' "$*"; }
say()   { printf '\n\033[1m%s\033[0m\n' "$*"; }
die()   { red "ERROR: $*"; exit 1; }

[ -n "$HOST" ] || die "usage: $0 <hostname> [email]
  the hostname must already resolve to THIS machine — e.g. <ip>.sslip.io"

case "$HOST" in
  *:*) die "a hostname, not a URL and no port: $HOST" ;;
  http*) die "a hostname, not a URL: $HOST" ;;
esac

say "1. Checks"
command -v docker >/dev/null || die "docker is required"
[ "$(id -u)" = 0 ] || sudo -n true 2>/dev/null || info "sudo may prompt: certbot writes to /etc/letsencrypt"

# Resolution is checked from HERE, which is not proof of what Let's Encrypt sees,
# but it catches the common typo before an ACME failure counts against a rate
# limit.
resolved="$(getent hosts "$HOST" 2>/dev/null | awk '{print $1; exit}' || true)"
[ -n "$resolved" ] || die "$HOST does not resolve"
green "$HOST resolves to $resolved"

sudo_() { if [ "$(id -u)" = 0 ]; then "$@"; else sudo "$@"; fi; }

say "2. Certificate"
LIVE="/etc/letsencrypt/live/$HOST"
if sudo_ test -f "$LIVE/fullchain.pem"; then
  green "a certificate for $HOST already exists — leaving it alone"
  info "renew with: $0 $HOST   (after it is within 30 days of expiry)"
else
  # HTTP-01 needs port 80. The standalone authenticator runs its own listener,
  # so the gateway steps aside for the ~10 seconds the challenge takes. Renewals
  # do NOT need this: the TLS config below serves the challenge path from disk.
  info "port 80 is needed for the challenge; stopping the gateway briefly"
  "${COMPOSE[@]}" stop nginx >/dev/null 2>&1 || true
  sudo_ mkdir -p "$WEBROOT"

  set +e
  sudo_ docker run --rm -p 80:80 \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v /var/lib/letsencrypt:/var/lib/letsencrypt \
    "$CERTBOT_IMAGE" certonly --standalone \
      -d "$HOST" --agree-tos --no-eff-email -n --keep-until-expiring \
      $([ -n "$EMAIL" ] && printf -- '-m %s' "$EMAIL" || printf -- '--register-unsafely-without-email')
  rc=$?
  set -e

  # Whatever happened, the gateway goes back up.
  "${COMPOSE[@]}" up -d nginx >/dev/null 2>&1 || true
  [ "$rc" = 0 ] || die "certbot failed (exit $rc) — the stack is back on plain HTTP, nothing changed"
  green "certificate issued for $HOST"
fi

# A stable path, so nginx-tls.conf carries no hostname and a renewal needs no
# edit. The symlink chain live/current -> live/<host> -> ../../archive/... stays
# valid inside the container because the whole tree is mounted.
sudo_ ln -sfn "$LIVE" /etc/letsencrypt/live/current
green "/etc/letsencrypt/live/current -> $LIVE"

say "3. Public origin"
# PUBLIC_URL is what gets stamped into issuer metadata, tokens and request
# objects; PUBLIC_HOST is the bare host the did:web is minted under.
set_env() {
  local key="$1" value="$2" file="$DEPLOY/.env"
  touch "$file"
  if grep -qE "^${key}=" "$file"; then
    grep -vE "^${key}=" "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  fi
  printf '%s=%s\n' "$key" "$value" >> "$file"
}
set_env PUBLIC_URL "https://$HOST"
set_env PUBLIC_HOST "$HOST"
green "PUBLIC_URL=https://$HOST"

say "4. Local name resolution"
# So that curling the public name from this machine works at all. Without it the
# request leaves for the public address and depends on NAT hairpinning, which
# many clouds disable — the check below would fail even though the gateway is
# fine. (Setup scripts do not need this: they use the loopback operator listener
# on 127.0.0.1:8088.)
if grep -qE "^127\.0\.0\.1[[:space:]]+$HOST\b" /etc/hosts 2>/dev/null; then
  green "/etc/hosts already resolves $HOST locally"
else
  printf '127.0.0.1 %s\n' "$HOST" | sudo_ tee -a /etc/hosts >/dev/null \
    && green "/etc/hosts now resolves $HOST to 127.0.0.1" \
    || die "could not add $HOST to /etc/hosts"
fi

say "5. Gateway with TLS"
"${TLS_COMPOSE[@]}" up -d --force-recreate --no-deps nginx >/dev/null 2>&1 \
  || die "nginx would not start with the TLS configuration"
for i in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$HOST/gateway-health" || true)"
  [ "$code" = "200" ] && { green "https://$HOST/gateway-health -> 200"; break; }
  sleep 2
done
[ "${code:-}" = "200" ] || die "the gateway did not answer over https (last: ${code:-none})"
redirect="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://$HOST/gateway-health" || true)"
info "http://$HOST -> $redirect (301 expected: everything moves to https)"

say "Next"
cat <<NEXT
  The public origin is now https://$HOST, and that origin is part of the issuer
  DID and of the credential type. Start from a clean stack so metadata carries
  ONE issuer and ONE credential type — bootstrapping over the old data leaves
  the previous origin's schema advertised beside the new one, which shows up in
  a wallet as two identically named credentials:

    cd deploy
    docker compose -f docker-compose.yml -f docker-compose.tls.yml down -v
    docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
    cd .. && ./scripts/bootstrap.sh && ./scripts/seed-age-citizens.sh

  Credentials issued before this switch will no longer verify. That is correct
  behaviour, not a regression: their issuer identifier no longer resolves.

  Renewal (certbot renews only within 30 days of expiry, and needs no downtime):

    sudo docker run --rm -v /etc/letsencrypt:/etc/letsencrypt \\
      -v /var/lib/letsencrypt:/var/lib/letsencrypt -v $WEBROOT:$WEBROOT \\
      $CERTBOT_IMAGE renew --webroot -w $WEBROOT
NEXT
