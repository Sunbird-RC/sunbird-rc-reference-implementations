// A scripted holder wallet.
//
// It stands in for a real mobile wallet in the automated suite, and it exists
// for three reasons a real wallet cannot serve:
//
//  1. It can be wrong on purpose — sign with the wrong key, quote the wrong
//     nonce, tamper with a disclosure. Those are the tests that prove
//     verification is real rather than decorative.
//  2. It makes the presentation inspectable. /vp/status returns only
//     DCQL-matched claims, so "the verifier learned nothing else" can ONLY be
//     proven against the raw presentation, which means holding it here.
//  3. It runs in CI, on any machine, with no device in the loop.
//
// It speaks the same protocol as Paradym: OpenID4VCI pre-authorised code with an
// ES256 proof-of-possession, then OpenID4VP direct_post with an SD-JWT+KB
// presentation.

import * as jose from 'jose';

const ES256 = 'ES256';

/** Creates a fresh holder key pair — the wallet's device-bound key. */
export async function createHolder() {
  const { publicKey, privateKey } = await jose.generateKeyPair(ES256, { extractable: true });
  const publicJwk = await jose.exportJWK(publicKey);
  publicJwk.alg = ES256;
  return { publicKey, privateKey, publicJwk };
}

async function http(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  return { status: res.status, body, text };
}

async function expectOk(label, promise) {
  const res = await promise;
  if (res.status >= 400) {
    throw new Error(`${label} -> ${res.status}: ${typeof res.body === 'string' ? res.body.slice(0, 200) : JSON.stringify(res.body).slice(0, 200)}`);
  }
  return res.body;
}

const PREAUTH_GRANT = 'urn:ietf:params:oauth:grant-type:pre-authorized_code';

/**
 * Collects a credential from an offer, exactly as a wallet would: dereference
 * the offer, redeem the pre-authorised code, prove possession of the holder key,
 * receive the credential.
 *
 * @param {{base: string, offer: {credentialOfferUri?: string, credential_offer_uri?: string}, holder: object}} args
 * @returns {Promise<{credential: string, format: string, accessToken: string, preAuthorizedCode: string}>}
 */
export async function collectCredential({ base, offer, holder }) {
  const offerUri = offer.credentialOfferUri || offer.credential_offer_uri;
  const offerObject = await expectOk('dereference offer', http(offerUri));
  const code = offerObject?.grants?.[PREAUTH_GRANT]?.['pre-authorized_code'];
  if (!code) throw new Error(`offer carries no pre-authorised code: ${JSON.stringify(offerObject)}`);

  const token = await redeemCode({ base, code });
  const credential = await requestCredential({ base, token, holder });
  return { ...credential, accessToken: token.access_token, preAuthorizedCode: code };
}

/** @returns {Promise<{access_token: string, c_nonce: string}>} */
export async function redeemCode({ base, code }) {
  return expectOk(
    'token',
    http(`${base}/oid4vc/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: PREAUTH_GRANT, 'pre-authorized_code': code }).toString(),
    }),
  );
}

/** Attempts to redeem a code without asserting success — for the reuse test. */
export async function tryRedeemCode({ base, code }) {
  return http(`${base}/oid4vc/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: PREAUTH_GRANT, 'pre-authorized_code': code }).toString(),
  });
}

/**
 * Proof of possession of the holder key, bound to the issuer (aud) and to a
 * single-use c_nonce. This is what makes the issued credential holder-bound:
 * oid4vc-service copies the key out of this proof into the credential's `cnf`.
 */
export async function proofOfPossession({ base, holder, nonce }) {
  return new jose.SignJWT({ aud: base, nonce })
    .setProtectedHeader({ alg: ES256, typ: 'openid4vci-proof+jwt', jwk: holder.publicJwk })
    .setIssuedAt()
    .sign(holder.privateKey);
}

export async function requestCredential({ base, token, holder }) {
  const proof = await proofOfPossession({ base, holder, nonce: token.c_nonce });
  const body = await expectOk(
    'credential',
    http(`${base}/oid4vc/credential`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ proof: { proof_type: 'jwt', jwt: proof } }),
    }),
  );
  if (!body?.credential) throw new Error(`no credential in response: ${JSON.stringify(body).slice(0, 200)}`);
  return { credential: body.credential, format: body.format };
}

