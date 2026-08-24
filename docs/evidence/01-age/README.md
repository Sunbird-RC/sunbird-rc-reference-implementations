# Iteration 01 — Age Verification: evidence

**Status:** implementation complete; stack run and e2e suite **not yet executed** (see [Blocked](#blocked)).
**Branch:** `iteration/age-01-verification`
**Charter:** [`../../../iterations/01-age/CHARTER.md`](../../../iterations/01-age/CHARTER.md)
**Plan:** [`../../../iterations/01-age/IMPLEMENTATION.md`](../../../iterations/01-age/IMPLEMENTATION.md)

This file is the handoff artifact. Anything marked **not verified** has not been
run yet and must not be presented as working.

## What was built

| Component | Path | Role |
|---|---|---|
| Local stack | `deploy/` | Sunbird RC `v2.1.0` pulled from `ghcr.io/sunbird-rc/*`, plus Postgres, Vault, Redis and a single-origin nginx |
| Age source data | `registry-schemas/AgeCitizen.json` | National Identity Authority entity; the only source of credential claims |
| Issuer counter | `services/age-issuer/` | Reads the registry through its API, derives `ageOver18`/`ageOver21`, creates a pre-authorised OpenID4VCI offer |
| Verifier service | `services/verifier/` | Generic: checks gate → disclosure policy → issuer trust allowlist → domain decision. Age is one module (`src/domains/age/`) |
| Verifier page | `services/verifier-web/` | Static; shows the QR and the decision. Talks only to the verifier service |
| Trust allowlist | `config/trust/issuers.json` | Version-controlled demo trust model (DESIGN §6) |
| Tests | `tests/unit`, `tests/e2e` | 39 unit tests; scripted-wallet e2e suite over the real protocol |

**No standards adapter was needed.** Sunbird RC `v2.1.0`'s native `oid4vc-service`
covers OpenID4VCI issuance, `vc+sd-jwt` with selective disclosure, holder binding,
OpenID4VP with DCQL and QR, and single-use transaction state.

## Versions and configuration

| Component | Pin | Digest |
|---|---|---|
| `sunbird-rc-core` (registry) | `ghcr.io/sunbird-rc/sunbird-rc-core:v2.1.0` | *to record from the run* |
| `identity-service` | `ghcr.io/sunbird-rc/sunbird-rc-identity-service:v2.1.0` | *to record* |
| `credential-schema` | `ghcr.io/sunbird-rc/sunbird-rc-credential-schema:v2.1.0` | *to record* |
| `credentials-service` | `ghcr.io/sunbird-rc/sunbird-rc-credentials-service:v2.1.0` | *to record* |
| `oid4vc-service` | `ghcr.io/sunbird-rc/sunbird-rc-oid4vc-service:v2.1.0` | *to record* |
| Wallet (device run) | Paradym Wallet | *version to record at the on-device run* |
| Node (services + tests) | 22 (image), 25.6.1 (host) | — |

Source of truth for the released behaviour: local checkout of
`sunbird-rc-core` at tag `v2.1.0` (`2ade66c`).

Compatibility flags actually set:

| Flag | Value | Why |
|---|---|---|
| `OID4VP_SIGN_REQUEST` | `true` | Paradym is Credo-based and fetches the request object as `application/oauth-authz-req+jwt`; an unsigned request answers **406** |
| `VERIFIER_DID` | minted `did:web` | Signing refuses a `did:rcw`, which no third-party wallet could resolve |
| `DRAFT13_COMPAT_MODE` | `false` | Final OpenID4VCI 1.0. Draft-13 is Inji's idiom and belongs to Iteration 02 |
| `SESSION_STORE` | `redis` | Single-use codes/nonces must survive a service restart for the replay tests to mean anything |
| `STATUS_LIST_ENABLED` | `false` | Revocation infrastructure is out of scope (PRODUCT) |
| `ENABLE_AUTH` | `false` | No Keycloak in this stack; `age-issuer` is the only caller of `POST /oid4vc/offer` |
| `authentication_enabled` (registry) | `false` | Same reason |
| `search_providerName` | `NativeSearchService` | Avoids Elasticsearch entirely |

## Credential design

`AgeVerificationCredential`, `vc+sd-jwt`, ES256, all claims selectively disclosable:

| Claim | Derived? | Disclosed to the age verifier |
|---|---|---|
| `ageOver18` | yes, at issuance from `dateOfBirth` | **yes — the only one requested** |
| `ageOver21` | yes, at issuance | no |
| `dateOfBirth` | no, copied from the registry | no |
| `name` | no, copied from the registry | no |

`dateOfBirth` and `name` are in the credential on purpose. A credential carrying
only the answer would make selective disclosure untestable — "nothing leaked"
would just mean "there was nothing to leak".

The DCQL query requests `ageOver18` plus the protocol claim `iss`, with
`meta.vct_values` pinning the type, and **no `values` constraint** on the age
claim: constraining it to `true` would turn a legitimate minor into a
verification *failure* instead of a verified **DENIED**.

## Test results

### Unit — executed, passing

```
$ npm run test:unit
tests 39
pass 39
fail 0
```

Covers: calendar-correct age derivation including the 18th-birthday boundary and
leap-day births; rejection of impossible dates and of records with no date of
birth; the decision truth table including the "string `false` is truthy" trap;
the trust allowlist including an unexpanded `${VAR}` being a startup failure
rather than a wildcard; DCQL minimality (exactly two claim paths, no value
constraint, refusal to build a disclose-everything query); the verification gate
treating a *missing* check as a failure; and session expiry.

### End-to-end — **not verified**

`tests/e2e/age-verification.test.mjs` and `tests/e2e/data-isolation.test.mjs` are
written and syntax-checked but have never been run. They need the stack. Until
they run, none of the charter's acceptance criteria below can be reported as met.

## Acceptance checklist

Nothing is ticked. `[~]` means implemented and covered by a written test that has
not yet executed.

### Positive flow
- [~] A synthetic eligible citizen receives an `AgeVerificationCredential` in a wallet
- [~] The wallet scans the web verifier's QR request
- [~] The wallet shows that only `ageOver18` is requested and obtains consent — *scripted wallet covers the protocol; the consent screen itself needs the Paradym device run*
- [~] The wallet presents `ageOver18 = true` without unrelated identity claims
- [~] The verifier validates the presentation and displays **APPROVED**

### Negative and privacy flows
- [~] A valid `ageOver18 = false` presentation returns **DENIED**
- [~] User denial/cancellation discloses nothing and does not approve
- [~] Tampered credential and tampered disclosure are rejected
- [~] An issuer outside the allowlist is rejected — *with a cryptographically valid credential*
- [~] Wrong holder key is rejected
- [~] Incorrect nonce and incorrect audience are rejected
- [~] Expired/unknown transaction and replayed presentation are rejected
- [~] Verifier output carries no undisclosed identity claims

### Engineering evidence
- [~] Clean checkout starts the stack with documented commands
- [x] Automated tests cover the decision logic and verification failures (unit executed; e2e written)
- [~] Integration tests cover issuance and presentation endpoints
- [ ] Versions, wallet version, configuration mode and limitations recorded — *partially; digests and wallet build pending the run*
- [ ] Kartheek demonstrates the flow to Anand

## Reproducing

```bash
cd deploy && cp env.example .env && docker compose up -d   # registry needs 2-4 min
../scripts/bootstrap.sh          # Vault kv, three did:web identities, schemas
../scripts/seed-age-citizens.sh  # synthetic citizens
cd .. && npm install
npm run test:unit
npm run test:e2e
./scripts/demo.sh                # scripted positive + negative walkthrough
open http://localhost/verifier/
```

## Known limitations and deviations

1. **v2.1.0's verifier does not check issuer identity.** Its six checks cover
   signature, nonce, audience, holder binding, revocation and DCQL — never
   *whose* signature. `services/verifier` enforces the allowlist, as DESIGN §4
   and §6 require. Worth reporting upstream.
2. **The algorithm allowlist is not enforced at the verifier.** A presentation's
   JWS `alg` is not observable through `/vp/status`, so a policy field for it
   would be a control that does nothing — the same trap upstream calls out for
   `tx_code`. It is therefore *absent by decision*, and the constraint holds only
   by construction (identity-service signs SD-JWT VCs with ES256). Recorded here
   rather than implemented as a no-op.
3. **`revocation: OK` is a default, not a check** (`STATUS_LIST_ENABLED=false`).
   Out of scope per PRODUCT; must not be presented as verified revocation.
4. **`did:web` on localhost is not externally resolvable.** The method mandates
   https. identity-service resolves its own DIDs from its database, so the local
   flows work; a phone needs the HTTPS host.
5. **`platform.*` stays empty.** Protocol transaction state lives in Redis and
   the protocol services keep their own databases, so DESIGN §7's `platform`
   schema is created but unused in this iteration.
6. **Wallet choice deviates from COMPATIBILITY's candidate** (EUDI Android) in
   favour of Paradym, which is already exercised against these APIs. That
   document leaves wallet selection to Kartheek, so this is a recorded
   engineering decision, not a baseline change. Upstream's own evidence covers
   Paradym for *presentation* only; credential collection is evidenced by the
   `demo-oid4vc` round-trip on an interim image, so issuance into Paradym must be
   re-confirmed on this stack.
7. **The iteration branch was cut from `docs/first-handshake`, not `main`.** That
   branch is three documentation commits ahead of `main` and carries the
   handshake docs this work references. GIT-WORKING-MODEL says an iteration
   branch starts from the latest accepted `main`; flagging the difference rather
   than quietly rebasing.
8. **Turning on `ENABLE_AUTH` will require a token in the verifier service.**
   `POST /vp/request` and `GET /vp/status/:id` carry `@UseGuards(KeycloakAuthGuard)`
   in `oid4vp.controller.ts` — a no-op while `ENABLE_AUTH=false`, but on the dev
   deployment `services/verifier` will need a `client_credentials` token for both
   calls. Noted now because the deployment posture is otherwise ready for auth:
   we never use the registry offer hook, which is the caller that cannot send one.
9. **The verifier page is a static page, not the React app** the plan mentioned
   adapting from `demo-oid4vc/verifier-app`. It needs no build step, so the whole
   stack builds offline; the UI patterns were carried over, the toolchain was not.

## Blocked

The stack has never started on this machine. The host disk was full (163 MB free
of 228 GB), which failed mid-pull and corrupted Docker's containerd image store —
every Docker write, including `docker system prune`, returns
`input/output error` on `io.containerd.metadata.v1.bolt/meta.db`.

Purging Docker's disk image (~23 GB) both frees the space and repairs the
corruption. Until that is done, the e2e suite, the data-isolation checks, the
image digests and the on-device Paradym run are all outstanding.
