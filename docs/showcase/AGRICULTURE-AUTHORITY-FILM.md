# Agriculture, Authority-backed — film production script

The 31 August film shows two registries and a consented presentation. **It predates the
Authority Service**: there is no status check in it, nothing is suspended, and the
credentials in it are not linked to a lifecycle. This film is the one that shows the part
that iteration added — that the same credential stops working when its source does.

**Re-filmed on 22 September 2026** and delivered as
[`Agriculture-Authority-Showcase-22Sep.mp4`](../evidence/02-agriculture/Agriculture-Authority-Showcase-22Sep.mp4)
— 4 min 17 s, 720×1600, −16.0 LUFS, to the same spec as the other three films. Parts 3
onward are shot through the installed **Farm Credit** verifier rather than a browser, so
the bank, the consent and the decision all happen on one screen.

The 21 September cut is superseded: its consent screen reported that no purpose had been
supplied, and its refusals did not distinguish the source record from the credential. Both
were product defects rather than filming mistakes, and both are fixed at source.

This remains the shot script both were cut from.

This is a shot script, not a recording. Filming and narration happen outside this
repository, as they did for the three existing showcases; see
[`VIDEO-HANDOFF.md`](VIDEO-HANDOFF.md) for the delivery spec (720x1600, H.264, 30 fps,
AAC stereo, normalised to −16.0 LUFS).

Every beat below is exercised by `tests/e2e/agriculture-status.test.mjs`, which passes
against the deployment. Nothing here is aspirational: if a shot does not behave as
described, that test would have failed first.

---

## Before you start

Run against the deployed sandbox, not a local stack — the DIDs must be publicly
resolvable on camera.

```bash
# confirm the deployment is in the state the script assumes
ssh -i <key> <host> 'cd /home/rc/age-demo && \
  docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.tls.yml \
  ps --format "{{.Health}}" | sort | uniq -c'      # expect: 21 healthy
```

Reset the lifecycle fixture to ACTIVE before a take, or the suspension beat has nothing
to suspend:

```bash
scripts/lifecycle-agriculture.sh show      FRM-PB-0119
scripts/lifecycle-agriculture.sh reinstate FRM-PB-0119   # if it is SUSPENDED
```

**Fixtures.** Synthetic throughout. Sign-in password is in `deploy/.env` on the host and
is not recorded here.

| Role | Account | National id | Record |
|---|---|---|---|
| The farmer the film follows | `farmer.film2` | NAT-90077004 | FRM-PB-0119 |
| Spent by the 22 September take | `farmer.film` | NAT-90077003 | FRM-PB-0118 |
| Spent by the 21 September take | `farmer.lakshmi` | NAT-90023815 | FRM-PB-0117 |
| Inactivation case (terminal) | `farmer.terminal.inactive` | NAT-90077001 | FRM-KA-0901 |
| Revocation case (terminal) | `farmer.terminal.revoked` | NAT-90077002 | FRM-KA-0902 |

### Each take spends its subject, so filming has its own fixture

The film ends by revoking its subject's credential, and **issuance is idempotent**: a
subject whose credential has been revoked gets that same revoked credential back on every
later collection. So the subject of a take can never again hold a valid credential on that
deployment, and parts 5-7 can never be re-filmed with it.

Two takes have been spent that way already: 21 September took `farmer.lakshmi` /
FRM-PB-0117, and 22 September took `farmer.film` / FRM-PB-0118. The reserved `farmer.*`
rows exist so a retake does not have to spend one of the eligible fixtures the
acceptance suite depends on — `farmer.ravi` is the only other eligible farmer, and
`farmer.suresh`, `farmer.geeta`, `farmer.unregistered` and `farmer.noland` are all
deliberately *not* eligible, so none of them can produce the accepted verdict parts 3-4
need.

FRM-PB-0119 mirrors FRM-PB-0117 — Punjab, wheat, two cultivated acres — so the narration
needs no changes: the bank still offers eighty thousand rupees at forty thousand an acre.

