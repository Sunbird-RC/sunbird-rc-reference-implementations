// Drives the REAL customer journey for a showcase subject and prints what the bank decides,
// so a filming session is not spent discovering that the subject does not work.
//
//   PUBLIC_URL=https://host OPS_URL=... AUTHORITY_URL=... DEMO_CITIZEN_PASSWORD=... \
//     node scripts/check-film-subject.mjs farmer.film FRM-PB-0118
//
// The failure modes it exists to catch are all quiet ones. A user created through the admin
// API rather than realm import silently loses its `nationalId` — Keycloak's
// unmanagedAttributePolicy defaults to DISABLED — and the credential that follows carries no
// `authorityCredentialId`. Nothing errors. The first sign is a presentation the bank cannot
// verify, on camera.
//
// scripts/wallet-agriculture.sh CANNOT stand in for this. It uses pre-authorised offers with
// claims copied straight from the registry record, so its credential never carries
// `authorityCredentialId` and the agriculture request object cannot be satisfied at all. That
// driver predates the Authority Service.
//
// Set both of these to also exercise suspend/reinstate:
//   FILM_LIFECYCLE_SSH='ssh -i <key> rc@<host>'      how to reach the deployment
//   FILM_REMOTE_DIR=/path/to/the/deployment          where the scripts live on it
// The transitions run THERE because the officer credentials live in its deploy/.env and
// nowhere else, so there is nothing here to configure and nothing to leak.
import {
  deployEnv, requireStack, startFarmCreditVerification,
  readFarmCreditVerification, requestUriFromQr, farmCreditPolicy,
} from '../tests/e2e/lib/stack.mjs';
import { signIn } from '../tests/e2e/lib/keycloak.mjs';
import {
  createHolder, requestCredential, disclosableValues, presentSdJwt,
  fetchRequestObject, submitMultiPresentation,
} from '../tests/e2e/lib/wallet.mjs';
import { execSync } from 'node:child_process';

const { base, demoPassword } = deployEnv();
const AUTHORITY = process.env.AUTHORITY_URL;
const LIFECYCLE = process.env.FILM_LIFECYCLE_SSH;
const REMOTE_DIR = process.env.FILM_REMOTE_DIR;
const username = process.argv[2] || 'farmer.film';
const recordId = process.argv[3] || 'FRM-PB-0118';

const blocked = await requireStack(base);
if (blocked) { console.error(blocked); process.exit(1); }
if (!demoPassword) { console.error('no DEMO_CITIZEN_PASSWORD — export it from the deployment'); process.exit(1); }

const advertised = {};
for (const which of ['farmer', 'land']) {
  const meta = await (await fetch(`${base}/${which}/.well-known/openid-credential-issuer`)).json();
  const [id, cfg] = Object.entries(meta.credential_configurations_supported)[0];
  advertised[which] = { issuerBase: `${base}/${which}`, configurationId: id, scope: cfg.scope };
}

const auth = await signIn({
  authorizationServer: `${base}/auth/realms/agriculture`,
  redirectUri: `${base}/wallet/redirect`,
  username, password: demoPassword,
  scope: ['openid', advertised.farmer.scope, advertised.land.scope].filter(Boolean).join(' '),
});
console.log(`signed in as ${username}`);

const holder = await createHolder();
const one = (which) => requestCredential({
  base: advertised[which].issuerBase, token: { access_token: auth.accessToken }, holder,
  extra: { credential_configuration_id: advertised[which].configurationId },
});
const farmer = await one('farmer');
const land = await one('land');

let anchor = null;
for (const [name, cred] of [['farmer', farmer], ['land', land]]) {
  const v = disclosableValues(cred.credential);
  console.log(`\n${name} credential claims:`);
  for (const [k, val] of Object.entries(v)) console.log(`  ${k} = ${val}`);
  if (!v.authorityCredentialId) {
    console.error(`\n  the ${name} credential carries no authorityCredentialId, so the bank cannot` +
      `\n  check its status and the request object cannot be satisfied. Usually the subject's` +
      `\n  nationalId attribute did not stick — see scripts/bootstrap.sh on unmanaged attributes.\n`);
    process.exit(1);
  }
  if (name === 'farmer') anchor = v.authorityCredentialId;
  if (AUTHORITY) {
    const r = await fetch(`${AUTHORITY}/api/v1/trust/credentials/${encodeURIComponent(v.authorityCredentialId)}/status`);
    console.log(`  -> Authority status: ${r.ok ? JSON.stringify(await r.json()) : `HTTP ${r.status}`}`);
  }
}

const policy = await farmCreditPolicy(base);

/** One full consented presentation, and what the bank answered. */
async function apply() {
  const session = await startFarmCreditVerification(base);
  const request = await fetchRequestObject({ requestUri: requestUriFromQr(session.qrData) });
  const presentations = {
    farmer_cred: await presentSdJwt({ credential: farmer.credential, disclose: policy.requestedClaims.farmer, nonce: request.nonce, audience: request.client_id, holder }),
    land_cred: await presentSdJwt({ credential: land.credential, disclose: policy.requestedClaims.land, nonce: request.nonce, audience: request.client_id, holder }),
  };
  await submitMultiPresentation({ responseUri: request.response_uri, state: request.state, presentations });
  const { body } = await readFarmCreditVerification(base, session.sessionId);
  return {
    purpose: request.dcql_query?.credential_sets?.[0]?.purpose ?? request.credential_sets?.[0]?.purpose,
    // A status refusal is rejected BEFORE the domain decision, so that body has no
    // `decision` at all. Showing its shape beats printing "(none)".
    answer: body?.decision ?? body?.outcome ?? body?.state
      ?? (body ? JSON.stringify(body).slice(0, 110) : '(empty body)'),
    reason: body?.reason ?? '',
  };
}

// The remote half is ONE quoted argument. Written as a bare `ssh host cd dir && script`
// the `&&` binds to the local shell, so the cd happens remotely and the script runs here.
const lifecycle = (action) =>
  // 2>&1 because lifecycle-agriculture.sh reports on STDERR; without it execSync captures
  // an empty stdout, prints the real output straight through to the console, and this
  // returns undefined.
  execSync(`${LIFECYCLE} ${JSON.stringify(`cd ${REMOTE_DIR} && scripts/lifecycle-agriculture.sh ${action} ${recordId} 2>&1`)}`,
           { encoding: 'utf8' })
    .trim().split('\n').filter((l) => l.includes(recordId)).pop()?.trim()
    ?? `${action} produced no line naming ${recordId}`;

const first = await apply();
console.log(`\nrequest object purpose: ${JSON.stringify(first.purpose ?? '(none — the consent screen will warn the holder)')}`);
console.log(`\n1. record ACTIVE        -> ${first.answer} ${first.reason}`);

if (!LIFECYCLE || !REMOTE_DIR) {
  console.log('\n   FILM_LIFECYCLE_SSH / FILM_REMOTE_DIR not set, so suspend/reinstate was not exercised.');
} else {
  console.log(`   ${lifecycle('suspend')}`);
  const second = await apply();
  console.log(`2. record SUSPENDED     -> ${second.answer} ${JSON.stringify(second.reason)}`);
  console.log(`   ${lifecycle('reinstate')}`);
  const third = await apply();
  console.log(`3. record ACTIVE again  -> ${third.answer} ${third.reason}`);
}

console.log(`\nthe anchor to revoke in part 8:  ${anchor}`);
