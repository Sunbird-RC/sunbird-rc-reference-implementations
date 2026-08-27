// The vendored wallet's trust configuration, checked as source.
//
// These invariants are structural, so they belong here rather than in verify.sh:
// they hold on any clean checkout with no stack running and no device attached.
// verify.sh checks the complementary half — that the pinned values match the
// deployment currently in deploy/.env.
//
// Why bother: the wallet's trust entries are build-time constants compiled into
// an APK. Break one and nothing fails, nothing logs, and no test goes red — the
// wallet simply calls the verifier an unknown organisation, which is only visible
// to a person holding the phone. That is precisely the failure this iteration was
// sent back to fix once already.

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONSTANTS = join(ROOT, 'vendor', 'paradym-wallet', 'apps', 'wallet', 'src', 'constants.ts');

const source = existsSync(CONSTANTS) ? readFileSync(CONSTANTS, 'utf8') : null;
const guard = () => {
  if (!source) throw new Error(`no vendored wallet at ${CONSTANTS} — run ./scripts/vendor-wallet.sh`);
};

/** The trusted-DID list as text, without the entities upstream ships. */
function trustedDidBlock() {
  const list = source.slice(source.indexOf('export const trustedDidEntities'));
  return list.slice(0, list.indexOf('satisfies Array<TrustedDidEntity>'));
}

/** Every `did:` value in that list, in source order. */
function trustedDids() {
  return [...trustedDidBlock().matchAll(/^\s*did: '([^']+)'/gm)].map((m) => m[1]);
}

/**
 * The entities this repository added, identified by the one thing only we can
 * serve: a logo out of `services/web-assets/logos/`. Upstream's own entities
 * (Animo's paradym.id deployments) are deliberately out of scope — they are fixed
 * addresses, not infrastructure this showcase re-provisions.
 */
function showcaseEntities() {
  return trustedDidBlock()
    .split(/\n  \{/)
    .filter((entity) => entity.includes('/assets/logos/'));
}

describe('the vendored wallet trusts this showcase', () => {
  test('the showcase verifier is a trusted DID entity', () => {
    guard();
    const ours = trustedDids().filter((did) => did.includes('sslip.io'));
    assert.ok(ours.length > 0, 'no showcase verifier in trustedDidEntities — the wallet would call it unknown');
  });

  test('every pinned showcase DID has a host-scoped fallback beside it', () => {
    guard();
    // The uuid in a `did:web:<host>:<uuid>` is minted by bootstrap, so it changes
    // whenever the deployment is re-provisioned. The bare `did:web:<host>` entry
    // is what keeps the wallet naming the organisation across a re-bootstrap
    // without rebuilding the APK — the property the prefix-matching fix in
    // packages/sdk/src/trust/handlers/did.ts exists to enable. Deleting it is a
    // one-line, silent regression.
    const dids = trustedDids();
    const ours = showcaseEntities()
      .map((entity) => entity.match(/^\s*did: '([^']+)'/m)?.[1])
      .filter(Boolean);
    assert.ok(ours.length > 0, 'expected to find the showcase trust entities');
    for (const did of ours) {
      const parts = did.split(':');
      if (parts.length <= 3) continue; // already host-scoped
      const host = parts.slice(0, 3).join(':');
      assert.ok(
        dids.includes(host),
        `${did} is pinned to one deployment with no '${host}' fallback: a re-bootstrap would silently make the verifier unknown`,
      );
    }
  });

  test('every showcase logo the wallet points at is actually served from this repo', () => {
    guard();
    // The wallet renders these on the trust screen. A logoUri that 404s shows a
    // placeholder, which reads as a half-configured issuer to anyone watching.
    const logos = [...source.matchAll(/logoUri: '([^']*\/assets\/logos\/[^']+)'/g)].map((m) => m[1]);
    assert.ok(logos.length > 0, 'expected the showcase entities to carry logos');
    for (const uri of logos) {
      const file = uri.slice(uri.indexOf('/assets/logos/') + '/assets/logos/'.length);
      assert.ok(
        existsSync(join(ROOT, 'services', 'web-assets', 'logos', file)),
        `${uri} has no file at services/web-assets/logos/${file}`,
      );
    }
  });

  test('the showcase entities are marked as demonstration entities', () => {
    guard();
    // They are synthetic. Presenting them as production-trusted inside a wallet's
    // own trust UI would misrepresent them, so the badge has to stay honest.
    const blocks = showcaseEntities();
    assert.ok(blocks.length > 0);
    for (const block of blocks) {
      assert.match(block, /demo: true/, `a showcase trust entity is not marked demo: true:\n${block.slice(0, 160)}`);
    }
  });
});
