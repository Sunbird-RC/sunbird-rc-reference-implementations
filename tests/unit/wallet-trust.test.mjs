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

/** The trusted-OID4VCI-issuer list as text. This is the issuance side. */
function trustedIssuerBlock() {
  const list = source.slice(source.indexOf('export const trustedOpenId4VciIssuerEntities'));
  return list.slice(0, list.indexOf('satisfies Array<TrustedOpenId4VciEntity>'));
}

/** Each issuer entity as `{ issuer, block }`, in source order. Order matters. */
function trustedIssuers() {
  return trustedIssuerBlock()
    .split(/\n  \{/)
    .slice(1)
    .map((block) => ({ issuer: block.match(/^\s*issuer: '([^']+)'/m)?.[1], block }))
    .filter((e) => e.issuer);
}

/** The issuer entities this repository added, again identified by our own logos. */
function showcaseIssuers() {
  return trustedIssuers().filter((e) => e.block.includes('/assets/logos/'));
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


// The presentation side, and the same ordering trap as the issuer list below.
//
// packages/sdk/src/trust/handlers/did.ts resolves a client id with
//   trustedDidEntities.find((e) => baseDid.startsWith(e.did))
// so a host-scoped entry is a prefix of EVERY did:web minted on that host. This
// deployment now signs presentation requests with two different verifier DIDs —
// the age-restricted service and the bank — and a host-scoped entry listed above
// either of them claims both. It did: the fallback was named "Age Check", and a
// farmer applying for crop credit was asked to trust Age Check.
describe('the vendored wallet names the right verifier', () => {
  test('no DID entity is shadowed by a less specific one listed before it', () => {
    guard();
    const dids = trustedDids();
    for (let i = 0; i < dids.length; i++) {
      for (let j = i + 1; j < dids.length; j++) {
        assert.ok(
          !(dids[j] !== dids[i] && dids[j].startsWith(dids[i])),
          `'${dids[i]}' is listed before '${dids[j]}' and is a prefix of it, so it matches first ` +
            'and the wallet will name the wrong party. More specific DIDs must come first.',
        );
      }
    }
  });

  test('a host-scoped DID entity does not claim to be a party', () => {
    guard();
    // It cannot be one. Several parties are minted under this host, so any party
    // name on a host-scoped entry is right for at most one of them and silently
    // wrong for the rest after a re-bootstrap.
    const parties = [
      'Age Check',
      'Gramin Bank',
      'National Identity Authority',
      'Farmer Registry',
      'Land Registry',
      'State School Board',
      'Regional Polytechnic College',
      'State University',
      'University Admissions',
      'Employer',
    ];
    for (const entity of showcaseEntities()) {
      const did = entity.match(/^\s*did: '([^']+)'/m)?.[1] || '';
      if (did.split(':').length > 3) continue; // pinned to one deployment: a party name is correct
      const name = entity.match(/^\s*name: '([^']+)'/m)?.[1] || '';
      assert.equal(
        parties.includes(name),
        false,
        `the host-scoped entry '${did}' is named '${name}', so it will claim every other party minted on that host`,
      );
    }
  });

  test('each Education relying party presents as itself', () => {
    guard();
    // DEMO.md §2 and §3: the learner presents to the university and then to the
    // employer in one sitting. Whichever entry matched first would name both, so
    // a missing entry here does not fail — it silently mislabels one of them.
    const names = showcaseEntities()
      .map((e) => e.match(/^\s*name: '([^']+)'/m)?.[1])
      .filter(Boolean);
    for (const party of ['University Admissions', 'Employer']) {
      assert.ok(names.includes(party), `no trusted DID entity names '${party}'`);
    }
  });

  test('the bank presents as itself, not as the age service', () => {
    guard();
    // REQUIREMENTS R3.4 and DEMO.md step 4: the farmer must be shown the bank.
    const names = showcaseEntities()
      .map((e) => e.match(/^\s*name: '([^']+)'/m)?.[1])
      .filter(Boolean);
    assert.ok(
      names.includes('Gramin Bank'),
      'no trusted DID entity names the bank, so its consent screen would name whatever matched first',
    );
  });
});

// The issuance side. Every credential in the Agriculture demo is offered by one
// of two registries the wallet has never seen before, and the trust screen the
// farmer reads before accepting is drawn entirely from these entries.
describe('the vendored wallet trusts both Agriculture registries', () => {
  test('each registry the deployment runs is a trusted issuer entity', () => {
    guard();
    // Path-scoped, because both registries are served from the one demo host.
    // Absent, the wallet offers the credential under "Unknown organisation",
    // which is a demo failure and not a test failure — nothing goes red.
    const issuers = trustedIssuers().map((e) => e.issuer);
    for (const path of ['/farmer', '/land']) {
      assert.ok(
        issuers.some((issuer) => issuer.includes('sslip.io') && issuer.endsWith(path)),
        `no trusted issuer entity ends in ${path}: the wallet would call that registry unknown`,
      );
    }
  });

  test('no issuer entity is shadowed by a less specific one listed before it', () => {
    guard();
    // This is the trap this list has. The handler is
    //   trustedEntities.find((e) => issuer.startsWith(e.issuer))
    // in packages/sdk/src/trust/handlers/fallback.ts — a PREFIX match resolved by
    // the FIRST hit. The Age entry is host-scoped, so it is a prefix of both
    // Agriculture issuers; listed above them it would claim both, and a farmer
    // accepting a land credential would be told the National Identity Authority
    // was issuing it. Wrong, confidently, with a trusted badge on it.
    //
    // Nothing about that fails: the offer still resolves, the credential is still
    // stored, only the organisation name is wrong. So the ordering is asserted
    // here rather than left to whoever next appends an entry.
    const entities = trustedIssuers();
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        assert.ok(
          !(entities[j].issuer !== entities[i].issuer && entities[j].issuer.startsWith(entities[i].issuer)),
          `'${entities[i].issuer}' is listed before '${entities[j].issuer}' and is a prefix of it, ` +
            'so it will match first and the wallet will name the wrong organisation. ' +
            'More specific issuer prefixes must come first.',
        );
      }
    }
  });

  test('the two registries are named distinctly, and not as the Age issuer', () => {
    guard();
    // REQUIREMENTS §3 is that the wallet shows two INDEPENDENT issuers. Two
    // entries carrying one name would satisfy every other check here and still
    // fail the thing the demo has to show.
    const names = showcaseIssuers()
      .map((e) => e.block.match(/^\s*name: '([^']+)'/m)?.[1])
      .filter(Boolean);
    assert.equal(new Set(names).size, names.length, `showcase issuers share a name: ${names.join(', ')}`);
    for (const path of ['/farmer', '/land']) {
      const entity = showcaseIssuers().find((e) => e.issuer.endsWith(path));
      assert.ok(entity, `no showcase issuer entity for ${path}`);
      const name = entity.block.match(/^\s*name: '([^']+)'/m)?.[1];
      assert.doesNotMatch(
        name ?? '',
        /Identity Authority/,
        `${path} is presented as the Age issuer ('${name}') — see the shadowing test above`,
      );
    }
  });

  test('the showcase issuer entities are marked as demonstration entities', () => {
    guard();
    // Same reason as the DID entities: synthetic registries must not be shown
    // inside a wallet's trust UI as production-trusted.
    const entities = showcaseIssuers();
    assert.ok(entities.length > 0, 'expected to find the showcase issuer entities');
    for (const { issuer, block } of entities) {
      assert.match(block, /demo: true/, `showcase issuer ${issuer} is not marked demo: true`);
    }
  });
});