**Each take spends one row**, so add another reserved row before the next one.

### Before filming, prove the subject works

A filming session is expensive and the failure modes are quiet — a missing
`nationalId` attribute produces a credential with no `authorityCredentialId`, and the
first sign of it is a presentation the bank cannot verify. Drive the real journey
headlessly first: password sign-in, authorization_code, both credentials, one consented
presentation, then suspend and reinstate.

Note that `scripts/wallet-agriculture.sh` **cannot** do this. It uses pre-authorised
offers with claims copied straight from the registry record, so the credential it gets
carries no `authorityCredentialId` and the agriculture request object cannot be satisfied
at all — it fails with `credential cannot disclose: authorityCredentialId`. That driver
predates the Authority Service and has not been retrofitted.

---

## Shot list

### 1 — Two authorities that share no database  *(~40s)*

On screen: the two public trust responses, side by side, fetched over the internet.

```bash
curl -s https://<host>/trust/issuers/<FARMER_ISSUER_ID> | jq
curl -s https://<host>/trust/issuers/<LAND_ISSUER_ID>   | jq
```

Both return a DID, a display name and verification methods — and nothing about tenants,
records or internal services. The two DIDs differ, and each resolves:

```bash
curl -s https://<host>/<uuid>/did.json | jq '.id, .verificationMethod[0].type'
```

**The point to narrate:** these are two separate authorities with separate tenants. Neither
can read the other's records. The correlation that follows happens outside both of them.

### 2 — The wallet collects both credentials  *(~60s)*

Sign in as `farmer.lakshmi` and collect the Farmer Identity Credential, then the Land
Ownership Credential. Two separate issuers, two separate sign-ins to two separate
credential offers.

**The point to narrate:** the credentials are issued by the authorities, held by the
farmer, and the wallet — not any server — is what holds both. Show the two cards in the
wallet.

### 3 — The bank asks, and the farmer consents  *(~50s)*

Open the bank page, start a check, and present both credentials from the wallet.

**On screen, if the wallet surfaces it:** what is actually disclosed. Cultivated area is
shared; total holding size, district and national id are not. They exist in the registry
and do not travel.

**The point to narrate:** holder-bound. The presentation is signed by a key the wallet
holds, so the bank knows one party holds both credentials rather than two parties each
holding one.

### 4 — Accepted  *(~30s)*

The bank returns an offer. Show the decision and the amount.

### 5 — The source is suspended  *(~45s)*

Without touching the wallet, suspend the farmer's record at the Authority:

```bash
scripts/lifecycle-agriculture.sh suspend FRM-PB-0119
scripts/lifecycle-agriculture.sh show    FRM-PB-0119    # SUSPENDED
```

Optionally show the public status route flipping, which is the same answer the bank gets:

```bash
curl -s "https://<host>/trust/credentials/<credentialId>/status" | jq
# {"credentialId":"did:rcw:…","status":"SUSPENDED","effectiveAt":"…"}
```

### 6 — The same credential is refused  *(~40s)*

Present **the same, unchanged credential** from the wallet again. The bank refuses.

**The point to narrate, and the reason this film exists:** nothing about the credential
changed. It has not expired and it has not been revoked. Its signature still verifies. The
bank refused because it asked the Authority about the source and the source is suspended.
A credential is a statement about a record, and it is no more reliable than that record
currently is.

### 7 — Reinstated, and accepted again  *(~35s)*

```bash
scripts/lifecycle-agriculture.sh reinstate FRM-PB-0119
```

Present the same credential once more. Accepted, and a loan offered again — no reissue, no
new credential, nothing done in the wallet.

### 8 — A terminal refusal  *(~35s)*

**Filmed as a revocation, and it has to be.** The obvious plan — present the reserved
terminal fixtures — is impossible, and both fail for correct reasons:

| Fixture | Why it cannot be collected |
|---|---|
| `FRM-KA-0902` | its credential is already REVOKED; reissue is refused (`VERSION_CONFLICT`) |
| `FRM-KA-0901` | its record is already INACTIVE; the Authority refuses to issue against it |

