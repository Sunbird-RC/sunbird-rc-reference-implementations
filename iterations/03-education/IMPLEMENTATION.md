# Iteration 03 — Education / Employment: implementation log

**Branch:** `iteration/education-03-employment`
**Baseline:** the accepted Agriculture `main` (merge `9e51575`, which contains
`bc41b8a`), synchronised into this branch on 31 August 2026
**Inputs:** [`START.md`](START.md), [`PRODUCT.md`](PRODUCT.md),
[`REQUIREMENTS.md`](REQUIREMENTS.md), [`DESIGN.md`](DESIGN.md),
[`DEMO.md`](DEMO.md), and the build order in [`PLAN.md`](PLAN.md)

This is the working record: what was built, why it is shaped that way, and what
each decision cost. Acceptance evidence goes in `docs/evidence/03-education/`.

## What this iteration actually has to prove

Two iterations have shown one wallet presenting to one relying party. Education's
claim is different and it is the programme's central one: **one learner, one
wallet, three credentials from three authorities that have never heard of each
other, and two relying parties who ask different questions of the same three
cards and get different answers.**

Everything below follows from taking that literally. In particular, `EDU-L-006733`
holds a 65% degree, and that single number is why the employer shortlists them for
interview while the university does not accept their Master's application. If the
two answers came from two different sets of credentials, or from two front ends
written differently, or from two policies that happened to be coded apart, the
demo would look right and prove nothing.

## Three issuers, because the correlation check depends on it

`oid4vc-school`, `oid4vc-college` and `oid4vc-university`: three instances of the
same unmodified image, each with

- its own path (`/school`, `/college`, `/university`), which is what makes it a
  distinct `credential_issuer` to a wallet;
- its own signing DID, minted by `bootstrap.sh`;
- its own registry entity (`SchoolRecord`, `CollegeRecord`, `UniversityRecord`),
  and no configuration by which it could read another's;
- its own `nationalId` lookup, so it resolves the authenticated learner itself
  rather than being handed a `learnerId` (DESIGN §7).

Three rather than one is not a stylistic choice. The rule the verifier has to
enforce is *"all three certificates name the same learner"* — and that is only a
claim worth checking if three separate authorities asserted it. One instance
minting all three from one lookup can never disagree with itself, so the
correlation check would be untestable and the demo would be theatre.

The same reasoning drives three **trust roles** in `config/trust/issuers.json`.
Six issuers are now allowlisted across three iterations, and a learner
legitimately holds three Education credentials at once. Without a role per
institution, a 70% college diploma would satisfy the University slot — same
holder, valid signature, trusted issuer — and be read as a 70% degree.

## Two verifier identities, for the reason Iteration 02 learned the hard way

`oid4vc-university-vp` and `oid4vc-employer-vp` sign the two portals' request
objects. A wallet names the requesting party from the key that signed the request
object, so a shared signer makes two relying parties one party on the consent
screen — the defect that had a farmer applying for crop credit asked to trust
"Age Check".

Education is the first iteration where the holder presents to **both** parties in
one sitting, so getting this wrong would be visible in the demo itself: the
employer's screen would read "University Admissions". Asserted by
`tests/e2e/education.test.mjs` → *the two portals are two different parties to the
wallet*, and by a `verify.sh` check that starts both sessions and compares the two
`client_id` DIDs.

## One verifier, two use cases, and no new branches

The shared verifier gained `education/masters` and `education/job`. Adding them
would have meant a third and fourth `if (session.useCase === …)` in `readSession`,
each with its own response body — so the step-4 shaping moved into the use-case
map instead. Each entry now declares `signer`, `requests`, `decide`, `respond` and
`policy`, and `readSession` ends with

```js
const outcome = useCase.decide(verified, session)
const body = useCase.respond(outcome, { status, issuer, verified, session })
```

Steps 1–3 — cryptographic verification, the algorithm allowlist, exact-disclosure
policy, per-role issuer trust — are untouched by this iteration. That was the
reusability claim made when the service was built, and this is the first time it
was tested by a third use case rather than asserted.

The two Education use cases come from **one factory**, `educationUseCase(policyId,
signer)`. Everything that differs between a university and an employer comes out
of `POLICIES`: the claims requested, the thresholds, and the exact eligible
wording. They cannot drift apart in behaviour PRODUCT says is shared, and cannot
converge on behaviour PRODUCT says differs.

