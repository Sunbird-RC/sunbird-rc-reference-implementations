// A holder wallet you drive by hand, for checking the two UIs together on a
// laptop.
//
// The issuer page and the verifier page each show a QR meant for a phone. With
// no phone in the loop, this stands in for one: it collects a credential from
// the issuer and answers the presentation request the verifier page is showing.
//
// It is the SAME wallet the e2e suite uses (tests/e2e/lib/wallet.mjs) — real
// ES256 keys, a real proof of possession, a real SD-JWT presentation with a Key
// Binding JWT. Nothing here is stubbed; it is a holder, not a mock.
//
//   ./scripts/wallet.sh AGE-000001                 collect only
//   ./scripts/wallet.sh AGE-000001 <sessionId>     collect, then present
//
// The session id is shown under the QR on the verifier page.

import { deployEnv, requireStack, issueOfferFor } from '../tests/e2e/lib/stack.mjs';
import {
  createHolder,
  collectCredential,
  presentSdJwt,
  disclosableClaims,
  fetchRequestObject,
  submitPresentation,
} from '../tests/e2e/lib/wallet.mjs';

const [citizenId, sessionId] = process.argv.slice(2);
if (!citizenId) {
  console.error('usage: ./scripts/wallet.sh <citizenId> [verifierSessionId]');
  process.exit(2);
}

const { base } = deployEnv();
const problem = await requireStack(base);
if (problem) {
  console.error(`\n  ${problem}\n`);
  process.exit(1);
}

const holder = await createHolder();
console.log(`\nwallet: fresh ES256 holder key`);

const offer = await issueOfferFor(base, citizenId);
console.log(`offer:  ${citizenId} -> ${offer.offerId}`);

const { credential } = await collectCredential({ base, offer, holder });
console.log(`stored: credential holding ${disclosableClaims(credential).join(', ')}`);

if (!sessionId) {
  console.log('\nNo session id given, so nothing was presented.');
  console.log('Open the verifier page, press "Start age check", and re-run with the');
  console.log('session id printed under the QR.\n');
  process.exit(0);
}

const request = await fetchRequestObject({ base, transactionId: sessionId });
const presentation = await presentSdJwt({
  credential,
  // Minimum disclosure: the verifier asked for one claim, so one claim travels.
  disclose: ['ageOver18'],
  nonce: request.nonce,
  audience: request.client_id,
  holder,
});
const disclosures = presentation.split('~').length - 2;

const res = await submitPresentation({
  base,
  state: request.state,
  queryId: 'age_cred',
  presentation,
});

console.log(`shared: ageOver18 only (${disclosures} disclosure in the presentation)`);
console.log(`sent:   HTTP ${res.status}${res.status === 200 ? '' : ' — the stack refused it'}`);
console.log('\nThe verifier page updates within a second or two.\n');
