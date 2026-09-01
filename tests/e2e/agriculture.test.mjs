// End-to-end evidence for Iteration 02, against the running stack.
//
// The journey under test is the one the bank actually performs: ONE OpenID4VP
// request satisfied by TWO credentials from TWO independent issuers, correlated
// on farmerId, and turned into a crop-based credit decision.
//
// Every test drives the real protocol. Credentials are really issued by the two
// registries, really signed with their own DIDs, and really presented in one VP
// token with a Key Binding JWT per credential. Nothing here mocks a verification
// result or a loan figure.
//
//   cd deploy && docker compose up -d && ../scripts/bootstrap.sh
//   ../scripts/seed-agriculture.sh
//   npm run test:e2e
//
// Pre-authorised offers are used to get credentials into the scripted wallet.
// That is protocol evidence, not the customer journey: the charter requires
// authenticated wallet-driven issuance on a real device, and a scripted client
// may never stand in for it.

import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  deployEnv,
  requireStack,
  issueAgricultureCredential,
  startFarmCreditVerification,
  farmCreditPolicy,
  readVerification,
  readFarmCreditVerification,
  cancelFarmCreditVerification,
  requestUriFromQr,
  cancelVerification,
  ensureNegativeFixture,
  retireNegativeFixture,
  NEGATIVE_FARMER_FIXTURE,
  NEGATIVE_LAND_FIXTURE,
  json,
} from './lib/stack.mjs';
import {
  createHolder,
  collectCredential,
  presentSdJwt,
  parseSdJwt,
  disclosableClaims,
  fetchRequestObject,
  submitMultiPresentation,
  declinePresentation,
} from './lib/wallet.mjs';

const { base, opsBase } = deployEnv();
const FARMER_ID = 'farmer_cred';
const LAND_ID = 'land_cred';

/** The fixtures scripts/seed-agriculture.sh seeds, by the case they exercise. */
const FIXTURES = {
  eligiblePaddy: { nationalId: 'NAT-90018472', farmerId: 'FRM-KA-0041' },
  eligibleWheat: { nationalId: 'NAT-90023815', farmerId: 'FRM-PB-0117' },
  inactiveOwner: { nationalId: 'NAT-90031164', farmerId: 'FRM-KA-0058' },
  unfundedCrop: { nationalId: 'NAT-90042093', farmerId: 'FRM-MH-0203' },
  unregistered: { nationalId: 'NAT-90066021', farmerId: 'FRM-KA-0088' },
};

let skip = null;
let farmerIssuerDid = null;
let landIssuerDid = null;

before(async () => {
  skip = await requireStack(base);
  if (skip) return;
  // The issuer DIDs come from the deployment rather than the environment: these
  // tests must fail loudly if bootstrap has not minted two SEPARATE issuers,
  // because "two independent issuers" is the premise of the whole iteration.
  const configs = await json(`${opsBase}/credential-schema/oid4vci-configs`);
  const list = Array.isArray(configs.body) ? configs.body : [];
  farmerIssuerDid = list.find((c) => c.name === 'Farmer Identity Credential')?.author || null;
  landIssuerDid = list.find((c) => c.name === 'Land Ownership Credential')?.author || null;
  if (!farmerIssuerDid || !landIssuerDid) {
    skip = 'the Agriculture credential schemas are not published — run scripts/bootstrap.sh';
  } else if (farmerIssuerDid === landIssuerDid) {
    skip = 'the Farmer and Land registries share an issuer DID, so they are not independent';
  }
});

const guard = () => {
  if (skip) throw new Error(skip);
};