// The issuance side for Iteration 03. A learner holds THREE credentials from
// three institutions that have never heard of each other, and the trust screen
// they read before accepting each one is drawn entirely from these entries.
//
// This list has one more way to go wrong than Agriculture's did, and it is the
// reason the correlation check is worth anything: if the three institutions were
// not three distinct issuers to the wallet, "three independent authorities named
// the same learner" would be a claim about one issuer talking to itself.
describe('the vendored wallet trusts all three Education institutions', () => {
  test('each institution the deployment runs is a trusted issuer entity', () => {
    guard();
    const issuers = trustedIssuers().map((e) => e.issuer);
    for (const path of ['/school', '/college', '/university']) {
      assert.ok(
        issuers.some((issuer) => issuer.includes('sslip.io') && issuer.endsWith(path)),
        `no trusted issuer entity ends in ${path}: the wallet would call that institution unknown`,
      );
    }
  });

  test('the three institutions are named distinctly, and none as the Age issuer', () => {
    guard();
    for (const path of ['/school', '/college', '/university']) {
      const entity = showcaseIssuers().find((e) => e.issuer.endsWith(path));
      assert.ok(entity, `no showcase issuer entity for ${path}`);
      const name = entity.block.match(/^\s*name: '([^']+)'/m)?.[1];
      assert.doesNotMatch(
        name ?? '',
        /Identity Authority|Registry/,
        `${path} is presented as another iteration's issuer ('${name}')`,
      );
    }
    // Distinctness across ALL showcase issuers, not just these three: five
    // issuers now share one host, and two entries carrying one name would pass
    // every other check here while failing the thing the demo has to show.
    const names = showcaseIssuers()
      .map((e) => e.block.match(/^\s*name: '([^']+)'/m)?.[1])
      .filter(Boolean);
    assert.equal(new Set(names).size, names.length, `showcase issuers share a name: ${names.join(', ')}`);
  });

  test('the three institutions are more specific than the host-scoped fallback', () => {
    guard();
    // The generic shadowing test above proves no entry is shadowed by ANY earlier
    // prefix. This one states the specific consequence for Education, so a future
    // reordering fails with the reason rather than only the rule: matching is
    // `issuer.startsWith(e.issuer)` resolved by the first hit, so the host-scoped
    // Age entry claims all three if it is listed first, and a learner collecting a
    // degree is told the National Identity Authority issued it.
    const entities = trustedIssuers();
    const hostOnly = entities.findIndex((e) => /sslip\.io\/?$/.test(e.issuer));
    assert.notEqual(hostOnly, -1, 'expected a host-scoped showcase fallback');
    for (const path of ['/school', '/college', '/university']) {
      const at = entities.findIndex((e) => e.issuer.endsWith(path));
      assert.ok(at !== -1 && at < hostOnly, `${path} must be listed before the host-scoped fallback`);
    }
  });
});
