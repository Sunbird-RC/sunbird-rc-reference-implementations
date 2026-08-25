# Escalation — Iteration 01 Flow 1 cannot be built on released Sunbird RC v2.1.0

> **RESOLVED, 25 August 2026 — approved with controls.** See
> [`ANSWERS-01-age-from-anand.md`](ANSWERS-01-age-from-anand.md) answer 1, now also
> DESIGN decision 6. The capability is to live inside `oid4vc-service` (not the
> registry engine), be optional and configurable, leave pre-authorised issuance
> unchanged by default, carry regression coverage for both grants, stay narrowly
> scoped with pinned commit and image digest, be described as an upstream-aligned
> addition rather than a released `v2.1.0` feature, and be offered upstream.
> Unrelated changes from the older fork branch must not be included.
>
> Kept as the record of how the decision was reached.

**Raised by:** Kartheek / Claude Code
**Date:** 24 August 2026
**Branch:** `iteration/age-01-verification`
**Blocks:** Charter Flow 1 (authenticated wallet-driven issuance) — and therefore
Flows 2 and 3, which present the credential Flow 1 issues.

## Decision required

May we run **one** service — `oid4vc-service` — from a build of the Sunbird RC
fork instead of the pinned official `ghcr.io/sunbird-rc/...:v2.1.0` image, in
order to add OpenID4VCI `authorization_code` issuance with Keycloak as the
authorization server?

Everything else in the stack stays on official pinned digests.

## Why it is material

DESIGN §13 fixes the boundary as "baseline Sunbird RC `v2.1.0` and its native
`oid4vc-service`", and COMPATIBILITY records "Current baseline: no separate
adapter." The revised charter also requires that "a material compatibility or
architecture gap must be documented and brought to Anand before changing the
baseline."

Running a non-released build of a core service changes that baseline. It also
changes what "native Sunbird RC capability" means in the evidence pack, which is
a claim the showcase makes to its audience.

## Evidence — the gap, with file and line

Verified by reading the released source at tag `v2.1.0` (`2ade66c`), not inferred
from documentation. Flow 1 requires the wallet to authenticate against Keycloak
and then fetch the credential directly. Three separate things prevent that, all
hardcoded:

| # | Blocker | Location |
|---|---|---|
| 1 | Credential-issuer metadata advertises the service as its own authorization server: `authorization_servers: [this.config.publicUrl]`. There is no configuration that points a wallet at Keycloak. | `services/oid4vc-service/src/oid4vci/oid4vci.service.ts:129` |
| 2 | Its authorization-server metadata offers only `token_endpoint: <self>/oid4vc/token` with `grant_types_supported: ['urn:ietf:params:oauth:grant-type:pre-authorized_code']`; any other grant is rejected with `unsupported_grant_type`. | `token.service.ts:86-90`, `oid4vci.service.ts:341` |
| 3 | `POST /oid4vc/credential` accepts only tokens the service minted itself: the bearer is verified with `verifyJwt(token, this.issuerDid)` and rejected unless `payload.iss === this.config.publicUrl`. A Keycloak access token fails both checks. | `token.service.ts:58-79` |

Beyond the protocol, there is no path from an authenticated user to claims:
claims exist only inside an offer session created by `POST /oid4vc/offer` and
keyed by a pre-authorised code. Nothing resolves a token subject to a Sunbird RC
record at credential-issuance time — which is precisely what DESIGN's new
"Identity and Issuance Authorisation" section requires.

**No compatibility mode changes this.** `DRAFT13_COMPAT_MODE` alters metadata and
offer shapes only; it does not add a grant type, an authorization server, or
subject resolution.

## Options

### Option A — port the capability onto v2.1.0 in the fork (recommended)

The capability already exists in the fork's `oid4vc_issuer` branch:
"Keycloak-as-authorization-server, enabling wallet self-service issuance",
`authorization_code` + PKCE, `KEYCLOAK_SUBJECT_CLAIM`, `REGISTRY_SUBJECT_ENTITY`,
`REGISTRY_BIRTHDATE_FIELD` age derivation, and `token.service.keycloak.spec.ts`.
That branch is **24 commits behind the `v2.1.0` tag and 1 ahead** — it predates
the release and was never merged upstream.

So: branch from the `v2.1.0` tag, port those three edits, keep the release fixes,
build locally as `sunbird-rc-oid4vc-service:v2.1.0-authcode.<sha>`, and open an
upstream PR to `Sunbird-RC/sunbird-rc-core` as the removal path.

- **For:** one protocol implementation, inside the product's own codebase; an
  upstream-aligned fix rather than an adapter; small and reviewable; the work is
  already written; benefits Sunbird RC rather than only this demo.
- **Against:** one service is no longer an official release image until the PR
  lands. Must be recorded in the evidence pack and in every version table.

### Option B — a thin standards adapter in front of the credential endpoint

DESIGN §4 permits "a small stateless adapter … only if hands-on wallet
interoperability identifies a gap that cannot be addressed through the released
Sunbird RC compatibility modes or configuration". That condition is now met.

