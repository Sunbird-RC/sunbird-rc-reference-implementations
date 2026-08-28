# Iteration 02 — material decision: the wallet

**Raised by:** Kartheek, 28 August 2026
**Status:** **Approved by Anand, 28 August 2026** — Iteration 02 proceeds on the
wallet already forked into this repository. Kartheek confirmed the decision with
him before implementation began.
**Affects:** `PRODUCT.md` (Product acceptance), `REQUIREMENTS.md` §11, `DESIGN.md` §3, §10, §13.5

## Decision required

Iteration 02 uses the **wallet already vendored in this repository**
(`vendor/paradym-wallet`, the Credo-based build accepted in Iteration 01) rather
than Inji Wallet.

## Why it is material

Three approved documents name Inji explicitly, so this is not an implementation
detail:

- `PRODUCT.md`: "Inji Wallet is an explicit Product requirement for this
  iteration… Replacing Inji or materially changing the journey requires Anand's
  decision."
- `DESIGN.md` §10: "Paradym or another wallet must not be substituted for Inji
  without Anand's explicit approval."
- `DESIGN.md` §3: "The customized Age wallet is not the Agriculture wallet
  baseline."

It also touches a standing Product commitment beyond this iteration: Inji is
required to complete **at least one** full use case. That commitment is deferred,
not cancelled, and Education (Iteration 03) is where it would land.

## Evidence and constraint

The mandatory Inji handshake could not be started, for a reason that is a fact
about this repository rather than a judgement:

**There is no pinned Inji build.** `docs/design/COMPATIBILITY.md:19` records
Inji Mobile `v0.22.1` as *"(to be pinned at the spike)"*. The spike never ran,
because Inji moved out of Age. No Inji checkout or APK exists on the build
machine.

Three risks were already recorded against an Inji-based Agriculture, and the
compatibility document explicitly defers them to this iteration:

1. **The credential-request nonce.** Inji builds its proof of possession with the
   nonce from the **token response** (`shared/openId4VCI/Utils.ts`:
   `nonce: decodedToken.c_nonce`) and calls no nonce endpoint. With Keycloak as
   the authorization server the token response is Keycloak's and carries no
   `c_nonce`, so the proof goes out without one and issuance fails. Age escaped
   this because Credo fetches from `nonce_endpoint`. Working around it means
   making the issuer the authorization server and redirecting to Keycloak — an
   arrangement Anand's answer 4 permits, but a different one from
   `REQUIREMENTS.md` §11.2 read literally.
2. **Protocol profile against Age regression.** The deployment runs
   `DRAFT13_COMPAT_MODE=false` because the Credo-based wallet requires final
   OpenID4VCI 1.0. Inji is draft-13-oriented. Serving both from one deployment,
   while Age regression stays green, is unproven.
3. **The issuer directory is not in the app.** Inji takes its issuer list from
   **mimoto**, its backend service. "Only Farmer Registry and Land Registry
   appear" therefore requires standing up and configuring mimoto, which is a
   component this showcase does not otherwise run.

Against that, the vendored wallet is proven on this stack: OpenID4VCI
`authorization_code` with Keycloak as the authorization server, `nonce_endpoint`,
`vc+sd-jwt` with `cnf.jwk` holder binding, OpenID4VP over `direct_post` with a
signed request object, and DCQL — with `buildDcqlQuery` already written to accept
several credential requests, which is what a two-credential presentation needs.

## Options and trade-offs

| Option | Cost | Risk |
|---|---|---|
| **A. Use the vendored wallet** (chosen) | None beyond configuration: two trusted issuer entries and the issuer directory | Deviates from three approved documents. Defers the Inji commitment to Iteration 03 |
| B. Pin and obtain an Inji build, then run the handshake | Unknown; needs an APK we do not have, plus mimoto | All three risks above are live, and any failure returns to Anand anyway — after the cost |
| C. Build Inji from source with mimoto | Days. Inji needs its own backend; the Iteration 01 wallet build alone cost hours of native compilation | Same three risks, plus a build we would then own |

## Recommended option

**A**, on the grounds that it is the only option that can produce a working
Agriculture demonstration without first resolving an unpinned dependency, and
that every Agriculture-specific capability the iteration is actually about —
two independent issuers, two credentials in one wallet, multi-credential
presentation, Farmer ID correlation, and the crop-based decision — is
demonstrated identically by either wallet.

What this iteration therefore does **not** prove: that Inji interoperates with
this stack. That must not be implied anywhere in the evidence or the demo.

## Impact if deferred

Agriculture cannot start. The handshake is the gate, and the gate cannot run
against a build that does not exist.

## Consequences to carry forward

1. Inji still owes at least one full use case (`PRODUCT.md`, Iteration 03).
2. The three recorded Inji risks remain open and are **not** closed by this
   iteration. They stay in `COMPATIBILITY.md` for whoever runs the Inji spike.
3. One wallet build now serves two iterations, so "only the Farmer Registry and
   Land Registry appear in the Agriculture issuer directory"
   (`REQUIREMENTS.md` §3) has to be read per use case rather than per app — the
   Age issuer remains configured in the same wallet. How that is presented in the
   demo is recorded with the implementation.
