# Iteration 01 — Age Verification: implementation plan

**Status:** Approved scope, in progress. **Flow 1 and Flow 2 both run on a real
device** against the public deployment (26 August 2026, Samsung SM-A055F,
Android 15). What remains for the demo: the continuous recordings answer 6
requires, and Flow 3's separately installed mobile verifier app.
**Supersedes:** the plan of 24 August 2026, written while the Flow 1 gap was open
**Charter:** [`CHARTER.md`](CHARTER.md)
**Review:** [`../../docs/reviews/ITERATION-01-FEEDBACK.md`](../../docs/reviews/ITERATION-01-FEEDBACK.md)
**Questions and answers:** [`../../docs/reviews/QUESTIONS-01-age-for-anand.md`](../../docs/reviews/QUESTIONS-01-age-for-anand.md) · [`../../docs/reviews/ANSWERS-01-age-from-anand.md`](../../docs/reviews/ANSWERS-01-age-from-anand.md)
**Compatibility:** [`../../docs/design/COMPATIBILITY.md`](../../docs/design/COMPATIBILITY.md)

## Context

The first pass built a working Sunbird RC slice; the review returned **changes
required** because the *user journeys* were not demonstrated. Anand has now
answered the eleven open questions and amended PRODUCT, DESIGN and the charter to
match. Flow 1 is approved with controls, so the iteration is unblocked.

Three of his answers overturn work already committed here, and this plan starts by
correcting them rather than leaving them to be found at review:

| His decision | What it invalidates |
|---|---|
| One PostgreSQL database, separation by use-case tables | our dedicated `age` database and its isolation tests |
| No committed passwords or secrets | the planned realm export with fixed demo passwords |
| The mobile verifier must be an installed app | the mobile-web fallback we were holding |

## Decisions now settled

| # | Decision | Source |
|---|---|---|
| 1 | Keycloak-backed `authorization_code` added inside `oid4vc-service` on a pinned fork build; **optional and configurable**; pre-auth unchanged by default; both grants regression-covered; narrow scope; upstream contribution prepared | answer 1, DESIGN decision 6 |
| 2 | Issuer discovery via the wallet's companion configuration, limited to discovery only. Age lists **only** the National Identity Authority | answer 2, DESIGN "Issuer Discovery" |
| 3 | Demo starts from pre-created synthetic accounts. Enrolment out of scope. **No credentials committed** | answer 3 |
| 4 | Either Keycloak arrangement — wallet-to-Keycloak, or issuer redirects to Keycloak. Record which and why | answer 4 |
| 5 | Mobile verifier is a **separately installed app**; a web page is not sufficient | answer 5 |
| 6 | One continuous recording per journey, to a fixed shot list, with secrets redacted | answer 6 |
| 7 | Returning citizen: show **both** local persistence and survival of a fresh Keycloak session | answer 7 |
| 8 | Cross-citizen protection proven by an automated test, including absence from logs | answer 8 |
| 9 | Age wallet reassignment accepted; spike first, then record version/profile | answer 9 |
| 10 | **One PostgreSQL database**, independent non-overlapping tables per use case, no shared person table | answer 10, PRODUCT + DESIGN |
| 11 | Keep this branch and its history; squash merge only after demos, evidence, closure and sign-off | answer 11 |

### One interpretation recorded for acknowledgement

DESIGN lists "protocol transaction and non-domain configuration tables" among the
groups inside the one database. Read strictly that would move identity-service,
credentials-service and credential-schema into the domain database, which is not
safely possible: each is a separate Prisma service and each owns a
`_prisma_migrations` table, so they would share and overwrite one another's
migration state.

We therefore read the rule as governing **use-case/domain data** — every rule
written under it concerns domain data — and keep the protocol services' own stores
as internal implementation detail. Flagged for Anand's acknowledgement; the Age
migration below is identical either way, so nothing waits on it.

## Step A — Baseline documents *(his stated first task)*

This plan, plus `COMPATIBILITY.md` revised: Age wallet reassignment, the
installed-app requirement, the fork addition recorded as approved-but-not-released,
and the open nonce-sourcing finding. The escalation stays as the record of how
decision 1 was reached.