## The two portals are one script

`services/education-web/` holds `masters.html`, `job.html` and a single `app.js`.
The only difference in the markup is `data-policy="masters"` or `"job"`; nginx
serves the same directory at `/admissions/` and `/employer/` with different
`index` files.

That is deliberate for the same reason the use-case factory is. If the two pages
had separate scripts, the difference in what they display could come from the
pages rather than from the policy, and the iteration's argument would rest on a
coincidence. `verify.sh` asserts the directory contains exactly one `.js`.

Both pages read their request, thresholds, accepted fields and **withheld list**
from `/api/verifier/education/<policy>/policy`. The Agriculture page hardcoded its
withheld list in the browser, which meant a page could claim a privacy guarantee
the request did not make; here `NEVER_REQUESTED` lives in the domain module beside
the requests it is the complement of, and is served.

## Percentages, and why they get their own module

`domains/education/percentage.mjs` converts to **hundredths** and compares
integers. Both rules are `>=` and PRODUCT writes the thresholds as whole numbers,
so the only interesting inputs are the boundaries — and `59.99`, `60`, `60.01` in
binary floating point is exactly where a naive `>=` gives the wrong answer for one
learner in a demo nobody can debug live.

The module refuses more than two decimal places, refuses values outside 0–100, and
refuses a non-number, each as `MALFORMED_CLAIM` — a verification failure, not a
business answer. `formatPercentage` is the only thing that renders a percentage,
which is why `verified` and `shortfall` travel to the page already formatted: the
page must not be able to display a number the decision did not compute. Same rule
as the bank's money.

`EDU-L-007841` sits on **all three** thresholds at once (60.00 / 60.00 / 70.00) and
is eligible under both policies, so the inclusive boundary is demonstrated end to
end rather than only asserted in a unit test.

## Two things found by looking rather than by testing

### The admissions screen reported thresholds it had cleared as "not reached"

`decideEducation` evaluates thresholds in order and returns on the first failure,
and the failure branch returned only `shortfall`. So a learner with 72% school,
68.4% college and 65% university — failing only the 70% university bar — was shown

```
school     — requires 60%    not reached
college    — requires 60%    not reached
university — requires 70%    65% — short
```

Two of those three lines were false. It was technically a report of the loop's
state; to the learner reading it, it said their school result had not been
checked. Every test passed while the screen was wrong, and nothing but opening the
page would have caught it.

The failure branch now returns the thresholds already verified. Asserted in
`tests/unit/education-decision.test.mjs` and again on the wire in
`tests/e2e/education.test.mjs`, including the case where the failure happens
*before* any threshold — an unfinished degree — where `verified` must be absent,
because showing "72% — met" there would invent a comparison the decision never
made.

### An institution can be made to sign another institution's credential type

Found while writing the issuance tests. `ADVERTISE_OWN_CREDENTIALS_ONLY` filters
issuer **metadata**; it does not restrict `POST /oid4vc/credential`, which accepts
any published `credential_configuration_id`. Asking the school instance for the
college configuration returns HTTP 200 and a credential whose `iss` is the
College's DID — credentials-service signs with the schema `author` key — carrying
the learner's **school** percentage.

The Agriculture equivalent of that test passes, which is why this survived an
iteration: the Land schema requires claims a `FarmerRecord` lookup cannot supply,
so cross-issuance there fails on validation rather than on authorization.
Education's three records share their claim shape, so nothing stops it.

It is contained, and only by the `vct`: oid4vc-service normalises a relative `vct`
against the **minting** instance's `PUBLIC_URL`, so the result's type is
`<host>/school/vct/college-record-credential`, not the `<host>/college/vct/…` both
portals pin. `tests/e2e/flow3-education-issuance.test.mjs` asserts both halves —
the mint succeeds, and neither portal accepts the result.

No verifier change was needed. What was unsatisfactory is that a trust boundary
rested on how a URL is constructed rather than on an authorization check, so it was
recorded as finding 16 in [`../../docs/design/COMPATIBILITY.md`](../../docs/design/COMPATIBILITY.md)
and **raised for Anand** rather than patched, since the fix changes a security
guarantee.

