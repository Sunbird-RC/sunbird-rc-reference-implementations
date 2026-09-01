#!/usr/bin/env bash
# Stand-in for a farmer's phone wallet, so the bank page can be checked on one
# laptop. See scripts/wallet-agriculture.mjs for what it actually does.
#
#   ./scripts/wallet-agriculture.sh eligiblePaddy               collect both credentials
#   ./scripts/wallet-agriculture.sh eligiblePaddy <sessionId>   collect, then apply
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -d node_modules/jose ] || { printf '  installing wallet dependencies...\n'; npm install --silent; }
exec node scripts/wallet-agriculture.mjs "$@"