## Step B — One database, separation by tables

Reverses our earlier per-domain database. The original `?currentSchema=age` finding
still stands and now stops mattering: separation is by entity name, which the
registry does naturally (`V_AgeCitizen`).

- Registry JDBC back to the shared database; `CREATE DATABASE age` removed.
- `tests/e2e/data-isolation.test.mjs` rewritten to assert what is now required:
  Age entity tables present, **no shared cross-domain person table**, no overlap
  between use-case tables, correlation only in explicit fixtures. Stronger than
  before — these are the assertions that will matter when Agriculture lands.
- Verified on a clean stack so the old database is gone.

## Step C — The port, to his controls

Already true, and verified on the branch: opt-in by construction
(`KEYCLOAK_PUBLIC_URL` absent means off), issuer metadata advertises only itself
when the capability is off, and tests assert realm tokens are *not* trusted when
unconfigured.

Outstanding:

- Remove the per-format signing-algorithm change carried over from the older fork
  branch — a real improvement, but unrelated to `authorization_code`, and he said
  not to include unrelated changes.
- Keep the `/vp/status` algorithm reporting as its own change, justified by his own
  earlier review item ("enforce the approved algorithm policy"), since the policy
  cannot be enforced while the algorithm is unobservable. Raised explicitly rather
  than folded into the port.
- Add the dual-grant regression test: pre-authorised issuance still succeeds **with
  Keycloak enabled**. Existing coverage proves it with Keycloak off.
- Pin source commit and image digest; record the deviation and removal path;
  prepare the upstream contribution.

## Step D — Demo accounts without committed secrets

Passwords generated during bootstrap or read from gitignored local configuration,
printed once for the operator. The realm import carries users and the `citizenId`
attribute mapping, never credentials. Evidence shows the account-to-citizen mapping
with no passwords or tokens in it.

## Wallet: what the build needs

The wallet now lives in this repository, at
[`vendor/paradym-wallet/`](../../vendor/paradym-wallet/) — Anand asked for it, so
that a reviewer of this branch can see the wallet-side changes the showcase
depends on instead of taking them on trust. It is `animo/paradym-wallet` at
`2d68168` (Apache-2.0) plus seven showcase commits, all of them visible as this
repository's history: `git log -p -- vendor/paradym-wallet`.

**Correction to an earlier claim here.** This section used to say "nothing in the
wallet needs writing — only configuring". That was true when it was written and is
not true now. Four things needed writing, and two of them are upstream defects:

| Written | Why |
|---|---|
| `packages/sdk/src/trust/handlers/did.ts` | The trust lookup compared the client id against a `decentralized_identifier:`-prefixed string, so a verifier sending the bare `did:web:` form of OpenID4VP before draft 26 could never match any configured entity — no configuration could have fixed it |
| `packages/sdk/src/openid4vc/func/declineCredentialRequest.ts` | Declining was purely local, leaving the verifier unable to tell a refusal from a request the holder ignored |
| `apps/wallet/app.config.js` | Build-time OAuth redirect targets, so the app scheme can be used against a host whose `assetlinks.json` cannot list a locally signed certificate |
| `apps/wallet/src/constants.ts` | The showcase's trusted issuer and verifier — configuration, and the only one of the four that is |

The wallet still supplies the rest of Flow 1 unchanged: the issuer directory, the
browser sign-in step, and the preview-then-approve screen before anything is
stored.

### The build, exactly as it was produced

Expo 56 / React Native 0.85.3, built locally from `vendor/paradym-wallet` — no
Expo account or cloud build involved. Animo's EAS project id was removed when the
code was vendored, precisely so that nobody builds against their Expo project by
accident.

