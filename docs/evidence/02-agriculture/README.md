# Iteration 02 — Agriculture / rural credit: evidence

## The demonstration video

**[`Agriculture-Rural-Credit-Showcase-31Aug.mp4`](Agriculture-Rural-Credit-Showcase-31Aug.mp4)**
— 4 min 43 s, 720×1600, H.264 + AAC 48 kHz stereo, −16.1 LUFS, 13.7 MB.

Filmed on the deployment at `https://135.235.192.9.sslip.io` on 31 August 2026,
on a Samsung SM-A055F (Android 15). Recorded on the real applications: the
vendored wallet, the mock bank page, and the installed Farm Credit app. Nothing
in it is scripted or simulated.

`sha256 6a4ab9faba66302f2def66da83039a6bc9975b0c13200638642150437d0bfa79`

| Part | What it demonstrates | `DEMO.md` |
|---|---|---|
| 1 | A new wallet, and an issuer directory offering **only** the Farmer Registry and the Land Registry | §1, quality gate |
| 2 | **"Do you trust Farmer Registry?"** with a Trusted-organization badge; sign-in at the registry's own page; the card's contents before storing | §1 |
| 3 | Swiped out of recents, cold start, the card still there naming its issuer; then **"Do you trust Land Registry?"** and `ownershipStatus ACTIVE` | §2, §3 |
| 4 | The bank's page and published policy on a laptop, the phone's camera on its code, **"Do you trust Gramin Bank?"**, six values consented, then the laptop showing **ELIGIBLE** with the calculation | §4, §5 |
| 5 | The installed Farm Credit app asking the wallet directly — same bank, now *Last interaction: Today* | — |
| 6 | `farmer.suresh`: land **INACTIVE** → **NOT ELIGIBLE**, every cryptographic check still green | §6 |
| 7 | The farmer stops; the bank reports **NO DATA SHARED — the holder declined the request** | §6 |

Two farmers, both synthetic:

| Account | Farmer id | Land | Outcome |
|---|---|---|---|
| `farmer.ravi` | FRM-KA-0041 | paddy on 4 of 6.5 acres, ACTIVE | **ELIGIBLE** ₹1,20,000 |
| `farmer.suresh` | FRM-KA-0058 | paddy on 3 acres, INACTIVE | **NOT ELIGIBLE** |

### Not shown, and why

**`REJECTED / UNABLE TO VERIFY` is absent from the video.** It needs a mismatched,
tampered or untrusted credential, and an honest wallet will not build one, so it
is not producible from a phone. It is covered by the automated suite instead —
`tests/e2e/agriculture.test.mjs` exercises tampering, the wrong issuer, a
`farmerId` mismatch and cross-holder binding. It must not be presented as a
device outcome.

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
