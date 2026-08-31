# Iteration 02 — Agriculture / rural credit: evidence

## The demonstration video

**[`Agriculture-Rural-Credit-Showcase-31Aug.mp4`](Agriculture-Rural-Credit-Showcase-31Aug.mp4)**
— 5 min 22 s, 720×1600, H.264 + AAC 48 kHz stereo, −16.0 LUFS, 15.2 MB.
Eight parts, covering **all four outcomes**.

Filmed on the deployment at `https://135.235.192.9.sslip.io` on 31 August 2026,
on a Samsung SM-A055F (Android 15). Recorded on the real applications: the
vendored wallet, the mock bank page, and the installed Farm Credit app. Nothing
in it is scripted or simulated.

`sha256 39664246b8456ef82a5ced004137f8541f2895011b890b04d898f7d2d44905a5`

| Part | What it demonstrates | `DEMO.md` |
|---|---|---|
| 1 | A new wallet, and an issuer directory offering **only** the Farmer Registry and the Land Registry | §1, quality gate |
| 2 | **"Do you trust Farmer Registry?"** with a Trusted-organization badge; sign-in at the registry's own page; the card's contents before storing | §1 |
| 3 | Swiped out of recents, cold start, the card still there naming its issuer; then **"Do you trust Land Registry?"** and `ownershipStatus ACTIVE` | §2, §3 |
| 4 | The bank's page and published policy on a laptop, the phone's camera on its code, **"Do you trust Gramin Bank?"**, six values consented, then the laptop showing **ELIGIBLE** with the calculation | §4, §5 |
| 5 | The installed Farm Credit app asking the wallet directly — same bank, now *Last interaction: Today* | — |
| 6 | `farmer.suresh`: land **INACTIVE** → **NOT ELIGIBLE**, every cryptographic check still green | §6 |
| 7 | Ravi's farmer card beside **Lakshmi's** land card. Each farmer id is magnified from the recording, then the two are shown together — `FRM-KA-0041 ≠ FRM-PB-0117` — before `REJECTED / UNABLE TO VERIFY`, "the two credentials name different farmers", every check still green | §6 |
| 8 | The farmer stops; the bank reports **NO DATA SHARED — the holder declined the request** | §6 |

Parts 7 and 8 were added after Anand's review, which asked for a mismatched,
untrusted, tampered or wrong-holder combination shown as
`REJECTED / UNABLE TO VERIFY`. The outcomes now follow `DEMO.md` §6's order —
NOT ELIGIBLE, then REJECTED, then NO DATA SHARED — so the holder's own refusal
closes the film.

Two farmers, both synthetic:

| Account | Farmer id | Land | Outcome |
|---|---|---|---|
| `farmer.ravi` | FRM-KA-0041 | paddy on 4 of 6.5 acres, ACTIVE | **ELIGIBLE** ₹1,20,000 |
| `farmer.suresh` | FRM-KA-0058 | paddy on 3 acres, INACTIVE | **NOT ELIGIBLE** |

### The fourth outcome, on the device

**Corrected after Anand's feedback.** An earlier version of this file said
`REJECTED / UNABLE TO VERIFY` was not producible from a phone. That was wrong: it
generalised from "an honest wallet will not forge a credential" to "no rejection
is possible", and missed the case Anand names first — a mismatched
**combination**.

It is producible, with nothing tampered with and nothing pre-authorised:

1. Collect the **Farmer** card signing in as `farmer.ravi`.
2. Clear the agriculture realm's SSO session, or the second issuance silently
   reuses the first farmer.
3. Collect the **Land** card signing in as `farmer.lakshmi`.
4. Apply for credit.

Both cards are genuinely issued through `authorization_code`, each signed by its
own registry, both bound to the one holder key in that wallet. Only `farmerId`
disagrees. That is a farmer combining their own farmer card with somebody else's
land record — precisely the fraud the correlation check exists to stop.

Filmed on the SM-A055F on 31 August 2026 and cut in as **part 7**. The bank
reports:

```text
UNABLE TO VERIFY
REJECTED / UNABLE TO VERIFY
the two credentials name different farmers
holderSignature ✓  nonce ✓  audience ✓  credentialSignatures ✓
holderBinding ✓  revocation ✓  dcql ✓
```

Every cryptographic check passes, and there is no decision and no loan figure.
That is the point worth narrating: nothing was forged, and the bank still refused
— because it refused the **combination**, not either card. It is also visibly
distinct from `NOT ELIGIBLE`, which means the claims were trusted and the answer
was no.

**How the part is cut, and why.** The first cut of it did not read, even though
both ids were on screen: each is one small grey row among six technical fields,
they are ten seconds apart, and between them sits six seconds of on-screen
keyboard. A viewer cannot hold the first id in memory across that. The part now
magnifies each id from the recording and then shows the two together, captioned
with which card each came from, so the mismatch is demonstrated rather than
asserted by the verdict text.

`tests/e2e/flow2-agriculture-issuance.test.mjs` pins the same journey through the
real issuance protocol, and `tests/e2e/agriculture.test.mjs` additionally covers
tampering, the wrong issuer and cross-holder binding — those three remain
suite-only, because an honest wallet cannot produce them.

**One limitation is narrated, not hidden.** The wallet's review screen reports
that no reason was given for the request. That is accurate: the issuer build
sends no `client_metadata`, so there is no purpose string to display. The
narration names it rather than talking over it.

### How it was built, and how it was checked

Sources, cut list, narration config and the verification record are outside this
repository, beside the raw takes, under
`RC_video/New_Flow/Agri_Demo/` — `build-body.py` (every cut point with its
reason), `agri-demo.yaml` (every narration cue), `build-final.sh`, and `NOTES.md`.

Verified on the finished file, not from build logs: a frame was extracted at
**every one of the 36 narration cues** and read against its line. That check
caught eleven defects that would otherwise have shipped — eight held frames
frozen on the wrong screen (two of them on the screen recorder's own controls),
three frozen mid-fade, and two lines describing a screen that had already gone.
`NOTES.md` lists each one.

Structure confirmed: `ftyp moov free mdat` (faststart), −16.1 LUFS integrated,
LRA 5.5, final 1.4 s true silence, closing line peaking at −3.2 dB.

## Still to come

- The line-by-line acceptance table against `REQUIREMENTS.md` and `DEMO.md`.
- Captured test and verification runs, as `docs/evidence/01-age/runs/` holds for
  Iteration 01.