Use [`scripts/build-wallet.sh`](../../scripts/build-wallet.sh), which asserts each
of the four load-bearing variables below rather than trusting you to remember
them. It also finds a JDK 17 when `JAVA_HOME` points elsewhere, which on this
machine it does — sdkman sets it to 11.

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17          # 17 EXACTLY — see below
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export APP_VARIANT=preview                             # release build, no dev server
export CREDENTIAL_ISSUER_URLS=https://135.235.192.9.sslip.io
export WALLET_REDIRECT_BASE_URLS=""                    # see below
cd vendor/paradym-wallet/apps/wallet && npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Both of the first two lines are easy to skip and neither fails clearly. Without
`JAVA_HOME` on a **17**, Gradle tries to provision a 17 toolchain through the
`foojay-resolver` 0.5.0 that `@react-native/gradle-plugin` pins; that version
touches a Gradle API removed in 9.x, and configuration dies with
`JvmVendorSpec … IBM_SEMERU`, which says nothing about JDK versions. 21 and 23
both fail this way. Without `APP_VARIANT`, the namespace becomes
`id.paradym.wallet` while the generated autolinking sources still reference
`id.paradym.wallet.preview`, so the build fails in `javac` with "package does not
exist" — and the resulting APK would install beside the existing wallet rather
than upgrading it. `prebuild` also does not write `android/local.properties`, so
`ANDROID_HOME` has to be exported.

`reactNativeArchitectures` matters. The generated `gradle.properties` builds all
four ABIs, which compiles every native module (Skia, Askar, AnonCreds, Nitro,
Reanimated) four times — hours of CPU and enough intermediate object files to
exhaust a nearly full disk, which is exactly how the first attempt died at 2h14m
in Skia's JNI compile. One ABI is correct here: every Android phone since about
2017 is `arm64-v8a`.

Built artifact, verified by `aapt2` and `apksigner` rather than assumed:

| | |
|---|---|
| Package | `id.paradym.wallet.preview`, label "Sunbird Wallet (Preview)" |
| Version | 1.20.3 (versionCode 1) |
| Size / ABI | 74 MB, `arm64-v8a` only |
| compileSdk / targetSdk | 36 / 36 |
| Signature | `CN=Android Debug` — SHA-256 `fac61745…33b9c` |
| Embedded config | `assets/app.config` carries `credentialIssuerUrls: ["https://135.235.192.9.sslip.io"]` and `allowedRedirectBaseUrls: []` |

That last row is the one worth checking after any rebuild: the issuer directory
is driven by build-time environment, so an APK built without those variables
looks identical and silently shows no issuer at all.

Two facts about the result worth recording:

- The package is `id.paradym.wallet.preview` and the app is "Sunbird Wallet
  (Preview)", so it installs **alongside** any Paradym build already on the
  phone rather than replacing it.
- Expo's Android template signs release builds with the debug key, which is why
  no keystore is needed. It is installable and fine for a demo; it is not
  distributable.

### Why the redirect is the app scheme, not an https URL

The wallet sends `allowedRedirectBaseUrls[0]` as its `redirect_uri`, and that
list was pinned to a redirect URI on an earlier, now decommissioned demo host — one we
do not control. An https redirect only returns to the app if Android has
**verified** the App Link, which requires that host to serve an
`assetlinks.json` naming this build's signing certificate. A debug-signed local
build cannot be listed there.

Making the list build-time configurable (one change in `app.config.js`, mirroring
how `credentialIssuerUrls` already works) and setting it empty makes the wallet
fall back to `id.animo.paradym:///wallet/redirect`, which `constants.ts` already
defines and `+native-intent.tsx` already handles as `isDeeplinkRedirect`. The
custom scheme needs no verification, and the Keycloak client in
`deploy/keycloak/realm-age.json` already lists it.

**One build-time variable**, and it now has a value:

```
CREDENTIAL_ISSUER_URLS=https://135.235.192.9.sslip.io
```

`apps/wallet/app.config.js` reads it (comma-separated) into
`extra.credentialIssuerUrls`, and the directory hides itself when the list is
empty. Nothing else in the wallet needs changing.

**No development flag needed, and the `did:web` risk is gone.** The earlier plan
relied on `allowInsecureOpenId4VcUrlsForDevelopment()` and flagged the risk that
it relaxes the OID4VC libraries' URL checks but not Credo's DID resolver — which
would have tried `https://<lan-ip>/<uuid>/did.json` and failed at verification
time. The deployment is now genuinely https with a public certificate, so the
issuer's `did:web` resolves the ordinary way and the flag is irrelevant. The
credential type URL resolves too, which Credo fetches for rendering.