A credential cannot be collected for something already in a terminal state — the wallet
has to hold it *before* the transition. So the shot is: keep the film subject's card from part 7,
revoke it on camera, and present the same card again.

```bash
ROOT=$PWD; BASE=http://localhost:3334; API="$BASE/api/v1"
. scripts/lib/authority-auth.sh
authority_headers FARMER_OFFICER
curl -s -X POST "$API/credentials/<urlencoded credentialId>/revoke" "${AUTH_H[@]}" \
  -H 'content-type: application/json' -d '{"reason":"demonstration"}'
```

Then show the record is untouched:

```bash
scripts/lifecycle-agriculture.sh show FRM-PB-0119    # lifecycle=ACTIVE
```

**That contrast is the point:** the record is healthy and the credential is refused
anyway. Unlike suspension, this cannot be undone.

**This shot must come last.** After it, Lakshmi's credential can never be re-collected,
so the suspend/reinstate sequence in parts 5–7 can no longer be filmed with that
subject. Reserve a new one (see above) rather than reset the stack: a re-bootstrap mints
new issuer and verifier DIDs, which invalidates the wallet's pinned trust list and parts
1–2 as well.

---

## Retake sheet — the second half, with `farmer.film`

The 21 September take is correct for parts 1 and 2 and for every card. **Parts 3 to 8 are
re-shot**, because they show FRM-PB-0117 on screen and that subject is spent.

Eleven clips, same filenames as before so the assembly picks them up with no edits.
Overwrite in place in `RC_video/New_Flow/authority-service/`.

### Before the first take

**1. The subject is ACTIVE and its credential is not revoked.** On the deployment:

```bash
cd /home/rc/age-demo && scripts/lifecycle-agriculture.sh show FRM-PB-0119
# expect: FRM-PB-0119  workflow=APPROVED lifecycle=ACTIVE
```

**2. The whole journey works.** `scripts/check-film-subject.mjs` drives the real customer
journey — password sign-in, authorization_code, both credentials, one consented
presentation — then suspends and reinstates. Run it FROM A WORKSTATION, not the
deployment: it needs Node, and the operator and Authority ports are not public, so they
are forwarded. Use distinct local ports; a local stack owns 8088 and 3334, and forwarding
onto those makes it issue against one deployment and verify against the other.

```bash
# terminal 1 — the forward, left open
ssh -N -i <key> -L 18088:127.0.0.1:8088 -L 13334:127.0.0.1:3334 rc@<host>

# terminal 2 — in this repo
export PUBLIC_URL=https://<host>
export OPS_URL=http://127.0.0.1:18088
export AUTHORITY_URL=http://127.0.0.1:13334
export AGE_ISSUER_DID=$(ssh -i <key> rc@<host> 'sed -n s/^AGE_ISSUER_DID=//p /home/rc/age-demo/deploy/.env')
export DEMO_CITIZEN_PASSWORD=$(ssh -i <key> rc@<host> 'sed -n s/^DEMO_CITIZEN_PASSWORD=//p /home/rc/age-demo/deploy/.env')
export FILM_LIFECYCLE_SSH="ssh -i <key> rc@<host> cd /home/rc/age-demo &&"

node scripts/check-film-subject.mjs farmer.film2 FRM-PB-0119
```

Export `PUBLIC_URL` and `AGE_ISSUER_DID` together or neither: setting one without the
other falls back to `deploy/.env` and quietly mixes two deployments. What a good run
looks like:

```
signed in as farmer.film
farmer credential claims:
  farmerReference = did:web:<host>:<farmer-did>#farmer/Punjab/FRM-PB-0119
  registrationStatus = true
  authorityCredentialId = did:rcw:46e558a5-85ce-4b27-8525-7b021616a749
  -> Authority status: {"credentialId":"did:rcw:d767...","status":"ACTIVE",...}
land credential claims:
  cropType = WHEAT
  cultivatedArea = 2
  ...
request object purpose: "Applying for crop credit"

1. record ACTIVE        -> ELIGIBLE
2. record SUSPENDED     -> "the issuing Authority reports this credential's source record SUSPENDED"
3. record ACTIVE again  -> ELIGIBLE

the anchor to revoke in part 8:  did:rcw:46e558a5-85ce-4b27-8525-7b021616a749
```

