// The installed mobile verifier, Flow 3.
//
// Versions are pinned to the exact set already proven on this hardware by the
// wallet build (Expo 56.0.12 / React Native 0.85.3 / React 19.2.3), so the
// Android toolchain — NDK 27, Gradle 9.3.1, build-tools 36 — is known to work
// rather than hoped to.
export default {
  expo: {
    name: 'Age Check',
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
    },
  },
};