**Redirect URI must match.** The wallet sends `allowedRedirectBaseUrls[0]`,
that decommissioned host's redirect URI today. The Keycloak client in
`deploy/keycloak/realm-age.json` lists that, the app-scheme form
(`id.animo.paradym:///wallet/redirect`) and this deployment's
`https://135.235.192.9.sslip.io/wallet/redirect`. If the wallet is built to send
a different one, add it there or the sign-in completes and the wallet never
receives the code.

## Deployed environment *(pinned, 26 August 2026)*

The public origin had to be pinned before anything demoable was issued, because
it is part of both the issuer's `did:web` and the credential type. It now is:

| | |
|---|---|
| Origin | `https://135.235.192.9.sslip.io` (Let's Encrypt, real certificate) |
| Verifier page | `https://135.235.192.9.sslip.io/verifier/` |
| Issuer metadata | `https://135.235.192.9.sslip.io/.well-known/openid-credential-issuer` |
| Authorization server | `https://135.235.192.9.sslip.io/auth/realms/age` |
| Host | the sandbox VM, alongside the previous RC stack, which is backed up, restorable and currently stopped (their ports are mutually exclusive) |

`sslip.io` resolves `<ip>.sslip.io` to that address, so a public certificate can
be issued with no DNS to own — enough to satisfy `did:web`'s https requirement
without inventing a domain for a demo.

Two things this deployment made necessary, both now in the repository:

- **The public internet can reach it**, so the gateway now has two listeners.
  Port 80/443 serve `routes-citizen.conf` — the wallet and verifier routes, and
  nothing else. The stack's unauthenticated operator endpoints (registry API read
  and write, DID minting, schema creation, the pre-authorised offer endpoint,
  Keycloak's admin console, and `POST /oid4vc/offer`, which mints a credential
  from claims the caller supplies) are served only on a listener Docker publishes
  on `127.0.0.1:8088`. Verified against the deployment: every one of those paths
  answers 403 or 404 from the internet, port 8088 refuses off-box connections,
  and every wallet- and verifier-facing route answers 200.

  Operator work therefore happens on the box, or over an ssh port-forward:

  ```bash
  ssh -L 8088:127.0.0.1:8088 <user>@<host>
  PUBLIC_URL=https://<host> OPS_URL=http://127.0.0.1:8088 npm run test:e2e
  ```
- **Re-running setup is safe.** `scripts/enable-https.sh` is idempotent, and
  `bootstrap.sh` now refuses to reuse a DID minted under a different origin.

## Step E — Wallet compatibility spike *(before building the journeys)*

Prove and record: sign-in inside the wallet; issuer list showing only the National
Identity Authority; direct fetch with no QR; credential rendering; cross-device QR
presentation; same-device deep link; and which metadata/compatibility mode the
wallet needs. First item is the nonce-sourcing finding in COMPATIBILITY, because it
decides the Keycloak arrangement.

## Step F — The three journeys

1. **Identity:** Keycloak in the stack, one demo account per synthetic citizen,
   `citizenId` exposed as a token claim, mapping enforced server-side.
2. **Flow 1:** wallet signs the citizen in, lists the issuer, fetches the
   credential. No QR, no issuer page. Negative paths as tests: wrong password,
   unmapped account, manipulated citizen identifier.
   **Server side done and proven** by `tests/e2e/flow1-wallet-issuance.test.mjs`
   against the live deployment: it drives Keycloak's real login page, exchanges
   the code with PKCE, takes the nonce from the issuer's nonce endpoint, and
   receives a credential built from that citizen's own registry record and bound
   to the requesting wallet key — then presents it and gets APPROVED. All three
   negative paths above are covered, plus a random bearer token, an unpublished
   credential type, and a regression that pre-authorised issuance still works
   with Keycloak enabled. 11 tests. What is left is the wallet's own UI on a
   device: the issuer list, the in-app browser, the approve screen, the
   recordings.
3. **Flow 2:** cross-device QR on a device. Pin the public HTTPS host *before*
   issuing anything demoable — it is baked into the issuer identifier and the
   credential type, so changing it invalidates credentials already issued.
