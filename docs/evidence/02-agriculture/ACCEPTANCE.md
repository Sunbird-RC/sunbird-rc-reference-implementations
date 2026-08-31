# Iteration 02 — Agriculture / rural credit: line-by-line acceptance

Every requirement in [`REQUIREMENTS.md`](../../../iterations/02-agriculture/REQUIREMENTS.md),
in its own order, against the evidence that closes it.

**Branch** `iteration/agriculture-02-rural-credit` · **commit** `a0b3abe7718623c011401e6f4be1c39fb48d0f65`

| Source | Where |
|---|---|
| **V** — the demonstration video, by part | [`Agriculture-Rural-Credit-Showcase-31Aug.mp4`](Agriculture-Rural-Credit-Showcase-31Aug.mp4) |
| **U** — unit suite, 101 passed | [`runs/test-unit.txt`](runs/test-unit.txt) |
| **E** — end-to-end suite, 96 passed, against the deployment | [`runs/test-e2e.txt`](runs/test-e2e.txt) |
| **C** — `verify.sh`, 100 passed / 0 failed / 0 skipped | [`runs/verify.txt`](runs/verify.txt) |
| **A** — Age regression, 39 unit + 51 e2e | [`runs/age-regression.txt`](runs/age-regression.txt) |
| **cfg** — version-controlled configuration | paths given inline |

