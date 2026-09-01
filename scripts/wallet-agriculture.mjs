// A farmer's wallet you drive by hand, so the bank page can be checked on a
// laptop with no phone in the loop.
//
// The Agriculture counterpart of scripts/wallet.mjs, and it differs in the way
// the use case does: TWO credentials from TWO independent registries, collected
// into ONE holder key, and presented together in a single VP token — which is
// what makes the bank's farmerId correlation check meaningful rather than
// decorative.
//
// It is the SAME wallet the e2e suite uses (tests/e2e/lib/wallet.mjs): real
// ES256 keys, a real proof of possession, real SD-JWT presentations with a Key
// Binding JWT per credential. Nothing here is stubbed.
//
//   ./scripts/wallet-agriculture.sh eligiblePaddy                 collect only
//   ./scripts/wallet-agriculture.sh eligiblePaddy <sessionId>     collect, then apply
//   ./scripts/wallet-agriculture.sh FRM-KA-0041  <sessionId>      by farmer id
//
// A MISMATCHED pair — the land card of a different farmer, which the bank must
// refuse with REJECTED / UNABLE TO VERIFY rather than NOT ELIGIBLE:
//
//   ./scripts/wallet-agriculture.sh eligiblePaddy <sessionId> --land eligibleWheat
//
// Both credentials in that pair are genuinely issued, genuinely signed by their
// own registry, and genuinely held by this one wallet key. Nothing is tampered
// with. Only the farmerId disagrees, which is the whole point: it is the
// combination that is wrong, not either card.
//
// The session id is shown under the QR on the bank page.
//
// Pre-authorised offers are used to get the credentials in. That is supporting
// protocol evidence, NOT the customer journey: the charter requires
// authenticated wallet-driven issuance on a real device, and this may never
// stand in for it.

import {
  deployEnv,
  requireStack,
  issueAgricultureCredential,
  farmCreditPolicy,
  requestUriFromQr,
  json,
} from '../tests/e2e/lib/stack.mjs';
import {
  createHolder,
  collectCredential,
  presentSdJwt,
  fetchRequestObject,
  submitMultiPresentation,
} from '../tests/e2e/lib/wallet.mjs';

// The fixtures scripts/seed-agriculture.sh seeds, named by the outcome they
// produce, so a demo can pick an outcome rather than remember an id.
const FIXTURES = {
  eligiblePaddy: 'FRM-KA-0041',
  eligibleWheat: 'FRM-PB-0117',
  inactiveOwner: 'FRM-KA-0058',
  unfundedCrop: 'FRM-MH-0203',
  unregistered: 'FRM-KA-0088',
  noLandRecord: 'FRM-KA-0072',
};

const argv = process.argv.slice(2);
// --land <fixture> takes the LAND credential from a different farmer. Parsed out
// before the positionals so the existing two-argument form is untouched.
let landFrom = null;
const landFlag = argv.indexOf('--land');
if (landFlag !== -1) {
  landFrom = argv[landFlag + 1];
  argv.splice(landFlag, 2);
}
const [which, sessionId] = argv;
if (!which) {
  console.error('usage: ./scripts/wallet-agriculture.sh <fixture|farmerId> [bankSessionId]');
  console.error(`\nfixtures: ${Object.entries(FIXTURES).map(([k, v]) => `${k} (${v})`).join(', ')}\n`);
  process.exit(2);
}
const farmerId = FIXTURES[which] || which;
const landFarmerId = landFrom ? FIXTURES[landFrom] || landFrom : farmerId;

const { base, opsBase } = deployEnv();
const problem = await requireStack(base);
if (problem) {
  console.error(`\n  ${problem}\n`);
  process.exit(1);
}

/** The issuer DIDs come from the deployment, not from the environment. */
const configs = await json(`${opsBase}/credential-schema/oid4vci-configs`);
const published = Array.isArray(configs.body) ? configs.body : [];
const farmerIssuerDid = published.find((c) => c.name === 'Farmer Identity Credential')?.author;
const landIssuerDid = published.find((c) => c.name === 'Land Ownership Credential')?.author;
if (!farmerIssuerDid || !landIssuerDid) {
  console.error('\n  the Agriculture schemas are not published — run ./scripts/bootstrap.sh\n');
  process.exit(1);
}
if (farmerIssuerDid === landIssuerDid) {
  console.error('\n  the two registries share an issuer DID, so they are not independent\n');
  process.exit(1);
}