Three things to read off it: the **purpose** is present (an empty one is what made the
consent screen warn the holder), the refusal names the **source record** rather than the
credential, and the last line is the id part 8 revokes. If it stops with "carries no
authorityCredentialId", the subject's `nationalId` attribute did not stick — do not film.

- **The wallet on the device must be built against THIS deployment.** The issuer directory
  is baked in at build time, one base per issuer, and `build-wallet.sh` with no `--issuer`
  falls back to `PUBLIC_URL` in the *local* `deploy/.env` — which on a workstation running
  its own stack is `http://localhost`. The build succeeds, the APK installs, and the
  directory is empty on the phone with no error anywhere. Always pass it:

  ```bash
  ./scripts/build-wallet.sh --issuer 'https://<host>/farmer,https://<host>/land'
  adb install -r vendor/paradym-wallet/apps/wallet/android/app/build/outputs/apk/release/app-release.apk
  ```

  The script now refuses a loopback url outright, so this fails loudly rather than shipping.
- **Clear every card in the wallet.** Part 3 opens on an empty wallet, and the old take
  showed "No cards yet".
- **Sign in as `farmer.film`** (password is the same `DEMO_CITIZEN_PASSWORD` as the other
  farmers, in `deploy/.env` on the host).
- **Use a fresh browser profile or a private window.** A live Keycloak session skips the
  sign-in page, which is the shot — that is what went wrong on the last take.
- **Keep the window geometry identical to the last take.** The crops and the callouts are
  measured against it: laptop capture 2918×1568, terminal window content below y=42, command
  text from x=10, browser content column x 870–2130 *including the URL bar*. Same screen
  resolution, same window size and position, same terminal font size, same browser zoom.
  If any of that changes, say so and the boxes get re-measured — it is not a re-shoot,
  just a measuring pass.
- **Cut before the screen recorder's floating controls appear.**

### The nine clips

The 22 September take replaced the browser with the **Farm Credit app**, and it is better:
the bank, the consent and the verdict all happen on one phone screen, so parts 3 and 4
stop cutting between a laptop and a handset. Nine clips instead of eleven — `step3` and
`step3.1` merge into one, and the old `step4` + `step4.1` pair becomes a single `step4`.

Phone clips are native 720x1600 and need no treatment. Laptop clips are 2918x1568 terminal
captures.

| # | File | Device | Target | What is on screen |
|---|---|---|---|---|
| 1 | `step3 & 3.1.mp4` | phone | ~55s | Unlock, **Get a card → Farmer Registry**, Authenticate, sign in as `farmer.film2`, store the card; then the same again at **Land Registry**. Ends on both cards in the list |
| 2 | `step4.mp4` | phone | ~29s | Farm Credit app → **Start farm credit check** → *Do you trust Gramin Bank?* → **Review the request** (PURPOSE reads *Applying for crop credit*) → PIN → Success → back to the app showing **ELIGIBLE** with crop, cultivated area and loan |
| 3 | `step5.mov` | laptop | ~6s | `show` then `suspend FRM-PB-0119`, ending on `lifecycle=SUSPENDED` |
| 4 | `step6.mp4` | phone | ~27s | Another check → consent → **REJECTED / UNABLE TO VERIFY**, reason reading **source record SUSPENDED** |
| 5 | `step7.1.mov` | laptop | ~6s | `reinstate FRM-PB-0119`. **The last line must read `lifecycle=ACTIVE`** |
| 6 | `step7.2.mp4` | phone | ~28s | Another check → **ELIGIBLE** again |
| 7 | `step8.mov` | laptop | ~7s | `authority_headers FARMER_OFFICER` and the revoke POST, ending on `HTTP 201` |
| 8 | `step8.1.mp4` | phone | ~25s | Another check → **REJECTED**, reason reading **own status REVOKED** |
| 9 | `step8.2.mov` | laptop | ~4s | `show FRM-PB-0119` → `lifecycle=ACTIVE`. The record is healthy and the credential is refused anyway |