/** Reads a farmer's seeded registry record, so tests assert against source data. */
async function registryRecord(entity, field, value) {
  const res = await json(`${opsBase}/api/v1/${entity}/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filters: { [field]: { eq: value } } }),
  });
  const rows = Array.isArray(res.body) ? res.body : res.body?.data || [];
  return rows[0] || null;
}

/**
 * Issues both credentials for one seeded farmer into ONE wallet.
 *
 * Claims come from the seeded registry records, so a fixture change moves the
 * test with it rather than leaving it asserting stale values.
 */
async function walletWithBothCredentials(fixture, { holder: existing } = {}) {
  const holder = existing || (await createHolder());
  const farmerRecord = await registryRecord('FarmerRecord', 'farmerId', fixture.farmerId);
  const landRecord = await registryRecord('LandRecord', 'farmerId', fixture.farmerId);
  assert.ok(farmerRecord, `no seeded FarmerRecord for ${fixture.farmerId}`);

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
  const farmer = await collectCredential({ base: farmerOffer.issuerBase, offer: farmerOffer, holder });

  let land = null;
  let landOffer = null;
  if (landRecord) {
    landOffer = await issueAgricultureCredential({
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
  }

  return {
    holder,
    farmer: farmer.credential,
    land,
    records: { farmer: farmerRecord, land: landRecord },
    vcts: { farmer: farmerOffer.vct, land: landOffer?.vct },
  };
}

/** Runs one full two-credential presentation and returns the bank's answer. */
async function applyForCredit({ holder, farmer, land, landHolder, disclose }) {
  const session = await startFarmCreditVerification(base);
  const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });

  const presentations = {};
  presentations[FARMER_ID] = await presentSdJwt({
    credential: farmer,
    disclose: disclose?.farmer || ['farmerId', 'registeredFarmer'],
    nonce: request.nonce,
    audience: request.client_id,
    holder,
  });
  if (land) {
    presentations[LAND_ID] = await presentSdJwt({
      credential: land,
      disclose: disclose?.land || ['farmerId', 'ownershipStatus', 'cropType', 'cultivatedAreaAcres'],
      nonce: request.nonce,
      audience: request.client_id,
      // Defaults to the same holder. A different one is how "two credentials
      // held by different people" is exercised.
      holder: landHolder || holder,
    });
  }

  const submission = await submitMultiPresentation({ base, responseUri: request.response_uri, state: request.state, presentations });
  const result = await readVerification(base, session.sessionId);
  return { session, request, presentations, submission, result: result.body };
}

describe('what the bank asks for', () => {
  test('one request, two credentials, and only the permitted claims', async () => {
    guard();
    const policy = await farmCreditPolicy(base);
    assert.deepEqual(policy.requestedClaims.farmer, ['farmerId', 'registeredFarmer']);
    assert.deepEqual(policy.requestedClaims.land, [
      'farmerId',
      'ownershipStatus',
      'cropType',
      'cultivatedAreaAcres',
    ]);
    // The claims a bank must never receive are not merely undisclosed — they are
    // never asked for, which is the stronger guarantee.
    const asked = [...policy.requestedClaims.farmer, ...policy.requestedClaims.land];
    for (const forbidden of ['nationalId', 'name', 'landId', 'landAreaAcres', 'district', 'farmerCategory']) {
      assert.equal(asked.includes(forbidden), false, `${forbidden} must not be requested`);
    }
  });

  test('the two credential types are pinned to different issuers', async () => {
    guard();
    const policy = await farmCreditPolicy(base);
    assert.match(policy.credentialTypes.farmer, /farmer-identity-credential$/);
    assert.match(policy.credentialTypes.land, /land-ownership-credential$/);
    const roles = policy.trustedIssuers.filter((i) => i.roles?.length);
    assert.deepEqual(
      roles.map((i) => i.roles).flat().sort(),
      ['farmer', 'land'],
      'exactly one trusted issuer per role',
    );
  });

  test('the lending policy the bank publishes is the committed one', async () => {
    guard();
    const policy = await farmCreditPolicy(base);
    assert.deepEqual(policy.cropRates, {
      PADDY: 30000,
      WHEAT: 40000,
      MAIZE: 25000,
      COTTON: 45000,
      SUGARCANE: 50000,
    });
    assert.equal(policy.maxRatePerAcre, 50000);
  });
});

describe('the two issuers are independent', () => {
  test('each advertises only its own credential', async () => {
    guard();
    for (const [which, expected] of [
      ['farmer', 'Farmer Identity Credential'],
      ['land', 'Land Ownership Credential'],
    ]) {
      const { body } = await json(`${base}/${which}/.well-known/openid-credential-issuer`);
      const names = Object.values(body.credential_configurations_supported || {}).map(
        (c) => c.display?.[0]?.name,
      );
      // An Age credential in the Agriculture issuer directory is exactly what
      // DEMO.md's quality gate forbids.
      assert.deepEqual(names, [expected], `${which} must advertise only ${expected}`);
    }
  });

  test('each names itself, so a wallet can label the entry', async () => {
    guard();
    const farmer = await json(`${base}/farmer/.well-known/openid-credential-issuer`);
    const land = await json(`${base}/land/.well-known/openid-credential-issuer`);
    assert.equal(farmer.body.display?.[0]?.name, 'Farmer Registry');
    assert.equal(land.body.display?.[0]?.name, 'Land Registry');
    assert.notEqual(farmer.body.credential_issuer, land.body.credential_issuer);
  });

  test('both point the wallet at the agriculture realm', async () => {
    guard();
    for (const which of ['farmer', 'land']) {
      const { body } = await json(`${base}/${which}/.well-known/openid-credential-issuer`);
      const servers = body.authorization_servers || [];
      assert.ok(
        servers.some((s) => s.includes('/realms/agriculture')),
        `${which} must advertise the agriculture realm, got ${servers.join(', ')}`,
      );
    }
  });
});

describe('the credentials', () => {
  test('both are SD-JWT VCs bound to the same wallet key', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    const farmer = parseSdJwt(wallet.farmer);
    const land = parseSdJwt(wallet.land);

    for (const [which, parsed] of [['farmer', farmer], ['land', land]]) {
      assert.equal(parsed.header.typ, 'vc+sd-jwt', `${which} media type`);
      assert.equal(parsed.header.alg, 'ES256', `${which} algorithm`);
      assert.ok(parsed.payload.cnf?.jwk, `${which} must be holder-bound`);
    }
    // The same key in both. This is what makes matching farmerId correlation
    // rather than two credentials that happen to agree.
    assert.deepEqual(farmer.payload.cnf.jwk.x, land.payload.cnf.jwk.x);
    assert.deepEqual(farmer.payload.cnf.jwk.y, land.payload.cnf.jwk.y);
    assert.equal(farmer.payload.cnf.jwk.x, wallet.holder.publicJwk.x);
  });

  test('they are signed by two different issuers', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    const farmer = parseSdJwt(wallet.farmer).payload;
    const land = parseSdJwt(wallet.land).payload;
    assert.equal(farmer.iss, farmerIssuerDid);
    assert.equal(land.iss, landIssuerDid);
    assert.notEqual(farmer.iss, land.iss);
  });

  test('neither credential carries the National ID', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    // The registry holds it; the credential must not. The strongest form of
    // "the bank never sees it" is that there is nothing to disclose.
    assert.equal(wallet.records.farmer.nationalId, FIXTURES.eligiblePaddy.nationalId);
    for (const [which, credential] of [['farmer', wallet.farmer], ['land', wallet.land]]) {
      assert.equal(
        disclosableClaims(credential).includes('nationalId'),
        false,
        `${which} must have no nationalId claim`,
      );
      assert.equal(
        credential.includes(FIXTURES.eligiblePaddy.nationalId),
        false,
        `${which} must not contain the National ID anywhere`,
      );
    }
  });

  test('the land credential can disclose more than the bank asks for', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    // Without this, "only four claims travelled" would just mean the credential
    // had nothing else in it.
    const claims = disclosableClaims(wallet.land);
    for (const extra of ['landId', 'landAreaAcres', 'district']) {
      assert.ok(claims.includes(extra), `${extra} must be in the credential but not requested`);
    }
  });
});

describe('an eligible farmer', () => {
  test('paddy: ELIGIBLE, with the loan computed from verified acreage', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    const { result } = await applyForCredit(wallet);

    assert.equal(result.state, 'decided');
    assert.equal(result.decision, 'ELIGIBLE');
    for (const [name, value] of Object.entries(result.checks)) {
      assert.equal(value, 'OK', `check ${name}`);
    }
    const acres = wallet.records.land.cultivatedAreaAcres;
    assert.equal(result.disclosed.cropType, 'PADDY');
    assert.equal(result.disclosed.cultivatedAreaAcres, acres);
    assert.equal(result.loan.ratePerAcre, 30000);
    assert.equal(result.loan.maximumLoan, acres * 30000);
    assert.equal(result.loan.maximumLoanFormatted, '₹1,20,000');
  });

  test('wheat: a different crop gives a different rate and amount', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.eligibleWheat);
    const { result } = await applyForCredit(wallet);
    assert.equal(result.decision, 'ELIGIBLE');
    assert.equal(result.loan.ratePerAcre, 40000);
    assert.equal(result.loan.maximumLoan, wallet.records.land.cultivatedAreaAcres * 40000);
  });

  test('both issuers are named in the answer', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    const { result } = await applyForCredit(wallet);
    const issuers = Array.isArray(result.issuer) ? result.issuer : [result.issuer];
    assert.deepEqual(issuers.sort(), ['Farmer Registry', 'Land Registry']);
  });
});

describe('privacy: what actually travelled', () => {
  test('exactly the requested claims reach the bank, and nothing else', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    const { result, presentations } = await applyForCredit(wallet);
    assert.equal(result.decision, 'ELIGIBLE');

    // What the bank was told - derived from the bank's own published request,
    // not restated, and asserted in BOTH directions.
    //
    // Nothing extra is the privacy half. Nothing missing is the honesty half:
    // the page prints these beside a list of withheld claims, so a report that
    // omits a claim the farmer did disclose overstates the guarantee. This
    // assertion was a hardcoded three-claim list, which matched a payload that
    // omitted registeredFarmer and ownershipStatus and so pinned the defect in
    // place instead of catching it.
    const policy = await farmCreditPolicy(base);
    const requested = [...new Set([...policy.requestedClaims.farmer, ...policy.requestedClaims.land])].sort();
    assert.deepEqual(
      Object.keys(result.disclosed).sort(),
      requested,
      'the bank must report exactly the claims it asked for: no more, and no fewer',
    );

    // And what is absent from the wire, not merely unread. The withheld values
    // are in the credentials as salted digests, so they are unrecoverable.
    const wire = Object.values(presentations).join('|');
    const secrets = [
      wallet.records.farmer.nationalId,
      wallet.records.land.landId,
      String(wallet.records.land.landAreaAcres),
      wallet.records.farmer.farmerCategory,
    ];
    for (const secret of secrets) {
      assert.ok(secret, 'fixture must have the value we claim is withheld');
      assert.equal(wire.includes(secret), false, `${secret} must not appear in the presentation`);
    }
    const serialised = JSON.stringify(result);
    assert.equal(/nationalId|NAT-9/.test(serialised), false, 'no National ID in the bank response');
    assert.equal(/holderDid|did:jwk/.test(serialised), false, 'no holder identifier in the bank response');
  });
});

describe('verified business answers: NOT ELIGIBLE', () => {
  test('ownership that is not active', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.inactiveOwner);
    const { result } = await applyForCredit(wallet);
    // Verified, then refused. Every cryptographic check still passes.
    assert.equal(result.state, 'decided');
    assert.equal(result.decision, 'NOT_ELIGIBLE');
    assert.match(result.reason, /no active land ownership/);
    assert.equal(result.loan, undefined, 'a business refusal carries no loan amount');
    for (const [name, value] of Object.entries(result.checks)) {
      assert.equal(value, 'OK', `check ${name} must still pass`);
    }
  });

  test('a crop the policy does not fund', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.unfundedCrop);
    const { result } = await applyForCredit(wallet);
    assert.equal(result.decision, 'NOT_ELIGIBLE');
    assert.match(result.reason, /not in the approved lending policy/);
    assert.equal(result.loan, undefined);
  });

  test('a farmer the registry does not list as registered', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.unregistered);
    const { result } = await applyForCredit(wallet);
    assert.equal(result.decision, 'NOT_ELIGIBLE');
    assert.match(result.reason, /registered farmer/);
  });
});

describe('verification failures: REJECTED / UNABLE TO VERIFY', () => {
  test('two credentials naming different farmers', async () => {
    guard();
    // The fixture REQUIREMENTS §7 asks for: valid Farmer and Land credentials
    // that do not belong together. Both are genuinely signed and genuinely held
    // by the same wallet — only the farmerId disagrees.
    const one = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    const other = await walletWithBothCredentials(FIXTURES.eligibleWheat, { holder: one.holder });
    const { result } = await applyForCredit({
      holder: one.holder,
      farmer: one.farmer,
      land: other.land,
    });
    assert.equal(result.state, 'rejected');
    assert.match(result.reason, /different farmers/);
    assert.equal(result.decision, undefined, 'a rejection is not a business answer');
  });

  test('two credentials held by different wallets', async () => {
    guard();
    // Matching farmerId is not enough: the credentials must be proven to be held
    // by the same presenting wallet. Here they are not.
    const wallet = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    const stranger = await createHolder();
    const { result } = await applyForCredit({ ...wallet, landHolder: stranger });
    assert.equal(result.state, 'rejected', 'a second holder must not be accepted');
    assert.equal(result.decision, undefined);
  });

  test('only one of the two credentials presented', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    const { result } = await applyForCredit({ ...wallet, land: null });
    assert.equal(result.state, 'rejected');
    assert.equal(result.decision, undefined);
  });

  test('the land credential in the farmer slot', async () => {
    guard();
    // Both issuers are trusted, both signatures are valid. What must fail is the
    // ROLE: the Land Registry is not trusted to issue the farmer credential.
    const wallet = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    const session = await startFarmCreditVerification(base);
    const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
    const swapped = await presentSdJwt({
      credential: wallet.land,
      disclose: ['farmerId'],
      nonce: request.nonce,
      audience: request.client_id,
      holder: wallet.holder,
    });
    await submitMultiPresentation({
      base,
      responseUri: request.response_uri,
      state: request.state,
      presentations: { [FARMER_ID]: swapped },
    });
    const { body } = await readVerification(base, session.sessionId);
    assert.equal(body.state, 'rejected');
    assert.equal(body.decision, undefined);
  });
});

describe('no data shared', () => {
  test('a farmer who declines is reported as declined, not as a failure', async () => {
    guard();
    const session = await startFarmCreditVerification(base);
    const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
    const submission = await declinePresentation({ base, responseUri: request.response_uri, state: request.state });
    assert.ok(submission.status < 500, `declining must not fault the service, got ${submission.status}`);

    const { body } = await readVerification(base, session.sessionId);
    assert.equal(body.state, 'declined');
    assert.equal(body.decision, undefined);
    assert.equal(body.loan, undefined);
    assert.equal(JSON.stringify(body).includes('farmerId'), false, 'a refusal leaks nothing');
  });

  test('a cancelled application stays cancelled, even if a valid presentation arrives', async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    const session = await startFarmCreditVerification(base);
    const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });

    const cancelled = await cancelVerification(base, session.sessionId);
    assert.equal(cancelled.body.state, 'cancelled');

    const presentations = {
      [FARMER_ID]: await presentSdJwt({
        credential: wallet.farmer,
        disclose: ['farmerId', 'registeredFarmer'],
        nonce: request.nonce,
        audience: request.client_id,
        holder: wallet.holder,
      }),
      [LAND_ID]: await presentSdJwt({
        credential: wallet.land,
        disclose: ['farmerId', 'ownershipStatus', 'cropType', 'cultivatedAreaAcres'],
        nonce: request.nonce,
        audience: request.client_id,
        holder: wallet.holder,
      }),
    };
    await submitMultiPresentation({ base, responseUri: request.response_uri, state: request.state, presentations });

    const { body } = await readVerification(base, session.sessionId);
    assert.equal(body.state, 'cancelled', 'a cancelled application must never report a decision');
    assert.equal(body.decision, undefined);
    assert.equal(body.loan, undefined);
  });
});

// The URLs services/bank-web/app.js actually calls.
//
// Every other test here reaches the same sessions through the Age path
// /api/verifier/sessions/<id>, and that is how a real defect survived a green
// suite: the bank page polls /api/verifier/agriculture/sessions/<id>, no route
// matched it, and the page rendered the 404 as "No presentation arrived before
// the request expired" for an application the verifier had decided ELIGIBLE.
// A passing API test proves nothing about a page that calls a different URL.
describe('the endpoints the bank page itself uses', () => {
  test("the page's polling URL returns the decision, not a 404", async () => {
    guard();
    const wallet = await walletWithBothCredentials(FIXTURES.eligiblePaddy);
    const session = await startFarmCreditVerification(base);
    const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
    const presentations = {
      [FARMER_ID]: await presentSdJwt({
        credential: wallet.farmer,
        disclose: ['farmerId', 'registeredFarmer'],
        nonce: request.nonce,
        audience: request.client_id,
        holder: wallet.holder,
      }),
      [LAND_ID]: await presentSdJwt({
        credential: wallet.land,
        disclose: ['farmerId', 'ownershipStatus', 'cropType', 'cultivatedAreaAcres'],
        nonce: request.nonce,
        audience: request.client_id,
        holder: wallet.holder,
      }),
    };
    await submitMultiPresentation({ base, responseUri: request.response_uri, state: request.state, presentations });

    const res = await readFarmCreditVerification(base, session.sessionId);
    assert.equal(res.status, 200, 'the bank page polls this URL; a 404 here is shown as "expired"');
    assert.equal(res.body.state, 'decided');
    assert.equal(res.body.decision, 'ELIGIBLE');
    assert.ok(res.body.loan?.maximumLoanFormatted, 'the page renders this figure');
  });

  test("the page's cancel URL actually cancels", async () => {
    guard();
    // The page's Cancel button posts here. Unrouted, it would report success to
    // the user - fetch resolves - while the session stayed live and answerable.
    const session = await startFarmCreditVerification(base);
    const cancelled = await cancelFarmCreditVerification(base, session.sessionId);
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.state, 'cancelled');
    const after = await readFarmCreditVerification(base, session.sessionId);
    assert.equal(after.body.state, 'cancelled');
  });

  test('a session is readable through either namespace', async () => {
    guard();
    // Reading is use-case agnostic on purpose: the session records its own use
    // case. This pins that, so nobody "fixes" it by splitting the store.
    const session = await startFarmCreditVerification(base);
    const viaAge = await readVerification(base, session.sessionId);
    const viaAgriculture = await readFarmCreditVerification(base, session.sessionId);
    assert.equal(viaAge.status, 200);
    assert.equal(viaAgriculture.status, 200);
    assert.equal(viaAge.body.state, viaAgriculture.body.state);
  });

  test('an unknown use-case prefix is not a route', async () => {
    guard();
    // The prefix is built from the use-case map, so it must not accept anything
    // that is not a use case - otherwise it is just a wildcard.
    const session = await startFarmCreditVerification(base);
    const res = await json(`${base}/api/verifier/education/sessions/${session.sessionId}`);
    assert.equal(res.status, 404);
  });
});

// REQUIREMENTS §7's last two required fixtures: a cryptographically VALID
// credential from an issuer outside the allowlist, for each role.
//
// The point is the same one the Age suite makes and worth restating: Sunbird RC's
// OID4VP verifier answers "is this signature valid?" and never "is this issuer one
// we accept?". Any party able to mint the same `vct` would otherwise be believed,
// so the allowlist in config/trust/issuers.json is the only thing standing between
// a well-formed forgery and a loan.
//
// These fixtures are provisioned by the test and retired afterwards, never by
// bootstrap. Issuer metadata is built from every published schema with no filter,
// so a fixture created at setup time would appear in the wallet's issuer directory
// beside the real credentials — exactly what DEMO.md's quality gate forbids.
describe('trust: a valid credential from an issuer outside the allowlist', () => {
  for (const [role, fixture, otherRole] of [
    ['farmer', NEGATIVE_FARMER_FIXTURE, 'land'],
    ['land', NEGATIVE_LAND_FIXTURE, 'farmer'],
  ]) {
    test(`an unlisted ${role} issuer is refused, though its signature is valid`, async () => {
      guard();
      const { untrustedIssuerDid } = deployEnv();
      if (!untrustedIssuerDid) throw new Error('no UNTRUSTED_ISSUER_DID — run scripts/bootstrap.sh');

      const config = await ensureNegativeFixture(untrustedIssuerDid, fixture);
      try {
        // The genuine pair, so the ONLY thing wrong with the presentation is who
        // signed one half of it.
        const good = await walletWithBothCredentials(FIXTURES.eligiblePaddy);

        // The same claims, the same vct, a real signature — from the wrong issuer.
        const forgedClaims =
          role === 'farmer'
            ? { farmerId: good.records.farmer.farmerId, registeredFarmer: true }
            : {
                farmerId: good.records.land.farmerId,
                ownershipStatus: 'ACTIVE',
                cropType: good.records.land.cropType,
                cultivatedAreaAcres: good.records.land.cultivatedAreaAcres,
              };
        // Issued through the REGISTRY's own instance, so the vct is minted under
        // that registry's path and matches what the bank's query pins. Only the
        // signing DID is wrong.
        const offer = await issueAgricultureCredential({
          base,
          which: role,
          issuerDid: untrustedIssuerDid,
          credentialName: fixture.name,
          claims: forgedClaims,
        });
        const forged = (await collectCredential({ base: offer.issuerBase, offer, holder: good.holder })).credential;

        const session = await startFarmCreditVerification(base);
        const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
        const policy = await farmCreditPolicy(base);
        const presentations = {
          [FARMER_ID]: await presentSdJwt({
            credential: role === 'farmer' ? forged : good.farmer,
            disclose: policy.requestedClaims.farmer,
            nonce: request.nonce,
            audience: request.client_id,
            holder: good.holder,
          }),
          [LAND_ID]: await presentSdJwt({
            credential: role === 'land' ? forged : good.land,
            disclose: policy.requestedClaims.land,
            nonce: request.nonce,
            audience: request.client_id,
            holder: good.holder,
          }),
        };
        const sent = await submitMultiPresentation({
          base,
          responseUri: request.response_uri,
          state: request.state,
          presentations,
        });
        // Upstream accepts it: every signature is real and the holder binding
        // holds. If this were a 4xx the test would prove nothing about trust.
        assert.equal(sent.status, 200, 'the forged credential must be cryptographically valid');

        const { body } = await readFarmCreditVerification(base, session.sessionId);
        assert.equal(body.state, 'rejected', `an unlisted ${role} issuer must not be accepted`);
        assert.equal(body.decision, undefined, 'a trust rejection is not a lending decision');
        assert.equal(body.loan, undefined);
        // And the trusted issuer for the OTHER role must not be what excused it.
        assert.doesNotMatch(String(body.reason), new RegExp(otherRole, 'i'));
      } finally {
        await retireNegativeFixture(config.schemaId);
      }
    });
  }
});
