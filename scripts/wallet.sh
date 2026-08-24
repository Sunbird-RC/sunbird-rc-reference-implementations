#!/usr/bin/env bash
# Stand-in for a phone wallet, so the issuer and verifier pages can be checked
# together on one laptop. See scripts/wallet.mjs for what it actually does.
#
#   ./scripts/wallet.sh AGE-000001                 collect a credential
#   ./scripts/wallet.sh AGE-000001 <sessionId>     collect, then present
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -d node_modules/jose ] || { printf '  installing wallet dependencies...\n'; npm install --silent; }
exec node scripts/wallet.mjs "$@"
