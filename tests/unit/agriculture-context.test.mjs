// The Agriculture JSON-LD context, checked the way it actually fails.
//
// Iteration 02 lost time to this: JSON-LD safe mode does not reject a claim it
// cannot map, it DROPS it. A credential then signs and verifies while quietly
// carrying less than it appears to, and the loss shows up at a verifier rather
// than at the issuer. So these tests assert on the expanded output, not on the
// context document being well-formed — a context can be perfectly valid JSON and
// still silently discard every claim in it.
//
// Hermetic on purpose: the document loader refuses the network. A test that
// passes only when sunbirdrc.dev resolves would be testing DNS.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import jsonld from 'jsonld';

const URL_CTX = 'https://w3id.org/sunbird-rc/agriculture/v1';
const NS = `${URL_CTX}#`;
const context = JSON.parse(
  readFileSync(new URL('../../contexts/agriculture/v1/context.jsonld', import.meta.url), 'utf8'),
);

const loader = async (url) => {
  if (url === URL_CTX) return { contextUrl: null, documentUrl: url, document: context };
  throw new Error(`document loader refused to fetch ${url}`);
};

const expand = (subject) =>
  jsonld.expand({ '@context': URL_CTX, ...subject }, { documentLoader: loader, safe: true });

const iris = (expanded) => Object.keys(expanded[0] ?? {}).filter((k) => k !== '@type');

const FARMER = { farmerReference: 'farmer:mh:F-004821', registrationStatus: true };
const LAND = {
  farmerReference: 'farmer:mh:F-004821',
  parcelReference: 'land:mh:P-11947',
  ownershipStatus: 'ACTIVE',
  cropType: 'SUGARCANE',
  cultivatedArea: 2.75,
  jurisdiction: 'mh',
};

test('every Farmer claim expands to an absolute IRI, none dropped', async () => {
  const got = iris(await expand(FARMER));
  assert.deepEqual(got.sort(), [`${NS}farmerReference`, `${NS}registrationStatus`].sort());
});

test('every Land claim expands to an absolute IRI, none dropped', async () => {
  const got = iris(await expand(LAND));
  assert.deepEqual(
    got.sort(),
    ['farmerReference', 'parcelReference', 'ownershipStatus', 'cropType', 'cultivatedArea', 'jurisdiction']
      .map((t) => NS + t)
      .sort(),
  );
});

test('an unmapped claim is refused, not silently dropped', async () => {
  // nationalId is deliberately absent from the vocabulary. If safe mode ever
  // stops being used at issuance this test still documents why it must be.
  await assert.rejects(() => expand({ ...FARMER, nationalId: 'XXXX-XXXX' }), /safe mode/i);
});

test('credential types expand into the Agriculture vocabulary', async () => {
  for (const type of ['FarmerIdentityCredential', 'LandOwnershipCredential']) {
    const expanded = await expand({ type });
    assert.deepEqual(expanded[0]['@type'], [NS + type]);
  }
});

test('terms are protected, so a later context cannot redefine them', async () => {
  // @protected is what stops a second context in the array from re-pointing
  // `cultivatedArea` at a different IRI or unit after this one is released.
  const hostile = {
    '@context': [URL_CTX, { cultivatedArea: 'https://example.invalid/hectares' }],
    cultivatedArea: 2.75,
  };
  await assert.rejects(
    () => jsonld.expand(hostile, { documentLoader: loader, safe: true }),
    /protected/i,
  );
});

test('the context declares no @vocab, so nothing maps by accident', () => {
  assert.equal(context['@context']['@vocab'], undefined);
  assert.equal(context['@context']['@version'], 1.1);
  assert.equal(context['@context']['@protected'], true);
});
