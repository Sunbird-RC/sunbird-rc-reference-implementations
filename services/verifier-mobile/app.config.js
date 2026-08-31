// The installed mobile verifier, Flow 3.
//
// Versions are pinned to the exact set already proven on this hardware by the
// wallet build (Expo 56.0.12 / React Native 0.85.3 / React 19.2.3), so the
// Android toolchain — NDK 27, Gradle 9.3.1, build-tools 36 — is known to work
// rather than hoped to.
//
// Which use case this build IS is decided here, not at runtime. Same reason the
// wallet's issuer directory is baked in with CREDENTIAL_ISSUER_URLS: the
// Agriculture demo must not put an Age option in front of anyone, and a picker
// on the idle screen does exactly that. One app, one channel, chosen at build
// time:
//
//   VERIFIER_USE_CASE=age          ./build   -> "Age Check",   /api/verifier
//   VERIFIER_USE_CASE=agriculture  ./build   -> "Farm Credit", /api/verifier/agriculture
//
// The PACKAGE deliberately does not change. PRODUCT.md lists an
// "Agriculture-specific mobile verifier application" as out of scope, so this
// stays one application serving both channels rather than becoming two apps —
// which is also why the two builds replace each other on a device, as the wallet
// builds do.
const USE_CASE = process.env.VERIFIER_USE_CASE ?? 'age';
const NAMES = { age: 'Age Check', agriculture: 'Farm Credit' };
if (!NAMES[USE_CASE]) {
  throw new Error(`VERIFIER_USE_CASE must be 'age' or 'agriculture', got '${USE_CASE}'`);
}

export default {
  expo: {
    name: NAMES[USE_CASE],
    slug: 'age-verifier-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    android: {
      // Its own package, so it installs beside the wallet rather than over it.
      package: 'id.sunbird.ageverifier',
      versionCode: 1,
    },
    plugins: ['./plugins/with-openid4vp-query'],
    extra: {
      // Where the reusable verifier service lives. The app makes exactly two
      // calls to it and renders the answer; it never inspects a credential.
      verifierBaseUrl: process.env.VERIFIER_BASE_URL ?? 'https://135.235.192.9.sslip.io',
      // The one channel this build serves. Read once, at start-up.
      useCase: USE_CASE,
    },
  },
};