**He asked for it, and it is now fixed** (2 September 2026). The credential
endpoint resolves against the same own-authored list the metadata is built from,
so advertising and issuing cannot diverge again — which was the whole defect. A
request for another issuer's type is refused by name, including a `vct`-only
request: that is the shape a wallet on the authorization_code path actually sends,
and matching there is on the type **slug**, because every instance normalises a
relative `vct` against its own `PUBLIC_URL` and comparing whole `vct`s across
instances is always false. The two tests that asserted the defect are replaced by
four that assert the refusal in both directions and both request shapes, plus
seven in the fork; the containment they proved lives in
`tests/e2e/education.test.mjs` → *a credential presented in the wrong role slot is
REJECTED*, which does not depend on cross-minting being possible.

## The disclosure guarantee, and the limit that used to be on it

A wallet that discloses **more** than the request asked for is now **refused**.

It used to get a DECIDED answer. DCQL claim filtering stripped the unrequested
disclosure before the verifier saw it, so the relying party could not learn it and
the decision could not use it — both asserted at the time. But the extra
disclosure had travelled from the wallet to the protocol façade, so *"the employer
never receives the school percentage"* was true of the employer and of the verifier
service and not of the whole path. Anand sent that back: REQUIREMENTS §8 lists
over-disclosure among the things to reject.

The DCQL matcher now compares the disclosed claim names against the query and
rejects the credential, naming the surplus claims and never their values — a
diagnostic that echoed the value would disclose exactly what it had refused. On
the first path segment, since a nested claim is disclosed as its top-level
object; only for selective-disclosure formats; and only when the query named
claims, because a query with no `claims` asks for the whole credential and nothing
can exceed it. The verifier's own `assertExactClaims` stays as the second line.

Two things worth carrying forward from how this went:

- **`REJECT_UNREQUESTED_DISCLOSURES` defaults ON**, unlike finding 14's flag.
  Accepting data nobody asked for is not a safe default, and a privacy control
  that has to be switched on is one that is off in every deployment nobody
  configured.
- **The first build of it did nothing.** `extractCredentials()` produced the field
  and the matcher consumed it, but the keyed `vp_token` branch — the path every
  SD-JWT presentation here takes — built its entry without it. All eight unit tests
  passed, because each handed the matcher a fixture written by hand. Three tests
  now drive it from a real SD-JWT through the actual extractor with no fixture in
  between.

## Running it

```bash
cd deploy && docker compose up -d          # three institutions, two VP signers
../scripts/bootstrap.sh                    # five DIDs, three schemas, learner passwords
../scripts/seed-education.sh               # ten learners
cd .. && npm run test:unit && npm run test:e2e && ./scripts/verify.sh
```

Then, with no phone in the loop — collect once, present twice:

```bash
# open http://localhost/employer/ and press Start
./scripts/wallet-education.sh twoAnswers job     <sessionId>   # SELECTED FOR INTERVIEW — ROUND 1
# open http://localhost/admissions/ and press Start
./scripts/wallet-education.sh twoAnswers masters <sessionId>   # NOT ELIGIBLE: university 65% < 70%
```

`scripts/wallet-education.sh` is the same holder implementation the suite uses:
real ES256 keys, real proofs of possession, real SD-JWT presentations with a Key
Binding JWT per credential. It is supporting protocol evidence and **not** the
customer journey, which is wallet-driven issuance on a real device.

A mismatched set, which both portals must refuse with REJECTED rather than
NOT ELIGIBLE:

```bash
./scripts/wallet-education.sh mismatch masters <sessionId> --college EDU-L-012551
```

All three cards there are genuinely issued and genuinely held by one wallet key.
Only the learner id disagrees: it is the combination that is wrong, not any card.

## Deploying to the demo host

`deploy/.env` **must be excluded**, and it is the first trap: it is gitignored, so
it exists on both machines with different contents, and `--delete` plus no exclude
replaces the host's `PUBLIC_URL` and all six existing DIDs with a localhost
developer's. Back it up before the first run of a new recipe.

```bash
ssh rc@<host> 'cd /home/rc/age-demo/deploy && cp -a .env ".env.bak.$(date -u +%Y%m%dT%H%M%SZ)"'

rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' \
  --exclude 'deploy/.env' --exclude 'deploy/.env.bak.*' \
  --exclude 'services/verifier-mobile/android' --exclude 'services/verifier-mobile/ios' \
  --exclude '.expo' --exclude 'vendor/paradym-wallet' --exclude 'RC_video' \
  ./ rc@<host>:/home/rc/age-demo/

ssh rc@<host> 'cd /home/rc/age-demo/deploy && docker compose up -d'
ssh rc@<host> 'cd /home/rc/age-demo && ./scripts/bootstrap.sh && ./scripts/seed-education.sh'
```

