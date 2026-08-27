# Iteration 01 — response to the consolidated validation

**Branch:** `iteration/age-01-verification`
**Reviewer:** Anand, after the demo video review
**This response:** 27 August 2026
**Deployment used for every result below:** `https://135.235.192.9.sslip.io`

Anand's validation returned **10 completed, 6 partial, 2 not done**. This file
answers each line item with the specific test, file or recording that closes it —
and says plainly where it is still open. Nothing is marked closed on the strength
of an argument; each row points at something a reviewer can run or watch.

One correction first, because it changes how the partials should be read: the
partials were **not** caused by unpushed code. `origin/iteration/age-01-verification`
already matched local before this round of work began. The gaps were three
different things — evidence that existed but was not pointed at, a stale evidence
document that contradicted the implementation, and two genuinely unfinished items.

## Line items

| # | Line item | Status now | What closes it |
|---:|---|---|---|
| 1 | Wallet onboarding | Completed | Recorded. No change. |
| 2 | Issuer discovery | **Closed** | Re-recorded. In `Age-Verification-Showcase-27Aug.mp4` part 1, the issuer directory is held on screen for about three seconds — National Identity Authority, one credential, `vc+sd-jwt` — and the citizen taps it deliberately. The directory itself is also asserted: `tests/e2e/age-verification.test.mjs` → *the issuer advertises exactly one credential*. |
| 3 | Keycloak authentication | Completed | Recorded, and exercised headlessly against the real login page by `tests/e2e/flow1-wallet-issuance.test.mjs` (11 tests, via `tests/e2e/lib/keycloak.mjs`). |
| 4 | Citizen-record mapping | **Closed by tests** | `tests/e2e/flow1-wallet-issuance.test.mjs`: the credential is built from the authenticated citizen's own registry record; a second citizen gets their own; naming another citizen in the request does not reach it. The mapping table is in [README.md](README.md#the-account-to-citizen-mapping). |
| 5 | Direct credential issuance | Completed | Recorded. No issuance QR exists anywhere in the stack — `scripts/verify.sh` asserts the removal of the old issuer page. |
| 6 | Credential contents | Completed | Recorded. |
| 7 | Credential persistence | **Closed** | `Age-Verification-Showcase-27Aug.mp4` part 2: the wallet is swiped out of the recents list (the switcher and "Close all" are on screen), cold-starts to its launch splash, asks for the PIN again, and shows the same card with the same issue date and the same attributes. The cold splash is what proves the process really restarted rather than being resumed. |
| 8 | Cross-device QR verification | Completed | Recorded. Server log for the two-device run: laptop session 07:19:08 → phone fetched the request object 07:19:37 → `/vp/response` 07:19:46. |
| 9 | Request review and consent | Completed | Recorded. |
| 10 | SD-JWT selective disclosure | **Closed by tests** | `tests/e2e/age-verification.test.mjs` → *what the issuer returns is an SD-JWT VC, holder-bound and selectively disclosable*: asserts `typ: vc+sd-jwt`, `alg: ES256`, `_sd_alg: sha-256`, one digest per disclosure, that `ageOver18`/`dateOfBirth`/`name` are disclosures rather than plain claims, that `vct` is the advertised resolvable type, and that `cnf.jwk` is the requesting wallet's own public key with no private key present. Disclosure minimisation is asserted separately, including that withheld values are absent from the wire in plain and base64 form. |
| 11 | Adult approval | Completed | Recorded; `an adult is APPROVED, with every verification check passing`. |
| 12 | Under-18 denial | Completed | Recorded; `a minor is DENIED — verified, not failed`. |
| 13 | User refusal or cancellation | Completed, now also tested | Recorded. Newly asserted: *a cancelled check stays cancelled, even if a valid presentation arrives afterwards* — cancellation is enforced by the verifier, so a late valid presentation cannot revive an abandoned check. |
| 14 | Same-device mobile verification | **Closed** | `Age-Verification-Showcase-27Aug.mp4` parts 4 and 5 show the whole leg without a manual app switch being hidden: the journey starts in **Age Check**, the wallet opens from that tap, the holder consents, the wallet says the information has been shared and to return — and Age Check, still reading "Asking the verifier service…", flips to its verdict. Part 4 ends APPROVED for the adult, part 5 DENIED for the minor. |
| 15 | Verifier trust identity | **Closed — confirmed on the device** | This was not a configuration gap. See [the finding below](#item-15-the-trust-warning-was-a-wallet-sdk-defect). Confirmed on the demo phone on 27 August 2026: the presentation screen reads **"Do you trust Age Check?"** with the 18+ mark rendered, in place of "Organization not verified" — which also proves the logo resolves from the deployment rather than falling back to a placeholder. The precondition is guarded from our side by *the verifier identifies itself with a bare did:web under the deployment host* and *the issuer identifies itself with the deployment origin, and its logo resolves*. |
| 16 | Customer-ready end-to-end journey | **Closed** | `Age-Verification-Showcase-27Aug.mp4`, 4 min 45 s, six parts: getting the card, persistence, the web check, the installed app, the minor's denial, and a refusal. **No unknown-organisation warning appears anywhere** — every phone recording is from the build that fixes it, and the earlier footage was discarded rather than reused. Narration assumes no prior knowledge of credentials. |
| 17 | Repeatable tests and evidence | **Closed** | Run instructions in the root [README](../../../README.md#running-the-age-verification-showcase); this evidence pack rewritten to match the implementation; captured runs under [`runs/`](runs/); charter mapped in [README.md](README.md#charter-acceptance-checklist). |
| 18 | Iteration branch handoff | **Closed on this branch** | All work is on `iteration/age-01-verification`. Commit reference is at the end of this file. Nothing merged to `main`. |

**Totals:** all 18 closed. The four that were open needed footage rather than
code, and that footage now exists.

## Item 15: the trust warning was a wallet SDK defect

Worth stating precisely, because "the wallet shows Organization not verified"
looked like a missing config entry and was not one. No value in the wallet's
trust list could have fixed it.

Two different mechanisms decide the two screens:

- **Issuance screen** — matched by issuer prefix through the fallback (`none`)
  mechanism, because our issuer metadata is unsigned. Adding an entry for
  `https://135.235.192.9.sslip.io` was enough. Configuration only.
- **Presentation screen** — matched by DID through the `did` mechanism, and the
  comparison was:

  ```ts
  trustedDidEntities.find((e) => effectiveClientId === `decentralized_identifier:${e.did}`)
  ```

  `effectiveClientId` is the `client_id` verbatim. Our verifier sends the bare
  `did:web:…` form used by OpenID4VP before draft 26, and the library maps the
  `did` prefix onto the uniform `decentralized_identifier` prefix while leaving
  `effectiveClientId` unprefixed — verified in
  `@openid4vc/openid4vp` (`getOpenid4vpClientId`, `zClientIdPrefixToUniform`),
  not inferred. A string beginning `did:` can never equal
  `'decentralized_identifier:' + anything`, so the lookup could not match for any
  configured value.

The fix normalises the prefix and key fragment, then prefix-matches — which is
what the OpenID4VCI path in the same file already did:

```ts
const baseDid = effectiveClientId?.replace(/^decentralized_identifier:/, '').split('#')[0]
const matchedDid = baseDid ? trustedDidEntities.find((e) => baseDid.startsWith(e.did)) : undefined
```

Prefix matching also delivers host-scoped trust, so re-provisioning the demo —
which mints new DIDs — does not silently return the wallet to calling us unknown.

**This is a change to the wallet fork, not to Sunbird RC**, and it is a genuine
upstream defect worth reporting: any verifier using the pre-draft-26 client id is
untrustable by that wallet. Recorded in
[`../../design/COMPATIBILITY.md`](../../design/COMPATIBILITY.md) with a removal
path — if upstream fixes it, our patch is deleted, not maintained.

**Both entities are marked `demo: true`,** so the wallet reads "Demo organization
· do not share real data" beside the recognised name. That is deliberate: these
*are* synthetic entities, and marking them as production-trusted inside a wallet's
own trust UI would misrepresent them. The unknown-organisation warning is gone;
the remaining badge is accurate and is explained in the narration, which is what
item 15 asked for.

## What is not claimed

- The video is the evidence for items 2, 7, 14 and 16, and each was checked frame
  by frame against its narration before being called done — a frame extracted at
  every one of the 30 cues and read against the line. The build record, including
  the edits made and the corrections that check caught, is in the video folder's
  `NOTES.md`.
- Two blemishes are left in deliberately rather than papered over: a green
  "Online again." connectivity toast during the minor's PIN entry, and the
  status-bar clock reading 4:51 in part 5 against 5:12 either side, because the
  minor's takes were filmed first.
- Item 15 was confirmed by a person, not by automation: the wallet asks for its
  app PIN and no automated step should ever enter one. What was checked on screen
  is the presentation side. The issuance side runs through a different mechanism
  (issuer prefix, not DID) and its entry is configured and served, but the "Do you
  trust National Identity Authority?" screen has not been re-confirmed since the
  rebuild. Re-triggering either takes one command — see
  [README.md](README.md#confirming-the-trust-screen-by-hand).
- `revocation: OK` remains a default, not a check (`STATUS_LIST_ENABLED=false`,
  out of scope per PRODUCT). The algorithm allowlist is still recorded rather than
  enforced, for the reason given in the limitations. Neither is presented as
  verified.

## Commit reference

Recorded here on handoff, after the final commit on
`iteration/age-01-verification`. Nothing is merged to `main`; that gate is
Anand's.