4. **Flow 3:** installed Android app, built on `services/verifier`, displaying only
   what that service decides. Android because the wallet is Android — an
   engineering decision, recorded.

### Running the journeys on the device

Install (USB debugging on, phone unlocked):

```bash
adb install -r vendor/paradym-wallet/apps/wallet/android/app/build/outputs/apk/release/app-release.apk
```

**Flow 1 — the wallet fetches the credential.** Record from the home screen.

1. Open Sunbird Wallet (Preview) → the issuer directory shows **National
   Identity Authority**, and nothing else. If the directory is missing entirely,
   `CREDENTIAL_ISSUER_URLS` was not set at build time.
2. Tap it → an in-app browser opens Keycloak at
   `https://135.235.192.9.sslip.io/auth/realms/age`.
3. Sign in as `citizen.meera` with the password from `deploy/.env` on the host.
   Expect **no** "Update Account Information" form — that was a finding, and the
   realm now disables it.
4. The browser closes and the wallet shows the credential **before** storing it,
   with `ageOver18` visible. Approve.
5. The credential is in the wallet. Close it, reopen, unlock: still there.
6. On the host, end the Keycloak session
   (`kcadm.sh delete users/<id>/sessions`, or just wait out
   `ssoSessionIdleTimeout`), reopen the wallet: the credential is still there and
   was not reissued — answer 7 wants both halves shown.

Negative paths, same build: `citizen.unmapped` (signs in, receives nothing) and a
wrong password (never reaches the wallet).

**Flow 2 — cross-device presentation.** Open
`https://135.235.192.9.sslip.io/verifier/` on a laptop, scan the QR from the
wallet, check that the consent screen names the verifier and asks for
`ageOver18` **only**, approve, and watch the page decide. Repeat with the minor's
credential for DENIED — a verified DENIED, not a failure.

### What the device run proved, and what it cost

Both journeys work. Three defects surfaced only on the device, all fixed in the
repository rather than by hand on the server — and each one is now covered so it
cannot come back silently:

| Symptom on the phone | Cause | Now guarded by |
|---|---|---|
| "Something went wrong" the instant the wallet opened Keycloak | our issuer metadata advertises a `scope` per credential, a standards wallet asks for exactly that scope, and Keycloak rejects scopes it does not know (`invalid_scope`) | the realm carries every advertised scope as an optional client scope, and the Flow 1 suite signs in with the advertised scope and asserts Keycloak grants **all** of them |
| Onboarding stalled on "Update Account Information" | Keycloak's default user profile requires an email, so `VERIFY_PROFILE` fires before the wallet receives its code | the realm disables it; `verify.sh` checks that |
| The QR would not scan | dense payload rendered small, with a 2-module quiet zone, on a cream panel | 480px, 4-module quiet zone, `ecl: 'L'`, rendered at 24rem on white |

The first one is the instructive one: the automated suite was passing while a real
wallet could not get past the login screen, because the suite asked for `openid`
and a wallet asks for what metadata advertises. Tests that model the client
loosely will keep doing this. Worth remembering before Agriculture.
## Recording shot list *(answer 6: one continuous take per journey)*

Six takes, one per journey, in the order Anand's storyline runs: authenticate →
receive credential → consent → share only age status → verify → APPROVED or
DENIED. Recorded with the phone's own screen recorder, not adb — `screenrecord`
caps a clip at 180 seconds and the USB link proved unreliable.

### Pre-flight, once, before any recording

```bash
./scripts/seed-age-citizens.sh          # refreshes drifted boundary dates
curl -s https://<host>/.well-known/openid-credential-issuer \
  | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["credential_configurations_supported"]))'   # must print 1
grep DEMO_CITIZEN_PASSWORD deploy/.env  # the password to type; never write it down elsewhere
```

Then on the phone: both apps installed, screen brightness to maximum, and
notifications silenced so nothing lands mid-take.

**The one rule that decides whether a take works:** before invoking the wallet
from anywhere, the wallet must be **backgrounded and already unlocked** — open it,
unlock it, press Home. With it in the foreground Android never delivers the
request; force-stopped, it loses the destination through its own PIN gate.

### Take 1 — Issuance inside the wallet (the adult)

