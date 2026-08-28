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