// --- SD-JWT handling ---------------------------------------------------------

/**
 * Splits an SD-JWT VC into its issuer-signed JWS and its disclosures.
 *
 * Wire format: <jws>~<disclosure>~...~<disclosure>~  (trailing tilde, no KB-JWT
 * until the holder presents it).
 */
export function parseSdJwt(sdJwt) {
  const parts = sdJwt.split('~');
  const jws = parts[0];
  const disclosures = parts.slice(1).filter((p) => p.length > 0);
  return {
    jws,
    disclosures: disclosures.map((raw) => {
      const [salt, name, value] = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      return { raw, salt, name, value };
    }),
    payload: jose.decodeJwt(jws),
  };
}

/** Claim names the credential can disclose. */
export function disclosableClaims(sdJwt) {
  return parseSdJwt(sdJwt).disclosures.map((d) => d.name).sort();
}

/**
 * Builds a presentation that reveals ONLY the named claims.
 *
 * This is the selective-disclosure step: withheld disclosures are simply not
 * sent, and the verifier cannot recover them — the signed payload holds only
 * salted digests. The Key Binding JWT proves the presenter controls the key the
 * credential was issued to, and carries the verifier's nonce and audience so the
 * presentation cannot be replayed elsewhere.
 *
 * @param {object} args
 * @param {string} args.credential
 * @param {string[]} args.disclose claim names to reveal
 * @param {string} args.nonce      from the verifier's request
 * @param {string} args.audience   the request's client_id
 * @param {object} args.holder     signing key (pass a DIFFERENT holder to forge)
 * @param {(disclosures: object[]) => object[]} [args.tamperDisclosures]
 * @param {(jws: string) => string} [args.tamperJws]
 */
export async function presentSdJwt({
  credential,
  disclose,
  nonce,
  audience,
  holder,
  tamperDisclosures,
  tamperJws,
}) {
  const parsed = parseSdJwt(credential);
  let selected = parsed.disclosures.filter((d) => disclose.includes(d.name));
  const missing = disclose.filter((name) => !selected.some((d) => d.name === name));
  if (missing.length) throw new Error(`credential cannot disclose: ${missing.join(', ')}`);
  if (tamperDisclosures) selected = tamperDisclosures(selected);

  const jws = tamperJws ? tamperJws(parsed.jws) : parsed.jws;

  // typ 'kb+jwt' per the SD-JWT VC key-binding profile. Verified against the
  // credential's own `cnf` — so signing with any other key fails.
  const kbJwt = await new jose.SignJWT({ nonce, aud: audience })
    .setProtectedHeader({ alg: ES256, typ: 'kb+jwt' })
    .setIssuedAt()
    .sign(holder.privateKey);

  return [jws, ...selected.map((d) => d.raw), kbJwt].join('~');
}

/** Re-encodes a disclosure with a different value, keeping its salt and name. */
export function forgeDisclosureValue(disclosure, newValue) {
  const raw = Buffer.from(JSON.stringify([disclosure.salt, disclosure.name, newValue])).toString('base64url');
  return { ...disclosure, raw, value: newValue };
}

// --- OpenID4VP ---------------------------------------------------------------

/**
 * Fetches and reads the verifier's request object.
 *
 * `Accept: application/oauth-authz-req+jwt` is required, not optional: signed
 * transactions are served as a JWS and oid4vc-service answers 406 if the wallet
 * asks for something else. Paradym behaves this way, which is why request
 * signing is on for this stack at all.
 */
export async function fetchRequestObject({ base, transactionId }) {
  const res = await fetch(`${base}/vp/request-object/${transactionId}`, {
    headers: { accept: 'application/oauth-authz-req+jwt' },
  });
  if (!res.ok) throw new Error(`request-object -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const jws = (await res.text()).trim();
  // A real wallet resolves client_id's DID and verifies this signature. The
  // suite reads the claims; DID resolution over did:web:localhost is covered by
  // the on-device run instead.
  return { jws, ...jose.decodeJwt(jws) };
}

/** Submits a presentation via direct_post. Does not assert success. */
export async function submitPresentation({ base, state, queryId, presentation }) {
  return http(`${base}/vp/response`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ state, vp_token: JSON.stringify({ [queryId]: [presentation] }) }),
  });
}