Status is one of **MET**, **MET (deviation)** — closed, with a difference stated
here and in [Known deviations](#known-deviations) — or **N/A**, out of scope by
PRODUCT or REQUIREMENTS.

---

## 1. Required demonstration workflows

### R1 — Farmer credential issuance

| # | Requirement | Evidence | Status |
|---|---|---|---|
| 1 | The farmer opens the wallet | **V** part 1 | MET (deviation — wallet) |
| 2 | Authenticates through Keycloak with a synthetic National ID-linked account | **V** part 2 · **E** Flow 2 "the account is linked to exactly one national id, and Keycloak says which" | MET |
| 3 | The wallet shows the Farmer Registry as a relevant issuer | **V** part 1, the directory held on screen · **E** "each names itself, so a wallet can label the entry" · **C** "the farmer issuer advertises only its own credential" | MET |
| 4 | The farmer requests `FarmerIdentityCredential` | **V** part 2 · **E** Flow 2 "one sign-in yields both credentials, each from its own registry" | MET |
| 5 | The issuer resolves the authenticated National ID to exactly one Farmer record | **E** Flow 2 "each credential is built from that farmer's own registry record", "a second farmer gets their own records, not the first farmer's" | MET |
| 6 | Returns a holder-bound credential derived from that record | **E** "both are SD-JWT VCs bound to the same wallet key" | MET |
| 7 | The farmer previews, accepts and stores it | **V** part 2, the claims held on screen before Accept | MET |

### R2 — Land credential issuance

| # | Requirement | Evidence | Status |
|---|---|---|---|
| 1 | The wallet shows the Land Registry as the other relevant issuer | **V** parts 1 and 3 | MET |
| 2 | The farmer requests `LandOwnershipCredential` | **V** part 3 · **E** Flow 2 | MET |
| 3 | The Land issuer resolves the authenticated National ID to Farmer ID and one owned Land record, by its own mapping | **E** Flow 2 "each credential is built from that farmer's own registry record" · `LandRecord.json` carries its own `nationalId` · **cfg** `deploy/docker-compose.yml` `REGISTRY_SUBJECT_ENTITY=LandRecord` | MET |
| 4 | The wallet or caller cannot select an arbitrary Farmer ID or Land ID | **E** Flow 2 "an account with no national id claim receives no credential", "a token from the Age realm buys nothing from a registry" · **cfg** `KEYCLOAK_SUBJECT_CLAIM=nationalId` — the subject comes from the token, never the request | MET |
| 5 | Returns a holder-bound credential derived from the Land record | **E** "both are SD-JWT VCs bound to the same wallet key" | MET |
| 6 | The farmer previews, accepts and stores it | **V** part 3 | MET |

### R3 — Bank farm-credit verification

| # | Requirement | Evidence | Status |
|---|---|---|---|
| 1 | The bank starts a farm-credit request and displays a QR code | **V** part 4, the laptop page and its code | MET |
| 2 | The wallet scans the request | **V** part 4, the phone camera on the laptop screen | MET |
| 3 | The wallet identifies the Farmer and Land credentials required | **V** part 4, both cards listed on the review screen | MET |
| 4 | The wallet displays the bank identity, request purpose, credentials, requested attributes and consent action | **V** part 4 — "Do you trust Gramin Bank?", both cards, six attributes, Share | MET (deviation — purpose) |
| 5 | The farmer consents | **V** part 4 | MET |
| 6 | The wallet presents the minimum required claims from both credentials | **E** "exactly the requested claims reach the bank, and nothing else" | MET |
| 7 | The verifier validates both presentations before running the loan rule | **U** `verification-gate` · **E** "only one of the two credentials presented" · **C** "it is checked before the domain decision" | MET |
| 8 | The verifier confirms `farmerId` matches across the credentials | **V** part 7 · **E** "two credentials naming different farmers" · **U** `agriculture-decision` | MET |
| 9 | The decision module calculates the loan from verified crop and cultivated acreage | **V** parts 4–5, the calculation on screen · **U** `agriculture-loan` | MET |
| 10 | The bank displays ELIGIBLE — Maximum Loan ₹X, or NOT ELIGIBLE | **V** part 5 (ELIGIBLE ₹1,20,000) and part 6 (NOT ELIGIBLE) | MET |

## 2. Identity and mapping

| Requirement | Evidence | Status |
|---|---|---|
| Keycloak accounts map deterministically to synthetic National IDs | **cfg** `deploy/keycloak/realm-agriculture.json` — eight accounts, each with a `nationalId` attribute · **E** Flow 2 | MET |
| Each National ID maps to at most one Farmer ID | **cfg** `scripts/seed-agriculture.sh` · **E** Flow 2 "a second farmer gets their own records" | MET |
| Each demo Farmer ID maps to one Land ID | **cfg** seed fixtures — 6 Farmer, 5 Land records | MET |
| National ID, Farmer ID and Land ID use different formats and sequences | `NAT-9xxxxxxx`, `FRM-XX-nnnn`, `LAND-XXX-nnnnnn` — **cfg** `registry-schemas/*.json` | MET |
| The same synthetic farmers appear consistently across Keycloak and both registries, with an issuer-side National ID mapping in each | **cfg** both registry schemas carry their own `nationalId` · **E** Flow 2 | MET |
| Each registry retains its own tables and authoritative metadata | **E** `data-isolation` · **cfg** separate `FarmerRecord` / `LandRecord` entities | MET |
| National ID is never the presentation-correlation value | **E** "neither credential carries the National ID", Flow 2 "the national id is never a claim in either credential" | MET |
| The authenticated account cannot obtain another farmer's credential | **E** Flow 2 "a second farmer gets their own records, not the first farmer's" | MET |
| Unmapped National ID, missing Farmer record and missing Land record fail safely | **E** Flow 2 three refusal tests · **E** "only one of the two credentials presented" | MET |

## 3. Issuer requirements

| Requirement | Evidence | Status |
|---|---|---|
| Both registries have different stable issuer identifiers | **E** "they are signed by two different issuers", Flow 2 "the two registries sign with different keys" | MET |
| Independent signing material and credential configuration | **cfg** `bootstrap.sh` mints `FARMER_ISSUER_DID` and `LAND_ISSUER_DID` separately | MET |
| Each issuer reads only its authorised source data | **cfg** one `REGISTRY_SUBJECT_ENTITY` per instance, no related entities declared · **E** Flow 2 "a registry refuses to issue the other registry's credential" | MET |
| The wallet lists only Farmer Registry and Land Registry | **V** part 1 · APK `assets/app.config` `credentialIssuerUrls` = the two registries · **C** three advertising checks · **U** `wallet-trust` | MET |
| The wallet clearly names both issuers | **V** parts 2 and 3 — "Do you trust Farmer Registry?" / "Land Registry?", both with a Trusted-organization badge | MET |
| Issuer configuration may be demo-configured in the wallet | **cfg** `vendor/paradym-wallet/apps/wallet/src/constants.ts` | MET |
| Issuance initiated from the wallet, with no issuance QR or issuer-counter page | **V** parts 2–3 — no QR anywhere in issuance · **C** "no issuer web page exists" | MET |

## 4. Credential requirements

| Requirement | Evidence | Status |
|---|---|---|
| Farmer credential carries `farmerId`, `registeredFarmer`, `farmerCategory`, `district` | **cfg** `registry-schemas/FarmerRecord.json` · **V** part 2, the claims on screen | MET |
| Land credential carries `landId`, `farmerId`, `ownershipStatus`, `landAreaAcres`, `cropType`, `cultivatedAreaAcres`, `district` | **cfg** `registry-schemas/LandRecord.json` · **V** part 3 | MET |
| Both use the SD-JWT VC profile supported by Sunbird RC | **E** "both are SD-JWT VCs bound to the same wallet key" · `vc+sd-jwt` / `dc+sd-jwt` | MET |
| Both bound to the wallet holder key | **E** same test · **U** `verification-gate` | MET |
| A combined presentation proves both are controlled by the same holder | **E** "two credentials held by different wallets" is rejected | MET |
| `0 <= cultivatedAreaAcres <= landAreaAcres` | **cfg** `registry-schemas/LandRecord.json` (`minimum: 0`) and `scripts/seed-agriculture.sh`, which refuses to seed a record breaking the cross-field rule the registry cannot express · **U** `agriculture-loan` rejects malformed acreage | MET (deviation — where enforced) |
| `cropType` uses a controlled demo vocabulary | **cfg** `LandRecord.json` `enum` of six crops · **U** `agriculture-decision` | MET |
| Claims derived from registry data, not accepted from wallet or bank | **E** Flow 2 "each credential is built from that farmer's own registry record" | MET |
| One Land credential per farmer for this demo | **cfg** seed fixtures | MET |

## 5. Disclosure

| Requirement | Evidence | Status |
|---|---|---|
| The request is limited to `farmerId`, `registeredFarmer` / `farmerId`, `ownershipStatus`, `cropType`, `cultivatedAreaAcres` | **E** "one request, two credentials, and only the permitted claims" — asserts the forbidden claims are never even asked for | MET |
| Evidence proves National ID, name, address, date of birth, unrequested Farmer metadata, Land ID, total land metadata, district and unrelated credentials are not disclosed | **E** "exactly the requested claims reach the bank, and nothing else" — checks the wire, not just what the verifier read, and that withheld values are unrecoverable salted digests · **V** parts 4–5, the withheld list on the bank page | MET |

## 6. Loan decision

| Requirement | Evidence | Status |
|---|---|---|
| The decision engine runs only after successful verification | **C** "it is checked before the domain decision" · **U** `verification-gate` | MET |
| Eligibility rule as specified | **U** `agriculture-decision` (20 tests) · **E** four decision paths | MET |
| `maximumLoan = cultivatedAreaAcres × cropRatePerAcre` | **U** `agriculture-loan` (19 tests) · **V** part 5 shows the arithmetic | MET |
| Rates as specified | **cfg** `config/policy/crop-rates.json` · **E** "the lending policy the bank publishes is the committed one" | MET |
| Calculations avoid floating-point currency errors | **U** `agriculture-loan` — hundredths of an acre, BigInt, half-up; tolerates `4.1 × 100 = 409.99999999999994` and refuses genuine extra precision | MET |
| Acreage precision and currency rounding deterministic and documented | **U** as above · documented in `services/verifier/src/domains/agriculture/money.mjs` and `IMPLEMENTATION.md` | MET |
| Unsupported crops and inactive ownership produce NOT ELIGIBLE | **V** part 6 · **E** two tests | MET |
| Verification failures produce REJECTED / UNABLE TO VERIFY, not NOT ELIGIBLE | **V** part 7 · **E** four rejection tests, each asserting `decision === undefined` | MET |

## 7. Required demo fixtures

| Fixture | Evidence | Status |
|---|---|---|
| Eligible Paddy farmer | `FRM-KA-0041` · **V** parts 4–5 · **E** | MET |
| Eligible Wheat farmer | `FRM-PB-0117` · **E** "wheat: a different crop gives a different rate and amount" | MET |
| Registered farmer with inactive ownership | `FRM-KA-0058` · **V** part 6 · **E** | MET |
| Registered farmer with an unsupported crop | `FRM-MH-0203` (MILLET) · **E** | MET |
| Mismatched valid Farmer and Land credentials | **V** part 7 · **E** "two credentials naming different farmers", Flow 2 "two farmers, one wallet" | MET |
| Keycloak account without National ID mapping | `farmer.unmapped` · **E** Flow 2 | MET |
| National ID without a Farmer record | `farmer.norecord` / `NAT-90099999` · **E** Flow 2 | MET |
| Farmer record without a Land record | `FRM-KA-0072` · **E** Flow 2 "a farmer with no land gets the farmer credential and no land credential" | MET |
| Cryptographically valid credential from an untrusted **Farmer** issuer | **E** "an unlisted farmer issuer is refused, though its signature is valid" | MET |
| Cryptographically valid credential from an untrusted **Land** issuer | **E** "an unlisted land issuer is refused, though its signature is valid" | MET |

## 8. Security and privacy

| Requirement | Evidence | Status |
|---|---|---|
| Validate credential signatures | **E** Age suite "a tampered issuer signature is rejected" (shared verifier path) · seven upstream checks reported on every result | MET |
| Validate **approved algorithms** | **cfg** `config/policy/algorithms.json` — ES256 only · **U** `algorithm-policy` (12 tests: unapproved, `none`, absent, malformed, over-long, mixed pair) · **E** `algorithm-policy` (4 tests, including a genuine ES384 holder key accepted upstream with HTTP 200 and refused by us) · **C** five checks including the ordering | **MET** — enforced as of this commit; previously a recorded deviation |
| Obtain a decision rather than claim an unenforced allowlist | Anand's Option A, implemented; `docs/design/COMPATIBILITY.md` records how it became enforceable | MET |
| Validate each issuer against the correct trust entry and credential type | **U** `trust` · **E** the two untrusted-issuer tests | MET |
| Enforce issuer roles across the two registries | **E** "the land credential in the farmer slot" · **cfg** `roles` in `config/trust/issuers.json` | MET |
| Validate holder/key binding for every presented credential | **E** "two credentials held by different wallets" · **U** `verification-gate` | MET |
| Validate audience, nonce, response mode and atomic single-use transaction state | **E** Age suite — wrong nonce, wrong audience, replay, unknown/expired state, single-use code | MET |
| Validate **expiry** | Transaction-state expiry: **E** "an unknown or expired transaction state is rejected". Credential expiry: **not exercised** — the issuer sets no `exp` on these credentials, so there is nothing to expire | MET (deviation — credential expiry) |
| Reject tampering and replay | **E** Age suite — tampered disclosure, tampered issuer signature, replay (shared verifier path) | MET |
| Reject a presentation where Farmer IDs do not match | **V** part 7 · **E** | MET |
| Never run the loan rule on unverified claims | **C** ordering check · **U** `verification-gate` | MET |
| Cancellation or denial of consent discloses nothing | **V** part 8 · **E** two tests | MET |
| Public endpoints must not expose operator, registry-write, DID-minting, schema-management or unrestricted offer-creation operations | **C** the refusal checks on the public listener, including `/farmer/oid4vc/offer`, `/land/oid4vc/offer` and `/bank-vp/vp/request` | MET |
| Logs and evidence must not contain secrets, raw credentials, raw presentations, National IDs or undisclosed claims | **C** the secret-scan checks · [`runs/README.md`](runs/README.md) records the scan applied to the captured runs | MET |
| Synthetic data only | **cfg** all fixtures · **C** | MET |

## 9. Evidence requirements

| Requirement | Evidence | Status |
|---|---|---|
| Real-device recording of Farmer credential issuance | **V** part 2 | MET |
| Real-device recording of Land credential issuance | **V** part 3 | MET |
| Cross-device bank verification recording showing wallet and bank result | **V** part 4 | MET |
| Cold-restart recording showing both credentials still present | **V** part 3 — swiped from recents, cold start, PIN, card still there | MET |
| Eligible Paddy or Wheat result with the calculation visible | **V** part 5 | MET |
| Valid ineligible result | **V** part 6 | MET |
| Cancellation with no disclosure | **V** part 8 | MET |
| Sanitised evidence proving minimum disclosure and Farmer ID correlation | **V** parts 4–5 and 7 · **E** privacy test | MET |
| Automated positive, negative, privacy, trust, holder-binding, tampering and replay results | **U**, **E**, **A** in [`runs/`](runs/) | MET |
| Exact versions | [`README.md`](README.md) versions table; every run header carries the image tag and both fork tips | MET |
| Clean-checkout setup, test and demo instructions | root [`README.md`](../../../README.md) · [`runs/README.md`](runs/README.md) | MET |
| Regression results for all accepted Age capabilities | **A** — 39 unit + 51 e2e, on the same deployment | MET |
| A line-by-line acceptance table | this document | MET |

## 10. Completion gate

| Requirement | Status |
|---|---|
| Every required workflow has real-device evidence | MET |
| The requirements checklist maps to repository evidence | MET — this document |
| Known deviations are explicit | MET — below |
| Age regression is green | MET — **A** |
| Anand has reviewed the customer demonstration | MET — demo accepted |
| Nothing merges to `main` without Anand's sign-off | Held. The branch is not merged |

## 11. Mandatory Inji handshake

**N/A by approved decision.** Anand approved using the already-vendored wallet
instead of Inji on 28 August 2026 —
[`docs/reviews/DECISION-02-wallet-choice.md`](../../reviews/DECISION-02-wallet-choice.md).
There is no pinned Inji build to run the handshake against, so it was not
performed, and **this iteration does not evidence that Inji interoperates with
this stack**. The seven handshake items were all demonstrated on the substitute
wallet: items 1–4 in **V** parts 1–3, items 5–7 in **V** parts 4 and 8.

Inji remains deferred to Iteration 03, where PRODUCT's "Inji completes at least
one full use case" would land.

---

## Known deviations

1. **The wallet is not Inji.** Approved 28 August 2026. Consequence: no evidence
   of Inji interoperability. Three recorded Inji risks stay open.
2. **The wallet reports no request purpose.** R3.4 asks for the purpose to be
   displayed; the wallet's review screen instead says no purpose was provided,
   because the issuer build sends no `client_metadata`. Visible in **V** part 4
   and named in the narration rather than cut. Everything else R3.4 asks for —
   bank identity, credentials, requested attributes, consent — is shown.
3. **Credential expiry is not validated**, because the issuer sets no `exp`.
   Transaction-state expiry is enforced and tested.
4. **`revocation: OK` is a default, not a check** (`STATUS_LIST_ENABLED=false`).
   Revocation infrastructure is out of scope per PRODUCT and must not be
   presented as verified revocation.
5. **The cross-field acreage rule is enforced at seed time**, not by the registry,
   which cannot express it. `scripts/seed-agriculture.sh` refuses to seed a
   violating record.
6. **Only one of the four rejection causes is demonstrated on a device.** The
   mismatched combination is in **V** part 7. Tampering, an untrusted issuer and
   a wrong-holder presentation are covered by the automated suites only — an
   honest wallet cannot produce them, and the Agriculture build's issuer directory
   is baked to the two registries, so a farmer cannot reach an untrusted issuer
   through the app at all.
7. **The mobile verifier is not required** (REQUIREMENTS §1 makes web QR the
   customer-facing channel). One was built anyway, as a build-time channel of the
   existing app rather than a second application, and must not be offered in
   place of the web channel.