`vendor/paradym-wallet` is excluded because the host never builds the wallet — the
APK is built on the Mac — and shipping 12.7 MB of it on every deploy is waste.

Three more traps, all found the hard way in earlier iterations and all still live:

1. **A single-file bind mount does not survive rsync.** rsync replaces the inode,
   so the container keeps the old file — nginx served a stale, truncated
   `routes-citizen.conf` and reported a syntax error at a line that no longer
   existed. Recreate the container: `docker compose up -d --force-recreate
   --no-deps nginx`.
2. **Recreating Keycloak re-imports every realm.** `start-dev` keeps its H2
   database inside the container, so a recreate loses it and all three realms
   import fresh. That is safe — they are declarative — but `bootstrap.sh` must run
   afterwards to set the demo passwords again, and any Keycloak state changed by
   hand is gone.
3. **The two new VP signers must be recreated *after* bootstrap.** They read
   `VERIFIER_DID` at boot, and a signer started before `.env` has it generates an
   ephemeral `did:rcw:` and answers 500 on `/vp/request`. `bootstrap.sh` step 6
   now recreates them; a manual `docker compose up -d` before bootstrap does not.
4. **HTTPS is an overlay, and `docker compose up -d` without it drops HTTPS.** The
   command above is `-f docker-compose.yml -f docker-compose.tls.yml` on a TLS
   host; plain `up -d` recreated nginx from the base file, which stopped listening
   on 443 altogether. Worse, the overlay **re-declares** nginx's `volumes:`, and
   Compose merges service keys but not sequences — so a mount added to
   `docker-compose.yml` and not to the overlay is silently absent over HTTPS. That
   is exactly how `/admissions/` and `/employer/` 404ed on the host while working
   locally on plain HTTP.
5. **The registry must be restarted to see new entity schemas.** It reads
   `registry-schemas/` at boot, so the four Education entities 404 until
   `docker compose restart registry` — several minutes under amd64 emulation.
6. **The verifier is a `build:`, not an image.** `bootstrap.sh` recreates it but
   does not rebuild it, so the new use cases 404 until
   `docker compose up -d --build --no-deps verifier`.

`bootstrap.sh` **reuses** existing DIDs, so the Age and Agriculture identities
survive and their accepted evidence still describes the deployment it was captured
from.

### What the deployment proved

Captured in [`../../docs/evidence/03-education/runs/`](../../docs/evidence/03-education/runs/):
**159 unit**, **144 e2e** (47 of them Education), **109 `verify.sh`** checks, and
**97** Iteration 01 and 02 tests green on the same deployment. Each of the five
path-scoped issuers advertises exactly one credential. Both portals were reached
over HTTPS in a browser and answered by the hand-driven wallet — the same three
cards producing SELECTED FOR INTERVIEW — ROUND 1 from the employer and
NOT ELIGIBLE, university 65% short of 70%, from admissions.

The one `verify.sh` failure is *working tree clean*, which is the check doing its
job: the iteration is deliberately uncommitted, so the runs must be recaptured
after the commit and their headers say so.

The Age suite failed once first, on its own staleness check — `AGE-000003` and
`AGE-000004` are seeded to turn 18 today and tomorrow, so they expire as fixtures.
`./scripts/seed-age-citizens.sh` refreshes them. The suite is written to detect
that rather than quietly pass, which is the only reason the boundary case means
anything.

## The wallet, and what is still open there

`vendor/paradym-wallet/apps/wallet/src/constants.ts` gained the three Education
institutions as trusted OID4VCI issuer entities, path-scoped and placed **before**
the host-scoped fallback. Ordering is load-bearing: the SDK matches with
`issuer.startsWith(e.issuer)` resolved by the first hit, so a host-scoped entry
listed above them claims all three and a learner collecting a degree is told the
National Identity Authority issued it. `tests/unit/wallet-trust.test.mjs` asserts
the ordering, the distinct names, and that every logo is actually served.

The two **verifier** DIDs are in `trustedDidEntities` too, added after the demo
host minted them and placed above the host-scoped fallback, so the consent screens
name *University Admissions* and *Employer* rather than the deployment. A verifier
is identified by a `did:web:<host>:<uuid>` with no path to scope on, which is why
those two entries — unlike the three issuer entries — could not be written before
the host existed. `verify.sh`'s trust-pinning check consequently now runs and
passes against the deployment instead of skipping.

