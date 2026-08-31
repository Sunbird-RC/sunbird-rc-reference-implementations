# Iteration 02 — Agriculture / Rural Credit: implementation log

**Branch:** `iteration/agriculture-02-rural-credit`
**Baseline:** the accepted Age `main` (merge `ac2602d`), synchronised into this
branch on 28 August 2026
**Inputs:** [`PRODUCT.md`](PRODUCT.md), [`REQUIREMENTS.md`](REQUIREMENTS.md),
[`DESIGN.md`](DESIGN.md), [`DEMO.md`](DEMO.md)

This is the working record: what was built, why it is shaped that way, and what
each decision cost. Acceptance evidence goes in `docs/evidence/02-agriculture/`.

## The wallet

Anand approved using the wallet already vendored at `vendor/paradym-wallet`
rather than Inji, recorded with its reasoning and consequences in
[`../../docs/reviews/DECISION-02-wallet-choice.md`](../../docs/reviews/DECISION-02-wallet-choice.md).
The short version: there is no pinned Inji build to run the mandatory handshake
against, and three recorded Inji risks would all have had to be resolved first.
What this iteration therefore does not prove is that Inji interoperates with this
stack.

## Two issuers, and what that cost

The requirement that shaped the architecture is that the wallet must show **two
independent issuers** with different DIDs, each reading only its own authorised
data (`REQUIREMENTS.md` §3, `DESIGN.md` §4).

A wallet's issuer directory lists **credential issuers**, one per
`credential_issuer` URL. Two credentials served from one URL would appear as one
issuer offering two credentials — which is not what the demo has to show. So each
registry is its own `oid4vc-service` instance:

| Instance | Serves | Subject entity | Subject key | Issuer DID |
|---|---|---|---|---|
| `oid4vc-service` | Age (unchanged) | `AgeCitizen` | `citizenId` | `${AGE_ISSUER_DID}` |
| `oid4vc-farmer` | `FarmerIdentityCredential` | `FarmerRecord` | `nationalId` | `${FARMER_ISSUER_DID}` |
| `oid4vc-land` | `LandOwnershipCredential` | `LandRecord` | `nationalId` | `${LAND_ISSUER_DID}` |

**Claim resolution needed no fork change**, which was the open question when this
iteration started. The port had already made it configuration rather than code —
`REGISTRY_SUBJECT_ENTITY`, `REGISTRY_SUBJECT_KEY`, `KEYCLOAK_SUBJECT_CLAIM`,
`CLAIM_SOURCE_MAP` — and its own interface says so: *"Sources come back in
precedence order for whatever entities this deployment declares. Which entities
those are is configuration — this code names none."*

**Correction: one fork change was needed after all, and it was not this one.**
Running two issuers revealed that `issuerMetadata()` advertises every published
credential in the deployment, because `credential-schema`'s `/oid4vci-configs` is
deployment-wide and takes no filter. Each of the three issuers therefore
advertised all three credentials — which would have put an Age credential in the
Agriculture issuer directory, and broke Age's own one-credential invariant. No
configuration scopes it, so the fork gained `ADVERTISE_OWN_CREDENTIALS_ONLY`
(off by default, filtering on the `author` DID a schema already carries). Recorded
as finding 14 in COMPATIBILITY with a removal path; the port is now five commits
off `v2.1.0`, and `verify.sh`'s exact count was raised deliberately.

Three consequences worth stating:

- **The separation is structural, not a rule.** The Farmer instance's subject
  entity is `FarmerRecord` and it declares no related entities, so it *cannot*
  read a land record — there is no configuration by which it could. The same in
  reverse for the Land instance. `DESIGN.md` §4's "cannot access or issue the
  other registry's records" is enforced by what each process is told about,
  rather than by a check that could be forgotten.
- **The Land Registry resolves the farmer itself.** `LandRecord` carries its own
  `nationalId`, so the Land instance looks the authenticated farmer up directly
  instead of being handed a `farmerId`. That is `DESIGN.md` §7's requirement that
  one issuer must not rely on another issuer's unsigned client state, and it is
  why the same synthetic person appears in both registries' fixtures.
- **`nationalId` is never a credential claim.** It is the lookup key on the
  issuer side only, in both registries. The credentials carry `farmerId`, which
  is what the bank correlates on.