- **For:** every Sunbird RC image stays on its official pinned digest.
- **Against:** the adapter must mint `c_nonce`s from `oid4vc-service` and present
  itself as that service's public URL, because the wallet's proof-of-possession
  must carry `aud` equal to the credential endpoint's issuer identifier and a
  nonce `oid4vc-service` issued. That is a fragile audience-mismatch trap. It also
  leaves two OpenID4VCI implementations in the stack and contradicts
  COMPATIBILITY's "no separate adapter" baseline just as much as Option A
  contradicts the image pin — while being more code and more risk.

### Option C — run the `oid4vc_issuer` branch as-is

- **For:** no porting work.
- **Against:** silently drops 24 commits of post-branch release fixes, including
  the SD-JWT claim reconstruction that makes DCQL matching work in the accepted
  Flow 2. The version story would be indefensible at review.

### Option D — descope Flow 1 to pre-authorised issuance

- **For:** works on released v2.1.0 today.
- **Against:** contradicts the charter and DESIGN as just revised
  ("An issuance QR, issuer-counter page, or browser-based citizen selection is not
  permitted"). Not proposed; listed for completeness.

## Recommendation

**Option A.** It is the only route that keeps one protocol implementation, stays
inside Sunbird RC's own codebase, and leaves the showcase honestly describable —
"Sunbird RC plus a small upstream-aligned addition, submitted upstream" rather
than "Sunbird RC plus a bespoke adapter we maintain".

We would record it as a deviation in three places: the version table (image tag
carrying the source SHA), the deviation log, and the handoff.

## Status of the work (prepared, not adopted)

Option A has been **prepared** so the decision can be made against something
real rather than a proposal. Nothing is adopted: the stack still runs the
official `ghcr.io` image, and no phase downstream of this decision has started.

Fork: `sunbird-rc-core`, branch `oid4vc-keycloak-as-v2.1.0`, from the `v2.1.0` tag.
(Flat name, not `oid4vc/keycloak-as-...`: a branch named `oid4vc` already exists
in that fork, and Git cannot create a ref path beneath an existing ref.)

| Commit | What |
|---|---|
| `bc892456` | Keycloak-as-authorization-server issuance ported onto v2.1.0 |
| `1583b7bd` | `/vp/status` reports the presentation's signature algorithms |

Verified on the branch:

- `tsc --noEmit` clean.
- **11 suites / 127 tests pass**, including the release's own `oid4vp.service.spec.ts`
  — so the v2.1.0 SD-JWT and DCQL fixes this iteration depends on are intact —
  and the ported `oid4vci.self-service.spec.ts`, `claim-source.spec.ts` and
  `token.service.keycloak.spec.ts`.
- All three blockers resolved: `authorization_servers` now resolved from config,
  `/credential` accepts realm-verified Keycloak tokens, and claims resolve from
  the token subject to a registry record through a claim-source abstraction.

Deliberately **not** ported, to keep the change reviewable: tx_code/PIN
verification (the release refuses tx_code offers rather than ship a no-op check,
and `authorization_code` does not use it), the demo apps and portals that commit
also carried, and the old `OFFER_REQUIRES_STAFF` gate — v2.1.0's `ENABLE_AUTH`
guard supersedes it.

Taken from that branch because it is better: per-format credential signing
algorithm advertisement. The release advertises `Ed25519Signature2020` — a
Linked-Data suite — as an SD-JWT VC signing algorithm for every non-mdoc format,
which is not a value a JOSE wallet can act on.

Image built and smoke-tested, for evidence if adopted:
`sunbird-rc-oid4vc-service:v2.1.0-authcode.1583b7bd` (94.2 MB, `22cb55d3aae2`).

Runtime check on the built artifact — not just the test suite. A throwaway
container, configured with `KEYCLOAK_PUBLIC_URL` and `KEYCLOAK_REALM=age`, serves:

```json
"authorization_servers": [
  "http://keycloak.test/auth/realms/age",
  "http://localhost:3401"
]
```

The realm is advertised first and the service keeps itself second, so a wallet can
be pointed at Keycloak **without** breaking pre-authorised issuance — the accepted
Flow 2 path continues to work. Blocker 1 is therefore resolved in the artifact, not
only in code. The container was removed after the check; the running stack was
never touched.

## Impact if deferred

Flow 1 does not start, and Flows 2 and 3 cannot be demonstrated end to end on a
device, because they present the credential Flow 1 issues. Work that does not
depend on this decision continues meanwhile: the Keycloak realm and
citizen-mapping, the Inji compatibility spike, the mobile verifier app, and the
removal of the rejected issuer page (already done).

## Also for acknowledgement — the Age database deviation

Separate from the decision above, and listed because the review asked for it to be
recorded for acceptance.

DESIGN §7 specifies `age.*` schemas. The registry exposes only a JDBC URI
(`connectionInfo_uri`) and leaves table placement to Sqlg, which writes
unqualified vertex labels to `public`. Verified on this stack: with
`?currentSchema=age` the registry created `public.V_AgeCitizen` and left the `age`
schema empty. There is no supported setting for it.

The Age boundary is therefore a dedicated `age` **database** in the same
PostgreSQL deployment — stronger isolation than a schema, one deployment as DESIGN
requires, and Agriculture and Education get their own the same way.
`tests/e2e/data-isolation.test.mjs` asserts the boundary that actually exists.

Classified as an **engineering choice that preserves DESIGN §7's intent**, not a
material change. Flagged for acknowledgement rather than approval.