**Still open:** the change is not a fork commit. It sits in both working trees, so
`scripts/vendor-wallet.sh` still names tip `6dc0a3c` and
`vendor/paradym-wallet/SUNBIRD-CHANGES.md` has no row for it — the tree-hash check
passes only because the edit is identical in both copies. The sequence is in
[`PLAN.md`](PLAN.md).

The Education APK must list only the three institutions, the same quality gate
Agriculture has:

```bash
./scripts/build-wallet.sh --issuer https://<host>/school,https://<host>/college,https://<host>/university
```

One APK cannot satisfy three demos: all builds share the package name, so
installing the Education wallet replaces the Agriculture one, and re-demonstrating
either earlier iteration on the device means rebuilding.

### Built and installed — 1 September 2026

Samsung SM-A055F, Android 15, `id.paradym.wallet.preview` version 1.20.3, APK
77.3 MB, built in 4m17s with `-PreactNativeArchitectures=arm64-v8a`.

The issuer directory was verified by reading `assets/app.config` **out of the
APK** rather than by trusting the build flag:

```json
["https://<host>/school", "https://<host>/college", "https://<host>/university"]
```

No Age issuer and no Agriculture registry, which is DEMO.md §1's quality gate. The
trust entries were checked the same way — `strings` over
`assets/index.android.bundle` finds both new verifier DIDs, all three institution
names, and *University Admissions* and *Employer*, so the entries are compiled in
rather than merely present in source.

The app launches clean with no fatal exceptions in logcat. Wallet data was cleared
after installing (`adb shell pm clear`), because `adb install -r` preserves it and
the wallet still held Ravi's two Agriculture cards and its old PIN — five cards in
a wallet would contradict §1's "show all three in the wallet". Those credentials
are synthetic and re-collectable, and Iteration 02 is already recorded and signed
off.

**One thing to watch when recording the mismatched set.** The three Education
issuers share one Keycloak realm, so one sign-in collects all three cards and SSO
reuse is exactly what the happy path wants. It is only the mismatched-set take that
needs two different learners, and there the browser's Keycloak session has to be
cleared between the two sign-ins or the second issuance silently reuses the first
learner — the same trap Agriculture hit. An Agriculture SSO cookie is not a
problem: `agriculture` and `education` are different realms with different
sessions.

## The installed mobile verifier said "Farm Credit"

Caught by Kartheek on the device, and my first answer was wrong: I had recorded
"no Education mobile verifier is in scope" because `DEMO.md` puts the verifier on a
website. That is true of what acceptance rests on, and beside the point — the app
is *installed*, its launcher label is baked in at build time, and an Education demo
recorded on that phone would show an app called "Farm Credit" on the home screen.
Iteration 02 was sent back for exactly this shape of defect, one iteration earlier,
with "Age Check".

Two channels rather than one "Education Verifier", following the rule the app
already had:

```bash
VERIFIER_USE_CASE=education-masters ./gradlew assembleRelease   # "Master's Admissions"
VERIFIER_USE_CASE=education-job     ./gradlew assembleRelease   # "Interview Shortlisting"
```

Two, because Education has two relying parties, not one. A university admissions
office and an employer are as different from each other as either is from the bank,
and they sign with different DIDs — one app named for both would be the same
mislabelling the build-time channel exists to prevent. The package still does not
change, so the four builds replace each other on a device, exactly as the wallet's
do.

Three things the Education response needed that the two earlier channels did not:

* **`disclosed` is keyed by credential**, not flat. Rendering it flat printed
  `[object Object]` — and, worse, would have hidden that `learnerId` arrives three
  times, which is the correlation the verifier checked and the one fact the screen
  most needs to show.
* **The rule is displayed**, every threshold against what was presented, so a
  NOT ELIGIBLE verdict names the single number that fell short. Both values arrive
  already formatted from the service; this app cannot render a percentage
  differently from the service that decided on it, the same rule the bank's money
  follows.
* **The ELIGIBLE wording comes from `result.headline`.** PRODUCT forbids ever
  displaying ADMITTED or implying a job offer, so the words stay in the module the
  tests assert against. `tests/unit/mobile-verifier.test.mjs` asserts the app
  cannot display any of them, checking the source with comments stripped — the
  first version of that check failed on the comment explaining the rule, and
  rewording the comment would have made it pass while leaving it unable to tell
  prose from a rendered string.