## Keycloak

A second realm, `agriculture`, rather than more accounts in the `age` realm. The
subject claim differs — `nationalId` here against `citizenId` for Age — and that
claim is per-issuer-instance configuration, so mixing both use cases into one
realm would mean one set of accounts carrying two identity claims for two
unrelated purposes. A separate realm also keeps the accepted Age accounts
untouched, which matters because Age regression has to stay green.

## The verifier

Extended rather than copied, which is what `DESIGN.md` §3 asks for. Two changes,
both generic:

1. **The read path is a loop.** It runs the same four steps — verification,
   disclosure policy, issuer trust, then the domain decision — once per credential
   the request asked for. Age passes through with one entry; the bank's request
   has two.
2. **Issuer trust is pinned per role.** Being on the allowlist is not the same as
   being trusted *for this slot*. Without that, the Farmer Registry's credential
   could arrive in the Land slot and pass, since both signatures are valid and
   both issuers are trusted (`REQUIREMENTS.md` §8).

Holder binding across the pair is not re-proven in the domain module:
`oid4vc-service` checks the Key Binding JWT for the presentation, so two
credentials in one VP token are held by one wallet key, and step 1 refuses the
presentation otherwise. That is what makes matching `farmerId` correlation rather
than coincidence.

## The lending decision

`config/policy/crop-rates.json`, beside the trust allowlist and for the same
reason: the per-acre rate is what turns verified acreage into a rupee figure a
customer reads, so it belongs in Git rather than in code or a database someone can
edit between demos. A rate above PRODUCT's ₹50,000 ceiling is a startup failure.

Money is integer arithmetic: hundredths of an acre and whole rupees, half-up
rounding. Acreage tolerates binary representation error — `4.1 * 100` is
`409.99999999999994` — while refusing genuine extra precision such as 4.005
acres, which the registry schema does not permit and which is therefore a
malformed claim rather than a business answer.

The distinction the module exists to keep straight, because both outcomes stop a
loan and they are easy to conflate in code:

| Cause | Outcome |
|---|---|
| Correlation broken, claim not what the schema promised, either credential missing | **REJECTED / UNABLE TO VERIFY** |
| Not a registered farmer, ownership not `ACTIVE`, nothing cultivated, crop outside the policy | **NOT ELIGIBLE** |

Correlation is checked **before** any business rule, so a farmer who is both
unregistered and mismatched is rejected rather than reported ineligible. There is
a test for that ordering specifically.

## The Agriculture issuer directory must not show the Age credential

`DEMO.md`'s quality gate forbids an Age or unrelated issuer in the Agriculture
wallet configuration, and Kartheek confirmed it on 28 August 2026. It has **two
halves**, and only one of them is server-side.

**Server side — done, and it needed the fork fix.** Each issuer now advertises
only the credential it authored, so the Farmer Registry's directory entry offers
`FarmerIdentityCredential` and nothing else. Before
`ADVERTISE_OWN_CREDENTIALS_ONLY` all three issuers advertised all three
credentials, which is precisely the failure the gate names. `verify.sh` asserts it
per issuer:

```
the farmer issuer advertises only its own credential
the land issuer advertises only its own credential
exactly ONE credential is advertised to wallets      (the Age issuer)
```

**Wallet side — a build-time decision.** The wallet's issuer directory is built
from `CREDENTIAL_ISSUER_URLS`, baked in at build time. So the Agriculture demo
build must list **only** the two Agriculture issuers:

```bash
export CREDENTIAL_ISSUER_URLS=https://<host>/farmer,https://<host>/land
./scripts/build-wallet.sh
```

Include the Age issuer's URL and the directory shows "National Identity Authority"
beside the two registries, gate failed — no server-side change can prevent it,
because the wallet is asking for that issuer's metadata directly.

The consequence to plan around: one APK cannot satisfy both demos, and both builds
share the package name `id.paradym.wallet.preview`, so installing one replaces the
other. The demo device therefore carries the build for the iteration being
demonstrated. Age's automated regression does not need the wallet — 43 unit and 50
end-to-end tests run headless — so this costs on-device Age re-demonstration only,
which Anand has already accepted and signed off.

## The wallet's trust entries for the two registries

