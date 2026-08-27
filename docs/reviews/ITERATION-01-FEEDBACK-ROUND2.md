# Iteration 01 — Age: showcase feedback, round two

**From:** Anand, 26 August 2026, after reviewing the narrated demo video
**Status of this document:** authoritative input, per `CLAUDE.md`
**Round one:** [`ITERATION-01-FEEDBACK.md`](ITERATION-01-FEEDBACK.md)

## What he accepted from the video

- Sunbird Wallet running on a real Android device
- National Identity Authority visible in the issuer directory
- Keycloak authentication using a synthetic citizen
- Direct wallet-driven issuance without an issuance QR
- Credential preview, approval and storage
- Same-device deep-link presentation from a mobile webpage
- Wallet confirmation before sharing
- Selective disclosure of `ageOver18`
- Successful verification resulting in **APPROVED**

## What he asked for additionally, and where each stands

Recorded verbatim, because the wording matters — particularly on item 5.

### 1. Cross-device verification

> Open the verifier website on a laptop, scan its QR using the wallet, consent
> and show **APPROVED** on the laptop.

**Not yet demonstrated.** This is the charter's Flow 2 (*Cross-Device Web
Verification by QR*): website on a laptop, wallet on the phone. A scan attempt on
26 August failed — the wallet never decoded the symbol, and no request reached
`/vp/request-object`.

Diagnosis and what changed: the payload is ~206 characters, which makes a 53×53
symbol, and it cannot be shortened by dropping `client_id` (COMPATIBILITY finding
9). So the lever is module size: the verifier page gained an **Enlarge for
scanning** mode that renders the QR at up to 92vw on white and hides the
surrounding chrome. Awaiting a scan attempt.

### 2. Ineligible citizen

> Use a valid minor's credential and show a verified **DENIED** result—not a
> technical failure.

**Proven at the protocol level, not yet on the device.** `citizen.arjun`
(AGE-000002, born 2012-08-30) receives a genuine credential asserting
`ageOver18: false`; the verifier reaches DENIED with all seven checks passing, so
it is a verified refusal rather than a fault. Covered by `scripts/demo.sh` case 2
and by the e2e suite. The device run needs that credential issued into the wallet
first.

### 3. Cancellation

> Decline a presentation request and show that no information is shared and no
> approval is produced.

**Done.** This required a change: the verifier could not tell a decline from
silence, and rendered both as red **NOT VERIFIED** — a failure label for a system
doing exactly what the holder asked. It now recognises a refusal
(`core/checks.mjs`) and returns `state: 'declined'`; the web page and the mobile
app render `declined` and `expired` as a neutral **NO DATA SHARED** with "nothing
was disclosed and no approval was produced". Verified end to end against the
deployment, and covered by a new e2e test.

### 4. Credential persistence

> Close and reopen the wallet, unlock it and show that the issued credential
> remains available.

**No code needed.** Rehearsal item; the wallet holds two cards from yesterday's
issuance and survives lock/reopen.

### 5. Installed mobile verifier

> Demonstrate the separately installed mobile verifier app invoking the wallet
> through a deep link and displaying the result after verification. The mobile
> webpage shown in the current video proves deep-link compatibility but does not
> replace the installed verifier app.

**Done, on the device.** `services/verifier-mobile` — an installed Android app
(`id.sunbird.ageverifier`, "Age Check"), on the **same phone** as the wallet,
which is what the charter's Flow 3 (*Same-Device Mobile Verification by Deep
Link*) specifies. "Separately installed" means a distinct application rather than
a web page; it does not mean a separate device — that is item 1.

Run on a Samsung SM-A055F, 27 August 2026: the app created a session, handed it
to the wallet over `openid4vp://`, the holder consented, and the app displayed
**APPROVED** with the issuer, `ageOver18 = true` and all seven verification
checks. Session `cdb0b101` in the verifier service records the same.

The app is deliberately thin, because the charter requires the mobile UI to
display results and not make cryptographic decisions: two HTTP calls to the
shared verifier service and a render. `verify.sh` asserts both that it calls the
service and that it contains no verification code, and the gateway enforces it
independently — `/vp/*` is refused on the public listener.

### 6. Remove the negative-test credential from the customer-facing directory

> Only the valid National Identity Authority Age credential should appear during
> the showcase.

**Done.** Issuer metadata is built from every published schema with no filter, and
offer creation reads the same set, so the fixture could not simply be
unpublished. `bootstrap.sh` no longer creates it; the tests that need it
provision it (`ensureNegativeFixture`) and retire it afterwards, and `demo.sh`
does the same. A clean stack advertises exactly one credential, asserted by
`verify.sh`.

## His framing, which we have followed

> The repository can carry the detailed tests, security evidence, implementation
> notes and known limitations. The live demonstration should remain simple and
> customer-focused:
>
> **Authenticate → Receive credential → Consent → Share only age status → Verify
> → APPROVED or DENIED.**

> If the installed mobile verifier is not ready, please identify that journey
> clearly as incomplete rather than substituting the mobile webpage.

The installed verifier is ready, so no such disclaimer is needed. The one journey
still unproven is item 1, cross-device scanning, and it is reported as such.

## Device constraints found while proving item 5

Three, all in the wallet or in Android rather than in this stack, and all
affecting how any verifier can invoke the wallet:

| Wallet state when the request is sent | Outcome |
|---|---|
| Backgrounded (warm) | request delivered and shown — **the sequence to use** |
| Foreground | Android re-surfaces the wallet's task without delivering the intent |
| Force-stopped (cold) | the wallet loses the destination through its own PIN gate and lands on its home screen |

The third is a bug in the wallet fork: on a cold start `+native-intent.tsx`
returns the presentation route directly instead of wrapping it in
`/authenticate?redirectAfterUnlock=…`, so the unlock screen forgets where it was
going. Warm starts take the wrapped path and work. Recorded rather than worked
around in our code, because the fix belongs in the wallet.