`tests/unit/mobile-verifier.test.mjs` (8 tests) also asserts that `app.config.js`
and `App.js` agree on which channels exist — a channel in one and not the other is
an app that installs and then crashes on `useCase.api`, on a device, with nothing
in any log — that every channel's API path is one the verifier service actually
routes, and that the app's hardcoded withheld list equals the `NEVER_REQUESTED` the
web portals fetch from `/policy`. The duplication is allowed because this app is
supporting evidence; it is only allowed while it stays true.

### Verified on the device

Samsung SM-A055F. Launcher label reads **Master's Admissions**, and `Farm Credit`
and `Age Check` are absent from `resources.arsc` entirely — checked, not assumed.
Tapping *Start the application* hands the request to the wallet on the same device
through `openid4vp://`, with `client_id` the **University Admissions** DID and a
`request_uri` under `/university-vp/` — so the two separate verifier signing
identities are doing their job on the wire.

A full round trip against the deployment renders: NOT ELIGIBLE with its reason, all
three issuers, the rule (72% met, 68.4% met, 65% short), all eleven disclosed
claims grouped per credential, all twelve withheld claims struck through, and all
eight verification checks green including `algorithm ✓`.

One defect found only by scrolling to the bottom on the phone: the content ran
under the system navigation bar, leaving the last verification pills and the reset
button unreachable. The Age and Agriculture results were short enough never to
reach it; Education's — eleven disclosed claims, twelve withheld, eight pills — is
not. Fixed with `paddingBottom` on the scroll container.

## Recording the demo, end to end

Built around what Anand has actually asked for, not around the feature list. His
framing from [`ITERATION-01-FEEDBACK-ROUND2.md`](../../docs/reviews/ITERATION-01-FEEDBACK-ROUND2.md)
is authoritative and still governs:

> The repository can carry the detailed tests, security evidence, implementation
> notes and known limitations. The live demonstration should remain simple and
> customer-focused:
>
> **Authenticate → Receive credential → Consent → Share only age status → Verify
> → APPROVED or DENIED.**

For Education that sequence is:

**Authenticate → receive three credentials → consent → share only what each policy
needs → verify → two different answers from the same three cards.**

So: no protocol talk on camera, no terminal, no test output. The repository holds
all of that.

### What he will look for, and which clip shows it

Every outcome below has been produced through the real protocol against this
deployment by `tests/e2e/education.test.mjs` and
`tests/e2e/flow3-education-issuance.test.mjs`. None of it is a guess about what the
screen will say.

| What Anand asks for | Clip | What is on screen |
|---|---|---|
| Wallet on a **real Android device** | all | Samsung SM-A055F throughout |
| Only the valid issuers in the customer-facing directory | A | exactly three institutions — no Age issuer, no registry, no negative fixture |
| **Authenticate** as a synthetic learner | A | Keycloak sign-in inside the wallet |
| Direct wallet-driven issuance, **no issuance QR** | A | three credentials collected from the directory |
| Credential preview, approval, storage | A | three cards in the wallet |
| **Credential persistence** | A′ | close the wallet, reopen, unlock — the three cards are still there |
| **Cross-device**: website on a laptop, scan with the phone | B, C, D, E | portal on the laptop, QR scanned by the wallet, result on the laptop |
| Consent naming the **right organisation** | B, C | *University Admissions* on one, *Employer* on the other |
| Selective disclosure — only what the purpose needs | C | the employer never asks for the school or college percentage |
| A **verified** ineligible result, not a technical failure | B, E | NOT ELIGIBLE with the number that fell short |
| **REJECTED / UNABLE TO VERIFY** (his Agriculture note) | F | a mismatched set refused, nothing tampered with |
| Decline → nothing shared, no result produced | G | NO DATA SHARED |
| Installed **mobile verifier app** via deep link | H | *Master's Admissions* app invoking the wallet, result back in the app |
| Eligibility never presented as admission or employment | B–E | the service's exact words, and the disclaimer line under each |

`SESSION_TTL_SECONDS=240` on the host: each request stays answerable for **four
minutes** from pressing Start. That is the scanning window, and it is also how the
"nobody answered" outcome is produced.