`vendor/paradym-wallet/apps/wallet/src/constants.ts` gains one
`trustedOpenId4VciIssuerEntities` entry per registry — **Farmer Registry** and
**Land Registry**, each with its own logo out of `services/web-assets/logos/` and
each marked `demo: true`. Without them the wallet offers both credentials as an
unknown organisation, which nothing in the stack reports: the offer resolves, the
credential stores, only the trust screen the farmer reads is wrong.

Neither issuer signs its metadata, so both resolve through the fallback (`none`)
mechanism in `packages/sdk/src/trust/handlers/fallback.ts`:

```ts
trustedEntities.find((e) => issuer.startsWith(e.issuer))
```

A **prefix** match resolved by the **first** hit, and that combination is the trap
in this list. Both registries are served from the one demo host under `/farmer`
and `/land`, and Age's entry is host-scoped — so Age's entry is a prefix of both.
Listed above them it claims both, and a farmer accepting a land credential is
told, with a trusted badge, that the National Identity Authority is issuing it.
The registries are therefore listed **before** Age: more specific prefixes first.

Ordering that matters and cannot fail loudly needs a test rather than a comment,
so `tests/unit/wallet-trust.test.mjs` asserts it directly — no entity may be
preceded by one that is a prefix of it — along with both registries being present,
distinctly named, and marked as demonstration entities. The ordering assertion was
confirmed by reversing the two blocks and watching it fail before being restored.

Path-scoped rather than DID-scoped deliberately: the paths are stable, the minted
issuer DIDs are not, so these entries survive a re-bootstrap without rebuilding
the APK. That is the same property the trust-lookup fix bought on the Age side.

**Deploying them.** The logos are served from the read-only bind mount at
`../services/web-assets`, so the host needs the repository updated; nothing needs
restarting. Until that happens both URLs 404 and the trust screen shows a
placeholder — verified as 404 against the sandbox host while writing this.

**Still open: the bank is not named on the presentation screen.** The deployment
mints one `VERIFIER_DID`, labelled *Age-restricted service (verifier)*, and the
single `oid4vc-service` instance signs every presentation request object with it.
The bank's request therefore arrives carrying the Age verifier's DID, which the
wallet resolves through its `trustedDidEntities` entry to **"Age Check"** — so the
farmer's consent screen reads "Do you trust Age Check?" where `REQUIREMENTS.md`
R3.4 and `DEMO.md` step 4 require the bank. Renaming the shared entry is not
available: it would change the Age trust screen already recorded as accepted
evidence. The fork emits no `client_metadata`, so the request cannot carry a name
either. The fix that matches this iteration's shape is a separate bank verifier
DID with its own `oid4vc-service` instance and its own wallet trust entry, exactly
as the two registries are separated; `gramin-bank.png` is already prepared for it.
Not yet built — it adds a service instance and a bootstrap step, so it is
Kartheek's call.

## What running the two apps end to end actually found

The API suite was green, 74 tests, before either application had been opened.
Both defects below were invisible to it, and both were found within minutes of
pointing a browser at the bank page. They are recorded because the second one in
particular is the kind of thing a passing test suite is supposed to prevent.