async function record(entity, id) {
  const res = await json(`${opsBase}/api/v1/${entity}/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filters: { farmerId: { eq: id } } }),
  });
  const rows = Array.isArray(res.body) ? res.body : res.body?.data || [];
  return rows[0] || null;
}

const farmerRecord = await record('FarmerRecord', farmerId);
if (!farmerRecord) {
  console.error(`\n  no seeded FarmerRecord for ${farmerId} — run ./scripts/seed-agriculture.sh\n`);
  process.exit(1);
}
const landRecord = await record('LandRecord', landFarmerId);
if (landFrom) {
  console.log(`\nMISMATCHED PAIR: farmer card ${farmerId}, land card ${landFarmerId}`);
}

const holder = await createHolder();
console.log('\nwallet: fresh ES256 holder key (ONE key, both credentials)');

// Claims are copied from the seeded registry records, so this driver cannot
// present a value the registry does not hold.
const farmerOffer = await issueAgricultureCredential({
  base,
  which: 'farmer',
  issuerDid: farmerIssuerDid,
  claims: {
    farmerId: farmerRecord.farmerId,
    registeredFarmer: farmerRecord.registeredFarmer,
    farmerCategory: farmerRecord.farmerCategory,
    district: farmerRecord.district,
  },
});
const farmer = (await collectCredential({ base: farmerOffer.issuerBase, offer: farmerOffer, holder })).credential;
console.log(`stored: Farmer Identity Credential  from ${farmerIssuerDid}`);

let land = null;
if (landRecord) {
  const landOffer = await issueAgricultureCredential({
    base,
    which: 'land',
    issuerDid: landIssuerDid,
    claims: {
      landId: landRecord.landId,
      farmerId: landRecord.farmerId,
      ownershipStatus: landRecord.ownershipStatus,
      landAreaAcres: landRecord.landAreaAcres,
      cropType: landRecord.cropType,
      cultivatedAreaAcres: landRecord.cultivatedAreaAcres,
      district: landRecord.district,
    },
  });
  land = (await collectCredential({ base: landOffer.issuerBase, offer: landOffer, holder })).credential;
  console.log(`stored: Land Ownership Credential   from ${landIssuerDid}`);
} else {
  // A real case, not an error: FRM-KA-0072 is seeded with no land record so the
  // bank's "unable to verify" path can be demonstrated.
  console.log('stored: no land credential — this farmer has no land record, on purpose');
}

if (!sessionId) {
  console.log('\nNo session id given, so nothing was presented.');
  console.log('Open the bank page, press "Start farm credit check", and re-run with');
  console.log('the session id printed under the QR.\n');
  process.exit(0);
}

// What travels is the bank's own published policy, read from the service rather
// than restated here — so this driver cannot over-disclose relative to the ask.
const policy = await farmCreditPolicy(base);
// The request object comes from the URL the QR carries, not from one rebuilt
// out of PUBLIC_URL: the bank signs with its own identity from its own instance,
// published under its own path prefix, so a guessed URL reaches the age signer
// and 404s.
const session = await json(`${base}/api/verifier/agriculture/sessions/${sessionId}`);
const qrData = session.body?.qrData;
const request = await fetchRequestObject(
  qrData ? { requestUri: requestUriFromQr(qrData) } : { base, transactionId: sessionId },
);

const presentations = {};
presentations.farmer_cred = await presentSdJwt({
  credential: farmer,
  disclose: policy.requestedClaims.farmer,
  nonce: request.nonce,
  audience: request.client_id,
  holder,
});
if (land) {
  presentations.land_cred = await presentSdJwt({
    credential: land,
    disclose: policy.requestedClaims.land,
    nonce: request.nonce,
    audience: request.client_id,
    holder,
  });
}

const res = await submitMultiPresentation({
  base,
  responseUri: request.response_uri,
  state: request.state,
  presentations,
});
console.log(`\nshared: farmer -> ${policy.requestedClaims.farmer.join(', ')}`);
if (land) console.log(`        land   -> ${policy.requestedClaims.land.join(', ')}`);
console.log(`sent:   HTTP ${res.status}${res.status === 200 ? '' : ' — the stack refused it'}`);

// Printed here as well as on the page, because the point of the driver is
// checking that the two agree: whatever the page shows must be what the service
// decided. Reading is idempotent — verified by reading one decided session three
// times — so this does not take the answer away from the page.
//
// It reads through the BANK's own URL rather than the Age one on purpose. The
// suite once used only the Age path while the page used the agriculture path,
// and a missing route under /agriculture went unnoticed: the page reported "the
// request expired" over applications the verifier had decided ELIGIBLE. A driver
// that avoided the page's URL would have hidden that too.
const answer = await json(`${base}/api/verifier/agriculture/sessions/${sessionId}`);
const body = answer.body || {};
if (body.decision || body.reason) {
  console.log(`\nbank:   ${body.decision || body.state || 'no decision'}`);
  if (body.loan?.maximumLoanFormatted) console.log(`        ${body.loan.maximumLoanFormatted}`);
  if (body.reason) console.log(`        ${body.reason}`);
}
console.log('\nThe bank page updates within a second or two.\n');