### Before you press record

```bash
# The fixtures, and the two Age citizens that expire daily
ssh rc@<host> 'cd /home/rc/age-demo && ./scripts/seed-education.sh'
ssh rc@<host> 'cd /home/rc/age-demo && ./scripts/seed-age-citizens.sh'

# A clean phone. Both are safe: the credentials are synthetic and re-collectable.
adb shell pm clear id.paradym.wallet.preview     # cards, PIN, and its Keycloak session
adb shell pm clear id.sunbird.ageverifier        # any half-finished session
```

Set the wallet PIN by hand, once, and stop at the empty wallet screen. Use a
private browser window on the laptop. Learner passwords are in `deploy/.env` on the
host — never on screen.

The wallet holds credentials against one holder key, so collecting a second
learner's cards leaves six in the wallet and turns the presentation into a
selection problem on camera. **Clear the wallet between learners.** Within one
learner, record continuously — that is where the argument lives.

### Clip A + A′ + B + C — one continuous take, and the whole claim

Learner **`learner.rohan`**, whose degree is 65%. This single take covers
authenticate, receive, persistence, consent, disclosure, and the two answers.

1. **Issuance.** Open the wallet. The issuer directory shows exactly three
   institutions. Collect from each: State School Board, Regional Polytechnic
   College, State University. Each shows its own trust screen with its own name and
   logo; the Keycloak sign-in appears only on the first — one session covers all
   three. End on the wallet showing **three cards**.
2. **A′ — persistence.** Swipe the wallet out of recents, reopen it, unlock with
   the PIN. The three cards are still there. (This is his item 4 from round two; it
   costs fifteen seconds and he asked for it explicitly.)
3. **B — Master's.** On the laptop open `https://<host>/admissions/`. Read out the
   published bar: school 60, college 60, university **70**. Press *Start the
   application*, use **Enlarge for scanning**, scan with the wallet. The consent
   screen names **University Admissions** and lists eleven claims from three cards.
   Approve. The laptop shows:

   ```
   NOT ELIGIBLE
   the university percentage is below the 70% this policy requires
   school     — requires 60%    72% — met
   college    — requires 60%    68.4% — met
   university — requires 70%    65% — short
   ```

   Say plainly that this is a **verified** answer, not a failure: everything was
   checked, and two of the three bars were cleared. That distinction is the one
   Anand called out in round two.
4. **C — the same wallet, the same three cards, nothing re-issued.** Open
   `https://<host>/employer/`. Say first that this role **does not ask** for the
   school or college percentage at all. Start, scan, approve — the consent screen
   now names **Employer**, a different organisation, from the same phone. The
   laptop shows:

   ```
   SELECTED FOR INTERVIEW — ROUND 1
   This is not an employment offer or a final selection.
   university — requires 60%    65% — met
   ```

   Scroll to *Not shared*: `school: percentage` and `college: percentage` struck
   through, beside the twelve claims neither portal ever asks for. **This is the
   iteration.** One learner, one wallet, three cards, two relying parties, two
   different answers — and the answers differ because the policies differ.

### Clip D — Master's ELIGIBLE

Clear the wallet, set the PIN, `learner.fatima`, collect three, present to
`/admissions/`:

```
ELIGIBLE FOR MASTER'S APPLICATION
Application accepted for consideration. Await the admission list.
```

`fatima` sits exactly on all three thresholds (60.00 / 60.00 / 70.00), so this take
doubles as boundary evidence. Use `learner.priya` for comfortable margins instead.
Say "eligible to **apply**" and let the on-screen line do the rest — **never
"admitted"**, which the service cannot output and the tests forbid.

### Clip E — Job NOT ELIGIBLE

Clear the wallet, `learner.kiran`, present to `/employer/`: `NOT ELIGIBLE`, degree
55.25% against the 60% the role requires. Again: verified, not broken.

### Clip F — REJECTED / UNABLE TO VERIFY

The clip Anand's Agriculture feedback exists for. Clear the wallet, sign in as
**`learner.mismatch`**, collect all three.

**One sign-in is enough.** The college's authoritative record carries a different
learnerId under the same National ID, so the three cards disagree with no second
account and no clearing of the Keycloak session — Agriculture needed two farmers
and an SSO reset between them. Present to either portal:

```
REJECTED / UNABLE TO VERIFY
the three credentials name different learners
```