The wallet's data is cleared, so this starts from onboarding — which makes a
better opener than a wallet that already holds cards, and makes take 6 mean
something.

1. Open Sunbird Wallet → choose a PIN (the "fresh wallet" beat).
2. **Get a card** → the directory lists **National Identity Authority**, and only
   that. One credential under it — the negative fixture is gone.
3. Tap **Age Verification Credential** → the wallet warns it cannot verify the
   organisation, then asks the citizen to authorise.
4. Keycloak opens *inside* the wallet. Sign in as `citizen.meera`.
5. The wallet shows what arrived **before** storing it: `ageOver18` **true**,
   `ageOver21` true. Hold long enough to read. Approve.
6. The card is in the list — the wallet's first credential.

~2 min including onboarding. Point being made: issuance begins in the wallet,
there is no issuance QR, and the holder sees the claims before anything is
stored.

### Take 2 — Cross-device presentation, APPROVED

Laptop shows `https://<host>/verifier/`; phone in hand. Record both screens.

1. **Start age check** → **Enlarge for scanning**.
2. Wallet → **Scan QR-code**, phone 15–25 cm back, steady.
3. Consent screen names the verifier and asks for `ageOver18` **only**. Approve.
4. Laptop: **APPROVED**, issuer named, `ageOver18 = true`, the withheld claims
   struck through, seven checks green.

~60 s. Uses the credential from take 1. If the symbol will not decode,
stop and say so on camera rather than switching to the same-device path — Anand
asked for this one specifically.

### Take 3 — Installed mobile verifier, same device (Flow 3)

Wallet unlocked and backgrounded. Start on the phone's home screen.

1. Open **Age Check**. Read the line: it asks for one thing only.
2. **Start age check** → the wallet comes forward with the request.
3. Consent → approve.
4. Back in Age Check: **APPROVED**, issuer, `ageOver18 = true`, seven checks, and
   the footer stating the decision is the verifier service's, not the app's.

~60 s. This is the journey the mobile web page could not stand in for.

### Take 4 — Ineligible citizen, verified DENIED

First, off camera, repeat take 1 signing in as `citizen.arjun` so the wallet holds
the minor's credential too. Then, same steps as take 3, choosing that credential.

1. **Start age check** → consent → approve.
2. **DENIED**, and every one of the seven checks still green.

~45 s. Say the important part out loud: this is a *verified* refusal. The
signatures were all valid; the policy said no.

### Take 5 — Cancellation

1. **Start age check** → the wallet shows the request.
2. **Decline** it.
3. The verifier shows **NO DATA SHARED** — "nothing was disclosed and no approval
   was produced". No verdict chip, no red failure, no claim values anywhere.

~40 s. If the wallet posts nothing at all rather than an explicit refusal, the
same panel appears when the request expires; either way the screen is honest.

### Take 6 — Credential persistence

1. Close the wallet, reopen it, unlock.
2. The credentials are still listed. Open one and show its attributes.

~30 s.

## Showcase review round two (27 August 2026)

Feedback recorded verbatim in
[`../../docs/reviews/ITERATION-01-FEEDBACK-ROUND2.md`](../../docs/reviews/ITERATION-01-FEEDBACK-ROUND2.md).

Anand accepted Flow 1 and the same-device half of Flow 2 from the recording, and
asked for five more demonstrations plus one removal. What changed in response:

| His item | State |
|---|---|
| Cross-device verification (laptop QR → wallet → APPROVED on the laptop) | the page gained an **Enlarge for scanning** mode, because module pitch is what a camera decodes and the payload cannot be shortened (see COMPATIBILITY finding 9). Pending a successful scan on the device |
| Ineligible citizen → verified DENIED | no code needed; `citizen.arjun` (AGE-000002, born 2012) issues a credential with `ageOver18: false`, and the verifier reaches DENIED with every check still passing. Rehearsal item |
| Cancellation → nothing shared, no approval | **done.** The verifier distinguishes a refusal from a failure and returns `declined`; the page and the mobile app render `declined` and `expired` as a neutral "NO DATA SHARED" |
| Credential persistence | no code needed; lock, reopen, unlock. Rehearsal item |
| Installed mobile verifier app | **done on the device** (Samsung SM-A055F, 27 August): `services/verifier-mobile` handed the request to the wallet over `openid4vp://` and displayed APPROVED with all seven checks. Expo, one screen, two HTTP calls to the shared verifier service |
| Remove the negative-test credential from the directory | **done.** Bootstrap no longer creates it; the tests provision and retire it themselves |

