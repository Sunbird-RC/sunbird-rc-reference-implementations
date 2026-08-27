// Signs a citizen in at Keycloak the way the wallet's in-app browser does:
// authorization_code with PKCE, then the token exchange.
//
// It drives the REAL login page — discovery, the rendered form, the cookies, the
// redirect carrying the code. That is deliberate: the fork's unit tests already
// prove how the issuer treats a Keycloak token, so what is left to prove is that
// a live Keycloak, configured by our realm import and reached through nginx,
// actually issues a token carrying the right citizen. Nothing here is mocked.
//
// The password is never hardcoded. It is generated at bootstrap and read from
// gitignored local configuration (answer 3: no committed credentials), so these
// tests skip themselves rather than invent one.

import * as jose from 'jose';

/** Same client the wallet uses — see deploy/keycloak/realm-age.json. */
export const WALLET_CLIENT_ID = 'id.animo.paradym';

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

/** PKCE S256, as the realm's client requires. */
async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

/** Keycloak spreads its session across several cookies; carry all of them. */
function cookieJar() {
  const jar = new Map();
  return {
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(';');
        const eq = pair.indexOf('=');
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

/** The login form's action URL, from the page Keycloak actually rendered. */
function loginFormAction(html) {
  const form = html.match(/<form[^>]*id="kc-form-login"[^>]*>/i)?.[0];
  const action = form?.match(/action="([^"]+)"/i)?.[1];
  if (!action) {
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
    throw new Error(`Keycloak did not render a login form${title ? ` (page: ${title})` : ''}`);
  }
  return action.replace(/&amp;/g, '&');
}

export async function discover(authorizationServer) {
  const res = await fetch(`${authorizationServer}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`Keycloak discovery -> ${res.status} at ${authorizationServer}`);
  return res.json();
}

/**
 * Completes the authorization_code flow for one citizen.
 *
 * @returns {Promise<{accessToken: string, claims: object, redirect: string}>}
 *          On a rejected login, resolves with `{error}` instead of throwing —
 *          the wrong-password case is a test, not a failure.
 */
export async function signIn({
  authorizationServer,
  clientId = WALLET_CLIENT_ID,
  redirectUri,
  username,
  password,
  scope = 'openid',
}) {
  const meta = await discover(authorizationServer);
  const { verifier, challenge } = await pkce();
  const state = b64url(crypto.getRandomValues(new Uint8Array(8)));
  const jar = cookieJar();

  const authorize = new URL(meta.authorization_endpoint);
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();

  const page = await fetch(authorize, { redirect: 'manual' });
  jar.absorb(page);
  if (page.status >= 400) throw new Error(`authorization request -> ${page.status}: ${(await page.text()).slice(0, 300)}`);

  const submitted = await fetch(loginFormAction(await page.text()), {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: jar.header() },
    body: new URLSearchParams({ username, password, credentialId: '' }).toString(),
  });
  jar.absorb(submitted);

  const location = submitted.headers.get('location');
  if (!location) {
    // Keycloak re-renders the form with an error rather than redirecting.
    const html = await submitted.text();
    const message = html.match(/id="input-error[^"]*"[^>]*>\s*([^<]+)/i)?.[1]?.trim();
    return { error: message || `login not accepted (HTTP ${submitted.status})` };
  }
  const returned = new URL(location, authorizationServer);
  const code = returned.searchParams.get('code');
  if (!code) {
    return { error: returned.searchParams.get('error_description') || returned.searchParams.get('error') || 'no code returned' };
  }
  if (returned.searchParams.get('state') !== state) throw new Error('state mismatch in the redirect');

  const tokenRes = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    }).toString(),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok || !token.access_token) {
    throw new Error(`token exchange -> ${tokenRes.status}: ${JSON.stringify(token).slice(0, 300)}`);
  }
  return {
    accessToken: token.access_token,
    claims: jose.decodeJwt(token.access_token),
    redirect: location,
  };
}
