// Android 11+ package visibility: an app cannot even ASK whether another app can
// handle a URL unless it declares the intent in <queries>. Without this,
// Linking.canOpenURL('openid4vp://…') returns false on a device where the wallet
// is installed and handling that scheme perfectly well — which is exactly what
// happened on the first run of this app.
//
// A config plugin rather than a hand edit, because `expo prebuild` regenerates
// AndroidManifest.xml and would silently drop it.
const { withAndroidManifest } = require('@expo/config-plugins');

const SCHEMES = ['openid4vp', 'openid-vc', 'haip'];

module.exports = function withOpenid4vpQuery(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries ?? [{}];
    const queries = manifest.queries[0];
    queries.intent = queries.intent ?? [];

    for (const scheme of SCHEMES) {
      const already = queries.intent.some((intent) =>
        (intent.data ?? []).some((d) => d?.$?.['android:scheme'] === scheme),
      );
      if (already) continue;
      queries.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': scheme } }],
      });
    }
    return cfg;
  });
};