### The mobile verifier, and why it is thin

The charter requires that the mobile UI "displays results; it does not
independently trust claims or make cryptographic decisions", and that one
reusable verification service serves both channels. So the app does three things
and nothing else: asks the verifier service for a request, hands that request to
the wallet over `openid4vp://`, then polls and renders the answer. There is no
credential parsing, no signature check and no age comparison in it — and the
gateway enforces that independently, since `/vp/*` is refused on the public
listener. `verify.sh` asserts both halves: that the app calls the shared service,
and that it contains no verification code.

**How the wallet must be invoked.** Three states, and only one works:

| Wallet state when the request is sent | Outcome |
|---|---|
| Backgrounded (warm) | delivered and shown — the sequence to demonstrate |
| Foreground | Android re-surfaces its task without delivering the intent |
| Force-stopped (cold) | the wallet loses the destination through its own PIN gate |

The cold-start case is a bug in the wallet fork, not here: `+native-intent.tsx`
returns the presentation route directly on `initial: true` instead of wrapping it
in `/authenticate?redirectAfterUnlock=…`, so the unlock screen forgets where it
was going. Left to the wallet to fix; the demo sequence avoids it.

Two build details worth keeping: `babel-preset-expo` is not installed by `expo`
itself and the first build died in Metro without it, and
`Linking.canOpenURL('openid4vp://…')` returns false under Android 11+ package
visibility unless the app declares the scheme in `<queries>` — done here with a
config plugin, because `expo prebuild` regenerates the manifest and would drop a
hand edit.

Built the same way as the wallet — `expo prebuild` then
`assembleRelease -PreactNativeArchitectures=arm64-v8a` — pinned to the versions
already proven on this hardware (Expo 56.0.12, React Native 0.85.3, React
19.2.3). Package `id.sunbird.ageverifier`, so it installs beside the wallet.

### Demo accounts for the showcase

The password is the one in `deploy/.env` on the demo host
(`grep DEMO_CITIZEN_PASSWORD deploy/.env`) — never written down here, per
answer 3. Boundary dates are relative to the seeding day, so
re-run `./scripts/seed-age-citizens.sh` on the morning of any demo — it refreshes
drifted dates in place and prints what it changed.

| Account | Citizen | `ageOver18` | Journey |
|---|---|---|---|
| `citizen.meera` | Meera Nair, 1998-04-02 | true | APPROVED |
| `citizen.arjun` | Arjun Das, 2012-08-30 | false | verified DENIED |
| `citizen.nikhil` | Nikhil Rao, turns 18 today | true | boundary |
| `citizen.sana` | Sana Iqbal, turns 18 tomorrow | false | boundary, DENIED |
| `citizen.unmapped` | none | — | signs in, receives nothing |

## Step G — Evidence

| Level | Proves | Artifacts |
|---|---|---|
| Automated | technical behaviour | unit + e2e suites, scripted-client protocol coverage |
| Real component | the stack integrates | Keycloak, companion config, Sunbird RC versions and digests |
| **Real device** | **the required journeys** | one continuous recording per journey, to his shot list |

Plus: exact versions including the fork build's commit and image digest; the
account-to-citizen mapping; a running decision and deviation log; sanitised
minimum-disclosure evidence per channel; and pass/fail traceability from every
charter checkbox to an artifact.

## Verification

```bash
./scripts/verify.sh                       # repo, stack and fork state, plus the suites
npm run test:unit && npm run test:e2e
cd ../sunbird-rc-core/services/oid4vc-service && npx jest
```

Then the spike, then the three journeys with recordings.

## Open with Anand

- Acknowledge the protocol-store interpretation above.
- The `/vp/status` algorithm reporting: confirm it is wanted as a separate change,
  since it is what makes the algorithm policy enforceable.