**End every laptop clip on the frame that matters.** The assembly holds verdict and status
frames by cloning the *last* frame of a cut, so a take that runs a beat past its result
freezes on whatever came next. That shipped eight wrong holds on the 31 August film.

### Commands, in filming order

Paste the first block once, off camera. Parts 3 and 7 both need `$ENC`.

```bash
cd /home/rc/age-demo
CID='did:rcw:46e558a5-85ce-4b27-8525-7b021616a749'
ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$CID")
scripts/lifecycle-agriculture.sh show FRM-PB-0119     # expect lifecycle=ACTIVE
```

```bash
# --- clip 3 (step5.mov): suspend
scripts/lifecycle-agriculture.sh show    FRM-PB-0119
scripts/lifecycle-agriculture.sh suspend FRM-PB-0119

# --- clip 5 (step7.1.mov): reinstate.  Last line must read ACTIVE.
scripts/lifecycle-agriculture.sh reinstate FRM-PB-0119

# --- clip 7 (step8.mov): revoke, as an officer
ROOT=$PWD; BASE=http://localhost:3334; API="$BASE/api/v1"
. scripts/lib/authority-auth.sh
authority_headers FARMER_OFFICER
curl -s -X POST "$API/credentials/$ENC/revoke" "${AUTH_H[@]}" \
  -H 'content-type: application/json' -d '{"reason":"demonstration"}' -w '\nHTTP %{http_code}\n'

# --- clip 9 (step8.2.mov): and the record is untouched
scripts/lifecycle-agriculture.sh show FRM-PB-0119
```

### What the 22 September take got wrong

Kept here because each one cost a session.

| Clip | Fault |
|---|---|
| `step4`, `step7.2` | The verdict card read **"Cultivated area — undefined acres"**. The app read `disclosed.cultivatedAreaAcres`; the service has only ever emitted `cultivatedArea`. React renders `undefined` as the string rather than failing, so it reached camera. Fixed in `services/verifier-mobile/App.js`. |
| `step7.1` | Shows the **suspend** output again, not the reinstate — the clip ends on `lifecycle=SUSPENDED`. Check the last line before stopping. |
| `step8` | An iTerm2 popup — *"That's a gnarly JSON blob you've got there!"* — appears at 7.7s. Dismiss iTerm2's hints before filming, or stop the clip before it. |
| `step3 & 3.1` | The keyboard's suggestion strip offered `farmer.lakshmi` and `farmer.terminal.revoked` while the username was typed. Cosmetic, but it puts other fixtures on screen. Clear the keyboard's learned words. |

### Part 8 must be last

Revocation cannot be undone, and issuance is idempotent, so after part 8 `farmer.film`
holds a permanently revoked credential. Parts 3–7 cannot be re-shot with it. If a take
fails after part 8 has run, reserve another fixture rather than resetting the stack.

---

## What a viewer should be able to say afterwards

1. Two authorities, no shared database, and the correlation happened outside both.
2. The farmer held the credentials; the bank received a presentation, not a database query.
3. The same credential was accepted, refused, and accepted again — and only the *source*
   changed.
4. The refusal came from a live check against a public route, not from anything the
   credential itself said.

## What this film must not imply

- **Not that issuer deactivation propagates.** Credential status is live; issuer trust is
  read once at verifier startup. If the narration goes near trust configuration, say so —
  see [issuer trust is loaded at startup](../authority-service-integration.md#issuer-trust-is-loaded-at-startup-and-only-at-startup).
- **Not that these DIDs are permanent.** They are publicly resolvable *sandbox* DIDs, valid
  while the sandbox holds its address.
- **Not that any of it is real data.** Every farmer, parcel and identifier is synthetic.