Narrate the point: nothing is tampered with — three valid signatures, three
trusted issuers, one holder key — it is the **combination** that is wrong, not any
one card. And the screen deliberately does not print either learner id.

### Clip G — NO DATA SHARED

Start a request on either portal, scan it, and **decline** in the wallet. The
laptop turns to `NO DATA SHARED` in about two seconds — the wallet posts
`error=access_denied`, so this is the holder's refusal arriving, not a timeout. To
show the timeout instead, start a request and wait out the four minutes.

### Clip H — the installed mobile verifier app

His item 5 from round two: *a separately installed application, not a web page*.
The phone now has **Master's Admissions** (`id.sunbird.ageverifier`). Tap *Start
the application*; it hands the request to the wallet through `openid4vp://` with no
camera in the loop, and the result returns to the app — issuers, the rule, the
disclosed claims, the withheld list, and eight verification checks.

Say clearly that for Education this app is **supporting, not the charter's
channel**: `DEMO.md` specifies "verifier websites on a separate screen", which is
what clips B–E show. It is included because he asked for the installed app in
round one and because leaving the previous iteration's build on the phone would put
"Farm Credit" on the home screen.

To record the employer channel on the app instead, rebuild — the four builds share
a package name:

```bash
cd services/verifier-mobile && VERIFIER_USE_CASE=education-job \
  VERIFIER_BASE_URL=https://<host> npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
adb install -r app/build/outputs/apk/release/app-release.apk
```

### Before you send it

`DEMO.md`'s quality gate, checkable from the footage alone:

- Only School, College and University in the issuer directory
- All three credentials visibly involved in **every** request
- Two different organisation names on the two consent screens
- `ELIGIBLE FOR MASTER'S APPLICATION` and `SELECTED FOR INTERVIEW — ROUND 1` in the
  service's exact words; `ADMITTED` and any job offer nowhere
- A verified rule failure as `NOT ELIGIBLE`, with the number that fell short
- A verification failure as `REJECTED / UNABLE TO VERIFY`, never as ineligibility
- A refusal as `NO DATA SHARED`, never as a verification error
- No issuance QR, no issuer web page, no terminal, no hidden intervention

And one thing from the Agriculture sign-off: the recorded deviations "must not be
represented as capabilities that were verified when they were not." If the
narration touches finding 16 or the upstream disclosure filtering, describe them as
they are in `COMPATIBILITY.md` — or leave them to the repository, which is where he
said the detail belongs. Both are closed as of 2 September 2026, so a re-cut would
describe them differently; the committed film predates that.

### Two things that will bite

- **The QR is dense.** Education pins three credential types, so its payload is the
  longest in the showcase — this is exactly what failed to scan in Iteration 01
  (COMPATIBILITY finding 9). Use *Enlarge for scanning*, keep the phone square to
  the screen, and let autofocus settle.
- **Four minutes is not long** for three sign-ins. Collect the credentials
  **before** pressing Start on a portal; the TTL covers the presentation only.

## Known limitations, carried forward deliberately

- ~~**Finding 16 is contained, not fixed.**~~ **Fixed** on Anand's instruction —
  see above.
- ~~**Over-disclosure is filtered upstream, not refused.**~~ **Refused** at the
  protocol boundary — see finding 17. Worth knowing: the fix was briefly inert on
  the only path this deployment uses, because the branch that builds the matcher's
  input dropped the field the check reads. Eight unit tests passed throughout; the
  end-to-end test caught it. The lesson generalises — a check whose every unit
  test hands it a hand-written fixture has not been shown to be wired up.
- **The wallet's purpose screen is not filmed.** The request now carries
  `credential_sets[].purpose` and `verify.sh` asserts it on the signed request
  object, but no device was attached when that landed, so the consent screen has
  not been re-observed and the committed film still shows the old warning.
- **The mobile verifier is supporting, not the charter's channel.** `DEMO.md`
  specifies "verifier websites on a separate screen", so the two web portals are
  what acceptance rests on. The app exists because leaving the previous
  iteration's build installed put **"Farm Credit"** on the home screen during an
  Education demo — the same class of defect Iteration 02 was sent back for. See
  below.
- **Percentages are the only numeric rule.** Nothing here needs the integer money
  arithmetic Agriculture required, and `domains/agriculture/money.mjs` is not
  reused — deliberately, since a percentage is not a currency and sharing a
  formatter would invite treating them alike.