**1. The bank page could never show a decision.** The verifier routed
`POST /agriculture/sessions` but only `GET /sessions/<id>` — there was no
`GET /agriculture/sessions/<id>` and no cancel under that prefix. The page polls
its own namespace, as `app.js` says it does ("It talks ONLY to
/api/verifier/agriculture"), so every poll fell through to
`404 {error: not_found}`, which `poll()` treats as expiry. The page therefore
read **"No presentation arrived before the request expired"** over an application
the verifier had already decided **ELIGIBLE**. Confidently wrong, which is worse
than an error.

The suite missed it because `readVerification` uses the Age path
`/api/verifier/sessions/<id>` — which works, for Agriculture sessions too. Tests
and application were calling different URLs, so both were green and only one was
right. The read and cancel patterns are now built from the use-case map:

```js
const USE_CASE_PREFIX = `(?:/(?:${Object.keys(USE_CASES).join('|')}))?`;
```

so a third use case cannot be added and silently left un-pollable, and an
unknown prefix is still a 404 rather than a wildcard. Four tests were added that
call the URLs `services/bank-web/app.js` actually calls, including one asserting
`/education/sessions/<id>` stays unrouted.

**2. The bank under-reported what the farmer had shared.** `disclosed` carried
only the three values the lending policy consumed, while the page prints it as
"Shared with us" beside the list of claims that were withheld. Five distinct
claims arrive; three were shown. Nothing was leaked — the error was in the
privacy story's favour, which is precisely why it needed fixing: the demo's whole
argument is that the withheld list is honest, and it cannot be honest beside a
shared list that is not. `disclosed` is now built from the verified claim sets.

`farmerId` is still taken from the farmer credential specifically rather than
merging the two, because when the two disagree the decision is
`CORRELATION_FAILED` and a merge would display one farmer id for a presentation
that carried two.

The privacy test had hardcoded the three-claim expectation, so it pinned the
defect in place. It now derives the expected set from the bank's published policy
and asserts both directions — nothing extra, and nothing missing.

## Wallet-driven issuance for the two registries

`tests/e2e/flow2-agriculture-issuance.test.mjs`, 11 tests, the Agriculture
counterpart of Flow 1. Everything else in the Agriculture suite gets credentials
into the wallet with a pre-authorised offer, which is supporting protocol
evidence and explicitly not the journey the charter requires. This drives the
real thing: `authorization_code` with PKCE against the `agriculture` realm,
Keycloak's own rendered login page, the `nationalId` claim, each registry's
nonce endpoint and holder binding.

Two issuers make it more than a copy of Flow 1. One sign-in and one holder key
collect from both registries, and the tests pin what the separation is supposed
to buy:

| Asserted | Why it matters |
|---|---|
| Each registry advertises exactly one credential configuration | The wallet directory gate, at the protocol level |
| The two credentials carry different `iss` | Independent issuers, not one issuer wearing two names |
| `nationalId` appears in neither credential | Issuer-side lookup key only; a wallet that held it could disclose it |
| An **age-realm** token buys nothing from a registry | Both realms sit behind one Keycloak and one gateway |
| The Farmer Registry refuses to issue the Land credential | Structural separation, pinned rather than assumed |
| A farmer with no land gets the farmer credential and no land credential | The half-issued case the bank must fail safely on |

One assertion was wrong when written and is worth recording. A farmer with no
registry record is correctly refused, and the refusal names **their own** national
id: `no record for nationalId 'NAT-...'. Contact the issuing authority.` I first
asserted that id must be absent. It should not be: it is returned only to the
holder it belongs to, over TLS, it is the value they would quote to the issuing
authority, and it reaches no log (checked against the container logs). The test
now asserts the thing that would be a leak — no other farmer's identifiers, and
no registry record in a refusal.

## The sandbox deployment, and the one thing the phone still has to prove

The showcase host now runs both iterations. The Age DIDs were reused rather than
re-minted, so the accepted Age evidence and its recordings still describe the
deployment they were captured from.

Verified against it, over HTTPS, from a clean run:

- 86 unit tests, 89 end-to-end tests, 91 `verify.sh` checks, 136 fork jest tests
- Each of the three issuers advertises exactly one credential configuration
- The bank page reaching ELIGIBLE with the calculation, both issuers named, five
  disclosed claims, six withheld, and all seven verification checks passing
- The Age regression suite green on the same deployment, after re-seeding the two
  boundary citizens — they had been seeded to turn 18 on the 26th and 27th, and
  the suite detected the staleness itself rather than quietly passing

The Agriculture APK is built with `credentialIssuerUrls` limited to the two
registries — confirmed by reading `assets/app.config` out of the APK rather than
by trusting the build flag:

```json
["https://<host>/farmer", "https://<host>/land"]
```

What remains is the part no test can stand in for: installing that APK and
collecting both credentials on the device, through the wallet's own issuer
directory, in-app browser and trust screens. The server half of that journey is
covered by Flow 2, so a device failure can be attributed to the wallet rather
than the stack.

## "Age Check" must not appear anywhere in the Agriculture demo

Kartheek's instruction, and it turned out to have **three** separate causes. The
first was known; the other two were only visible with the apps in front of a
person, which is the argument for the rule that every mandated channel is
demonstrated on the real application.

**1. The wallet's issuer directory.** Fixed already: `CREDENTIAL_ISSUER_URLS`
lists only the two registries, verified by reading `assets/app.config` out of the
APK.

**2. The installed mobile verifier said "Age Check" on the launcher and offered
an Age option on its idle screen.** It was an Age-only app; adding a farm-credit
channel gave it a picker, and a picker is the wrong shape for the same reason the
wallet's issuer list is baked in — it puts the other use case in front of the
person. The channel is now a build-time choice:

```bash
VERIFIER_USE_CASE=agriculture ./gradlew assembleRelease   # "Farm Credit"
VERIFIER_USE_CASE=age         ./gradlew assembleRelease   # "Age Check", unchanged
```

The launcher label, the eyebrow, the copy, the button, the API namespace and the
withheld-claims list all follow from that one variable. `Age Check` is absent from
the Agriculture APK's resources entirely — checked in `resources.arsc`, not
assumed. An unknown value fails the build rather than defaulting.

The **package deliberately does not change**. `PRODUCT.md` lists an
"Agriculture-specific mobile verifier application" as out of scope, so this stays
one application serving two channels; two packages would be two applications. It
also means the two builds replace each other on a device, as the wallet builds do.

Scope note, stated plainly: `REQUIREMENTS.md` §1 says "No Agriculture-specific
mobile verifier is required. Web QR verification is the customer-facing channel."
So this is **not required for acceptance** and must not be offered as evidence in
place of the web channel. It is not forbidden either — "not required" is not
"not permitted" — and it was asked for.

**3. The wallet asked the farmer to trust "Age Check" — the real defect.**

The deployment minted one `VERIFIER_DID`, and the single `oid4vc-service`
instance signed every presentation request with it. A wallet names the requesting
party from the key that signed the request object, so the age-restricted service
and the bank were **one party** as far as any wallet could tell. The farmer's
consent screen was not mislabelled; the deployment was genuinely conflating two
parties, and the wallet reported that accurately.

This is the mistake `DESIGN.md` and `bootstrap.sh` already refuse between the
issuer and the verifier — *"a separate identity because it is a separate party; a
demo that signed verifier requests with the issuer's key would quietly conflate
them"*. It simply had not been applied between the **two verifiers**. So this is a
defect against the existing baseline rather than a change to it.

The fix, following the pattern the two registries already established:

| Piece | Change |
|---|---|
| `bootstrap.sh` | Mints `BANK_VERIFIER_DID` — *Gramin Bank (farm credit verifier)* |
| `docker-compose.yml` | `oid4vc-bank`, a fourth instance that signs and **issues nothing** — no Keycloak, no registry, no `ISSUER_DID`, so it can never appear in an issuer directory |
| `routes-citizen.conf` | `/bank-vp/` → `oid4vc-bank`, so the `request_uri` in the QR resolves to the instance that signed it |
| `routes-denied.conf` / `routes-ops.conf` | Its `POST /vp/request` and `/vp/status` refused publicly, proxied on loopback — the same treatment the registries' offer endpoints get |
| `services/verifier` | A signer per party; the session records which one, because a transaction's status lives in the instance that created it |
| `constants.ts` | A trusted DID entry naming **Gramin Bank**, with its logo |

Verified on the deployment: the QR now carries
`client_id=did:web:…:bec7ef08…` and
`request_uri=https://<host>/bank-vp/vp/request-object/…`, the request object is
served, and both bank operator endpoints answer 403 publicly.

### The ordering trap, again, and worse

The wallet's trusted-DID list is matched with `baseDid.startsWith(e.did)` and the
first hit wins — the same shape as the issuer list. The host-scoped fallback
entry, which exists so a re-bootstrap does not read "Organization not verified",
was named **"Age Check"** and is a prefix of *every* `did:web` minted on that
host. It would have claimed the bank's DID outright.

A host-scoped entry cannot honestly name a party once two parties are minted
under one host, so it now names the **deployment** — `Sunbird RC showcase (demo
deployment)` — and only the exact, pinned entries name parties. Three unit tests
hold the line: no entity may be preceded by a prefix of itself, no host-scoped
entry may carry a party name, and the bank must be named. The second was
confirmed by restoring the old name and watching it fail.

### Two deployment traps found while shipping this

**A single-file bind mount does not survive rsync.** `routes-citizen.conf` and
friends are mounted file-by-file. rsync writes a temporary file and renames it,
which replaces the inode, and the container keeps the old one — so the host file
was correct, `nginx -t` passed, `nginx -s reload` succeeded, and nginx went on
serving a config without `/bank-vp` in it. The symptom was a 404 with
`open() "/etc/nginx/html/bank-vp/..."` in the error log: no location matched, so
the static root answered. **After syncing an nginx conf, recreate the container**;
reloading is not enough. Directory mounts (`web-assets`, `bank-web`) are unaffected.

**`set` must precede `rewrite ... break`.** Both are rewrite-module directives and
`break` ends that phase, so a later `set` never runs and `$up` is empty. The
existing routes carry that warning in a comment; I wrote the new one in the wrong
order anyway.

### The test wallet now follows the QR

`fetchRequestObject` rebuilt its URL from `PUBLIC_URL`, which silently assumed one
signer at the root. With the bank on its own prefix that URL points at the wrong
instance. The helpers now prefer the `request_uri` from the QR and the
`response_uri` from the request object — which is what a real wallet does, and
therefore what the suite should have done from the start. The `base` forms are
kept for the Age tests. `readSession` returns `qrData` with the waiting state so a
client holding only a session id can still find the request.

## REJECTED / UNABLE TO VERIFY, on the device

Anand's review of the first demo video asked for a mismatched, untrusted,
tampered or wrong-holder combination shown as `REJECTED / UNABLE TO VERIFY`.

I had recorded that this outcome was not producible from a phone. **That was
wrong**, and worth stating plainly: it generalised from "an honest wallet will not
forge a credential" to "no rejection is possible at all", and so missed the case
Anand lists first — a mismatched **combination**, which needs no forgery.

### The recipe

Nothing is tampered with and nothing is pre-authorised:

| Step | Action |
|---|---|
| 1 | Clear the wallet, then collect the **Farmer** card as `farmer.ravi` |
| 2 | Clear the agriculture realm's SSO session (below) |
| 3 | Collect the **Land** card as `farmer.lakshmi` — the offer will read `Crop type WHEAT`, which is *her* land, not his |
| 4 | Start the credit check and consent |

Step 2 is the one that is easy to miss. Keycloak keeps an SSO session in the
browser the wallet hands off to, so without clearing it the second issuance
silently reuses the first farmer and you get a matching pair:

```bash
docker exec sunbird-rc-age-keycloak-1 /opt/keycloak/bin/kcadm.sh \
  create realms/agriculture/logout-all
```

Confirmed on the SM-A055F on 31 August 2026, through the installed Farm Credit
app. The bank reported **REJECTED / UNABLE TO VERIFY**, "the two credentials name
different farmers", with **all seven cryptographic checks green** and no decision
and no loan figure.

That combination of facts is what makes it worth watching: nothing was forged,
every signature verified, the holder binding held — and the bank still refused,
because what it refused was the **combination**. It is also visibly distinct from
`NOT ELIGIBLE`, which means the claims were trusted and the answer was no.

### What remains suite-only, and why

Tampering, an untrusted issuer, and two credentials held by different wallets are
covered by `tests/e2e/agriculture.test.mjs` and stay there: an honest wallet
cannot produce any of them, and the Agriculture build's issuer directory is baked
to the two registries, so a farmer cannot collect from an untrusted issuer through
the app at all. The mismatched combination is the one member of that family a real
device can demonstrate, and it is the one the charter's §7 fixture describes.

`scripts/wallet-agriculture.sh` gained `--land <fixture>` so the same pair can be
produced on a laptop for the web channel:

```bash
./scripts/wallet-agriculture.sh eligiblePaddy <sessionId> --land eligibleWheat
```

## Known limitations, carried forward deliberately

1. **Inji is unproven against this stack.** Deferred to Iteration 03, where
   PRODUCT's "Inji completes at least one full use case" would land.
2. **The Agriculture wallet build must not list the Age issuer.** Kartheek's
   instruction, 28 August 2026, and it matches `DEMO.md`'s quality gate — "No Age
   or unrelated issuer in the Agriculture wallet configuration". See below; this is
   a requirement, not a limitation.
3. **The algorithm allowlist.** `REQUIREMENTS.md` §8 requires resolving Age's
   recorded limitation explicitly rather than inheriting it. Open; it will be
   decided against what the presentation output actually exposes, and recorded
   either way rather than claimed.
