#!/usr/bin/env bash
# Stand-in for a learner's phone wallet, so the two Education portals can be
# checked on one laptop. See scripts/wallet-education.mjs for what it does.
#
#   ./scripts/wallet-education.sh twoAnswers                       collect three cards
#   ./scripts/wallet-education.sh twoAnswers job     <sessionId>   collect, then apply
#   ./scripts/wallet-education.sh twoAnswers masters <sessionId>   the SAME cards, other portal
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -d node_modules/jose ] || { printf '  installing wallet dependencies...\n'; npm install --silent; }
exec node scripts/wallet-education.mjs "$@"
