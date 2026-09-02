# Iteration 03 — Education / employment: line-by-line acceptance

Every requirement in [`REQUIREMENTS.md`](../../../iterations/03-education/REQUIREMENTS.md),
in its own order, against the evidence that closes it.

**Branch:** `iteration/education-03-employment`

| Source | Where |
|---|---|
| **V** — the demonstration video, by part | [`Education-Employment-Showcase-01Sep.mp4`](Education-Employment-Showcase-01Sep.mp4) |
| **U** — unit suite, 175 passed | [`runs/test-unit.txt`](runs/test-unit.txt) |
| **E** — end-to-end suite, 150 passed, against the deployment | [`runs/test-e2e.txt`](runs/test-e2e.txt) |
| **C** — `verify.sh --no-tests`, 111 passed / 0 failed | [`runs/verify.txt`](runs/verify.txt) |
| **R** — Age + Agriculture regression, 98 e2e | [`runs/regression-01-02.txt`](runs/regression-01-02.txt) |
| **cfg** — version-controlled configuration | paths given inline |

The film's nine parts: 1 at 0:34, 2 at 0:46, 3 at 1:29, 4 at 1:44, 5 at 2:28,
6 at 3:08, 7 at 3:24, 8 at 3:47, 9 at 4:23.

Status is one of **MET**, **MET (deviation)** — closed, with a difference stated
here and in [Known deviations](#known-deviations) — or **NOT MET**, stated plainly.

---

## 1. Issuance

| # | Requirement | Evidence | Status |
|---|---|---|---|
| 1 | The learner selects the clearly named issuer in the wallet | **V** part 1, the directory held on screen; part 2, three trust screens each naming its own institution · **C** "the school/college/university issuer advertises only its own credential" | MET |
| 2 | The learner authenticates through the Education Keycloak realm | **V** part 2 · **E** Flow 3 "the account is linked to exactly one national id, and Keycloak says which" | MET |
| 3 | The issuer resolves National ID to exactly one learner and institution record | **E** Flow 3 "each credential is built from that institution's own registry record"; "a second learner gets their own records, not the first learner's" | MET |
| 4 | The caller cannot select another Learner ID or Student ID | **E** Flow 3 "an account with no registry record receives no credential"; the issuer reads only the `nationalId` in the learner's own token (`cfg` `deploy/docker-compose.yml`, `KEYCLOAK_SUBJECT_CLAIM: nationalId`) | MET |
| 5 | The issuer derives a holder-bound SD-JWT VC from its authoritative record | **E** Flow 3 "all three credentials bind to the ONE holder key the wallet used" | MET |
| 6 | The learner reviews, accepts and stores the credential | **V** part 2, the claims held on screen before Accept, three times | MET |
| — | Only the three Education issuers appear | **V** part 1 · **U** "each institution the deployment runs is a trusted issuer entity"; "the three institutions are more specific than the host-scoped fallback" | MET |
| — | Issuance uses no QR or issuer web page | **V** part 2 — collected from the wallet's own directory · **C** "/issuer/ is gone (404)" | MET |

## 2. Identity and data

| Requirement | Evidence | Status |
|---|---|---|
| Keycloak accounts map deterministically to synthetic National IDs | `cfg` [`deploy/keycloak/realm-education.json`](../../../deploy/keycloak/realm-education.json), 12 accounts · **E** Flow 3 cue above | MET |
| Each National ID maps to one Education Learner ID | `cfg` `registry-schemas/EducationLearner.json` · **U** "gives every fixture a distinct learner and National ID" | MET |
| Each issuer independently maps the learner to its own Student ID and record | `cfg` three `REGISTRY_SUBJECT_ENTITY` values · **E** data-isolation "each Education institution keeps its own national-id mapping" | MET |
| The same learner fixture is consistent across all three issuers | **U** `education-fixtures.test.mjs` parses the seed script and runs the real decision over every row | MET |
| Education has separate, non-overlapping tables in the shared database | **E** data-isolation "use-case tables do not overlap" — now asserts Education's four tables exist and carry no Age or Agriculture column | MET |
| National ID and Student IDs remain issuer-side and are not credential claims | **E** Flow 3 "the national id and the student ids are never claims in any credential" — asserted on the credential, not only on a presentation | MET |
| Unmapped, missing and cross-learner requests fail safely | **E** Flow 3 "an account with no registry record…", "an account with no national id claim…", "a learner with no university record gets two credentials and not a third", "a token from the Agriculture realm buys nothing" | MET |

## 3. Issuers

| Requirement | Evidence | Status |
|---|---|---|
| Separate DIDs, keys, configurations, trust roles and source access | **E** Flow 3 "the three institutions sign with three different keys" · `cfg` `config/trust/issuers.json`, roles `school` / `college` / `university` | MET |
| Each issuer advertises only its own credential | **C** three checks, one per institution | MET |
| Each issuer reads only its authorized entity through Sunbird RC APIs | `cfg` one `REGISTRY_SUBJECT_ENTITY` per instance, no related entities declared | MET |
| One trusted Education issuer cannot substitute for another issuer's role | **E** "a credential presented in the wrong role slot is REJECTED" · **C** "one trusted issuer per Education role" | MET |
| Issuer names and trust information are clear in the wallet | **V** part 2, three trust screens with *Trusted organization* and *First time interaction* · **U** `wallet-trust.test.mjs` | MET |

## 4. Credentials

| Requirement | Evidence | Status |
|---|---|---|
| Claims match PRODUCT | `cfg` `scripts/credential-specs.py` | MET |
| The same `learnerId` appears in all three primary credentials | **V** part 4, `learnerId` visible three times under "Shared with us" | MET |
| Percentages are decimal 0–100 with deterministic precision | **U** `education-percentage.test.mjs`, 12 tests including 59.99 / 60 / 60.01 and 69.99 / 70 / 70.01 | MET |
| Completion, degree and field values use controlled vocabularies | `cfg` four registry schemas · **U** decision tests reject values outside them as MALFORMED | MET |
| Claims come from issuer records, never the wallet or verifier | **E** Flow 3 "each credential is built from that institution's own registry record" | MET |
| Primary-journey credentials bind to the same wallet holder key | **E** Flow 3 "all three credentials bind to the ONE holder key" | MET |

## 5. Master's portal

| Requirement | Evidence | Status |
|---|---|---|
| Starts a cross-device QR request for all three credentials | **V** part 4 — laptop QR, phone camera, one consent · **C** "both Education portal pages are served" | MET |
| Shows institution, purpose, credentials, claims and consent in the wallet | **V** part 4 (institution, credentials, claims, consent) · **C** "each Education request tells the wallet why it is asking" — the purpose, asserted on the signed request object · **U** `wallet-trust.test.mjs`, the field the SDK reads | MET for the request; the rendered purpose is **not yet filmed** (deviation 1) |
| Receives only policy-required disclosures | **E** "no National ID or Student ID reaches either verifier, in any outcome" | MET |
| Validates transaction and credentials before applying the rule | **U** `verification-gate.test.mjs` · **C** "it is checked before the domain decision" | MET |
| Applies 60 / 60 / 70, completed credentials, Bachelor degree, accepted field | **V** parts 4 and 6 · **U** 30 decision tests · **E** boundary tests | MET |
| Eligible means accepted for consideration, awaiting the admission list | **V** part 6 — the service's exact words on screen | MET |
| It must not claim admission | **U** "must never say ADMITTED / ADMISSION CONFIRMED / SEAT" · **E** asserted on the wire | MET |

## 6. Job portal

| Requirement | Evidence | Status |
|---|---|---|
| Starts a separate QR request for all three credentials | **V** part 5 | MET |
| Uses its own purpose and disclosure policy | **V** part 5, "not requested at all" on the page · **C** "the job portal does not request the school or college percentage" | MET |
| Requires passed School and College, completed Bachelor in an accepted field, University ≥ 60 | **V** parts 5 and 7 · **U** decision tests | MET |
| Eligible means selected for interview round one | **V** part 5 — the service's exact words | MET |
| It must not claim employment, an offer or final selection | **U** "must never say HIRED / JOB OFFER / APPOINTED / EMPLOYED" · **E** asserted on the wire · **V** part 5, the disclaimer line on screen | MET |

## 7. Disclosure

| Requirement | Evidence | Status |
|---|---|---|
| Neither verifier receives National ID, Student IDs, name, address, date of birth, contact details, transcripts, subjects, marks, unrelated metadata, Age/Agriculture credentials or unrequested claims | **E** "no National ID or Student ID reaches either verifier, in any outcome"; "the job portal never receives the school or college percentage on the wire" · **V** parts 4 and 5, the struck-through "Not shared" list | MET |
| Evidence must prove absence on the wire, not only in the UI | **E** both tests above assert on the presented SD-JWT's disclosures, not on the response body alone | MET |

## 8. Decision and security

| Requirement | Evidence | Status |
|---|---|---|
| Verify before executing business rules | **C** "it is checked before the domain decision" | MET |
| Enforce the approved algorithm allowlist, with positive and negative tests | **E** "an ES256 presentation is accepted and the check is reported"; "an unapproved algorithm is rejected, though every signature verifies" (genuine ES384 keys, accepted upstream, refused by the verifier) | MET |
| Validate issuer/type per role, same-holder binding, audience, nonce, expiry, response mode, atomic single-use state | **E** "a credential presented in the wrong role slot is REJECTED"; "a credential collected by a different holder is REJECTED"; "a verified three-credential presentation cannot be replayed"; "a presentation made to the other portal is not accepted here" | MET |
| Reject tampering, replay, over-disclosure, missing credentials, mixed holders, mismatched Learner IDs, issuer-role substitution | **E** "a forged percentage is refused outright"; "a forged completion status on one credential of three is refused"; "a tampered issuer signature… is refused"; plus the four above and the untrusted-issuer set · over-disclosure now **refused** at the protocol boundary — "a claim the job portal never asked for is refused, not quietly dropped", "the refusal names the unrequested claim and never its value", and the control "the same three credentials are accepted when nothing extra is disclosed" | MET |
| Verified rule failure produces NOT ELIGIBLE with an understandable reason | **V** parts 4 and 7 | MET |
| Verification failure produces REJECTED / UNABLE TO VERIFY and no decision | **V** part 8 · **E** "three credentials naming different learners are REJECTED, not answered" | MET |
| Refusal produces NO DATA SHARED and no eligibility result | **V** part 9 · **E** "a learner who declines discloses nothing and gets no decision" | MET |

## 9. Fixtures

| Fixture | Evidence | Status |
|---|---|---|
| Meets both rules | `EDU-L-004512` · **E** "a learner who meets both rules gets both answers" | MET |
| Meets the job rule but fails the Master's 70% | `EDU-L-006733` · **V** parts 4 and 5 — the film's spine | MET |
| Fails the Master's School or College 60% | `EDU-L-008120` (school 59.50), `EDU-L-009002` (college 58.90) — both halves | MET |
| Fails the job University 60% | `EDU-L-009315` · **V** part 7 | MET |
| Incomplete School, College or University qualification | `EDU-L-010447` (university IN_PROGRESS) | MET |
| Unsupported University field | `EDU-L-011238` (MECHANICAL) | MET |
| Mismatched Learner IDs | `EDU-L-012550` / `012551` · **V** part 8 | MET |
| Credentials from different holders | **E** "a credential collected by a different holder is REJECTED" | MET |
| Unmapped account and missing institution records | `learner.unmapped`, `learner.norecord`, `EDU-L-013001` · **E** Flow 3 refusals | MET |
| Valid credential from an untrusted issuer for each role | **E** three tests, one per role, each asserting HTTP 200 first so the refusal is attributable to trust and not to a query mismatch | MET |

## 10. Evidence and completion

| Requirement | Evidence | Status |
|---|---|---|
| Real-device recording of all three issuance flows and stored credentials | **V** parts 1–3, Samsung SM-A055F | MET |
| Continuous Master's and job QR journey recordings | **V** parts 4 and 5 — one continuous take per journey | MET |
| Eligible and valid-ineligible result for both policies | **V** part 6 (Master's ELIGIBLE), part 4 (Master's NOT ELIGIBLE), part 5 (job ELIGIBLE), part 7 (job NOT ELIGIBLE) | MET |
| Representative REJECTED / UNABLE TO VERIFY | **V** part 8 | MET |
| Refusal with NO DATA SHARED | **V** part 9 | MET |
| Sanitized minimum-disclosure and Learner ID correlation evidence | **V** parts 4, 5 and 8 · **E** the two disclosure tests | MET |
| Automated positive, negative, privacy, trust, algorithm, holder, tampering, replay and percentage-boundary tests | **U** 167, of which 62 are Education · **E** 145, of which 48 are Education | MET |
| Exact component, wallet, fork, image, profile and configuration versions | [`README.md`](README.md) | MET |
| Clean-checkout setup, test and demo instructions | [`../../../README.md`](../../../README.md), [`../../../iterations/03-education/IMPLEMENTATION.md`](../../../iterations/03-education/IMPLEMENTATION.md) | MET |
| Captured Age and Agriculture regression results | **R** 97 passed, 0 failed, on the same deployment | MET |
| A line-by-line table mapping every requirement to committed evidence | this document | MET |

---

## Known deviations

**Three of the four recorded on 1 September 2026 are now closed**, at Anand's
instruction, in the commit this table is captured at. They are kept below with
what changed rather than deleted, because the review asked for them and a table
that simply stopped mentioning them would be harder to check than one that says
what happened.

One remains open, and one closure is **partial** — the request now carries a
purpose and that is asserted on the signed request object, but the wallet screen
that displays it has not been re-observed on a device.

**1. The wallet showed no purpose string. CLOSED in the request, NOT YET
CONFIRMED on the device.** The review screen read *"No information was provided on
the purpose of the data request. Be cautious."* — accurate, because the verifier
sent no purpose anywhere.

`client_metadata` was the wrong place, and trying it there first is why this took
a second attempt: it describes the client and the wallet SDK does not read a
purpose from it. The field the wallet consults is OpenID4VP 1.0's
`credential_sets[].purpose`. Both Education requests now carry it, and it is the
same string `/policy` publishes and the result page prints, so the consent screen
and the published policy cannot disagree.

Verified as far as it can be without hardware: `verify.sh` decodes the **signed
request object** and asserts its purpose equals the published one, and
`wallet-trust.test.mjs` asserts the verifier fills the field the vendored SDK
reads. What is **not** verified is that the screen renders it — no device was
attached. Recorded as **finding 18** in
[`../../design/COMPATIBILITY.md`](../../design/COMPATIBILITY.md). Anand asked for a
short replacement segment if the consent screen visibly changes; it should, and
that segment is outstanding.

**2. Over-disclosure was filtered upstream, not refused. CLOSED.** A wallet that
revealed a claim the request did not ask for used to get a DECIDED answer: DCQL
claim filtering stripped the extra disclosure before the verifier saw it, so the
relying party could not learn it and the decision could not use it — but the
disclosure had reached the protocol façade, and §8 lists over-disclosure among
the things to **reject**.

It is now refused at that boundary: the matcher compares the disclosed claim
names against the query and rejects the credential, naming the surplus claims and
never their values. `tests/e2e/education.test.mjs` asserts the refusal, that the
refusal carries no value, and — as the control — that the same three credentials
are accepted when nothing extra is disclosed. Age gains the same guarantee from
the same shared service, so an Iteration 01 test changed too; nothing in either
demonstration shows this path, which needs a wallet that deliberately
over-discloses.

Worth reading in [`../../design/COMPATIBILITY.md`](../../design/COMPATIBILITY.md)
as **finding 17**: the fix was briefly inert on the only path this deployment
uses, and eight passing unit tests did not notice.

**3. An institution could be made to sign another institution's credential type.
CLOSED.** `ADVERTISE_OWN_CREDENTIALS_ONLY` filtered issuer metadata but not the
credential endpoint, so asking the school instance for the college configuration
returned a credential signed with the College's DID carrying the learner's school
record. It was contained only by the `vct` being scoped to the minting instance —
a trust boundary resting on how a URL is constructed rather than on an
authorization check, which is why it was escalated instead of fixed.

The endpoint now resolves against the same own-authored list the metadata is built
from, so advertising and issuing cannot diverge again. A request for another
issuer's type is refused by name, including a `vct`-only request, which is the
shape a real wallet sends. Seven fork tests and four end-to-end tests cover both
directions and both request shapes; a `verify.sh` check asserts the restriction on
the running containers. **Finding 16** in
[`../../design/COMPATIBILITY.md`](../../design/COMPATIBILITY.md) records what
changed.

**4. Part eight's three Learner IDs are a rendered caption, not footage.** The
wallet's store screen never scrolls far enough to show a Learner ID, so the three
values are not on screen anywhere in the recordings — checked frame by frame. They
are shown as a caption carrying the values exactly as the three registries hold
them, and the narration says so in as many words. Agriculture's part seven was sent
back as unclear for the weaker version of this problem.

## Not claimed

- **No mobile verifier channel is required for Education.** `DEMO.md` specifies
  "verifier websites on a separate screen", which is what parts 4–7 show. Part 9's
  installed app is supporting evidence, built because all builds share a package
  name and leaving the Agriculture one installed put "Farm Credit" on the home
  screen during an Education demo.
- **Inji interoperability is not demonstrated.** Removed from programme scope by
  [`../../reviews/DECISION-03-wallet-scope.md`](../../reviews/DECISION-03-wallet-scope.md).
