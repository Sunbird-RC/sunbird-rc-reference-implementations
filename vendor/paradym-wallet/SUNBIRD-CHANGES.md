# The Paradym Wallet, vendored for the Sunbird RC Age showcase

This directory is a copy of [`animo/paradym-wallet`](https://github.com/animo/paradym-wallet)
at commit `2d68168`, taken from the fork `pallakartheekreddy/paradym-wallet`
(branch `v1.0.3`), plus seven commits of showcase changes. Apache-2.0; see
[LICENSE](LICENSE) and [NOTICE](NOTICE).

It is here because the showcase depends on changes inside the wallet, and a
reviewer of `iteration/age-01-verification` could not see them while the code
lived in a sibling checkout.

## What we changed, and what we did not

The first commit under this path is the **unmodified upstream tree**. Every commit
after it is a modification, replayed with its original author and date, so the
boundary is visible in the history rather than only described here:

```bash
git log --oneline -- vendor/paradym-wallet          # the base, then seven changes
git log -p -- vendor/paradym-wallet                 # the changes themselves
```

The vendored tree at the seventh commit is **byte-identical to the fork** — the
importer asserts it by comparing git tree hashes, not by inspection:

```
fork      cbe9407^{tree}  = c26e413c5625918b768ffe10865d9f3298615f46
vendored  HEAD:vendor/…   = c26e413c5625918b768ffe10865d9f3298615f46
```

| # | Source commit | Author | Date | Scope |
|---|---|---|---|---|
| 1 | `9283309` Wallet update as per Sunbird RC | Sachchida Nand Tiwari | 3 Aug 2026 | 16 files, +591/−3. The Sunbird RC repoint: the issuer directory screen (`features/issuers/`), an onboarding step that asks for a name, and the first theme changes |
| 2 | `0e087ea` Match wallet design with spark | Sachchida Nand Tiwari | 3 Aug 2026 | 32 files, +347/−172. Sunbird Spark design system across `packages/ui` — buttons, headings, cards, badges, fonts, shadows |
| 3 | `06394bd` Wallet design change | Sachchida Nand Tiwari | 4 Aug 2026 | 28 files, +941/−277. The rest of the theming, plus the nine locale catalogues that the new copy required |
| 4 | `262e0a3` feat(wallet): make the OAuth redirect targets build-time configurable | Kartheek Palla | 26 Aug 2026 | `apps/wallet/app.config.js`. `WALLET_REDIRECT_BASE_URLS` — empty falls back to the app scheme, which needs no App Link verification, and so works against a demo host whose `assetlinks.json` cannot list a locally signed certificate |
| 5 | `ac45de4` fix(trust): a bare `did:` client_id could never match a trusted entity | Kartheek Palla | 27 Aug 2026 | `packages/sdk/src/trust/handlers/did.ts`. An upstream defect: the OpenID4VP trust lookup compared the client id against a `decentralized_identifier:`-prefixed string, so a verifier using the bare `did:web:` form of OpenID4VP before draft 26 could never match any configured entity. Now normalises and prefix-matches, as the OpenID4VCI path in the same file already did |
| 6 | `7b5cae9` feat(wallet): recognise the Sunbird RC Age showcase issuer and verifier | Kartheek Palla | 27 Aug 2026 | `apps/wallet/src/constants.ts`. The showcase's issuer and age-restricted service as trusted entities, both `demo: true` |
| 7 | `cbe9407` feat(openid4vc): tell the verifier when the holder declines | Kartheek Palla | 27 Aug 2026 | `packages/sdk/src/openid4vc/func/declineCredentialRequest.ts`. Declining was purely local, so a verifier could not tell a refusal from a request the holder ignored. Now posts an OpenID4VP Authorization Error Response (`error=access_denied`) for `direct_post` |
| 8 | *(this repository)* remove Animo's release identity | Kartheek Palla | 27 Aug 2026 | Not from the fork — made when the code was vendored, so it sits **after** the tree-hash proof above rather than inside it. See below |

**Commits 5 and 7 are upstream-shaped fixes**, not showcase-specific glue. Both are
worth reporting upstream, and both are recorded with a removal path in
[`../../docs/design/COMPATIBILITY.md`](../../docs/design/COMPATIBILITY.md)
(findings 12 and 13): if upstream adopts them, our copies are deleted rather than
maintained.

### The 72 modified files, grouped

- **Protocol-level (4 files)** — `packages/sdk/src/trust/handlers/did.ts`,
  `packages/sdk/src/openid4vc/func/declineCredentialRequest.ts`,
  `apps/wallet/src/constants.ts`, `apps/wallet/app.config.js`. These are what the
  showcase actually depends on.
- **Design and theming (27 files)** — `packages/ui/src/**`,
  `packages/app/src/components/**`, `apps/wallet/tamagui.config.ts`,
  `apps/wallet/src/config/{copy,paradym,themes}.ts`.
- **Features and screens (12 files)** — `apps/wallet/src/features/issuers/**`,
  `apps/wallet/src/features/onboarding/**`, `apps/wallet/src/hooks/useDeviceUserName.ts`,
  the wallet and activity screens.
- **Locales (20 files)** — nine catalogues plus two AI instruction files.
- **Build and deps (5 files)** — `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
  `apps/wallet/package.json`, `packages/sdk/package.json`, `.gitignore`.
- **Docs, SDK surface (4 files)** — `docs/sunbird-oid4vc-integration-analysis.md`,
  `packages/sdk/src/index.ts`, `packages/sdk/src/display/credential.ts`,
  `packages/sdk/src/openid4vc/allowInsecureUrls.ts`.

## Building it

Use [`../../scripts/build-wallet.sh`](../../scripts/build-wallet.sh), which turns
every trap below into an assertion instead of a paragraph you have to remember.

```bash
cd vendor/paradym-wallet && corepack pnpm install --frozen-lockfile
cd ../.. && ./scripts/build-wallet.sh
```

Four things are load-bearing, and none of them fails with a message that names
the cause:

| Variable | Why |
|---|---|
| `JAVA_HOME` on a JDK **17 exactly** | `@react-native/gradle-plugin` declares `jvmToolchain(17)`. On 21 or 23, Gradle tries to provision a 17 toolchain through the `foojay-resolver` 0.5.0 it pins, which touches an API removed in Gradle 9 — configuration then dies with `JvmVendorSpec … IBM_SEMERU` |
| `ANDROID_HOME` | `expo prebuild` does not write `android/local.properties` |
| `APP_VARIANT=preview` | Decides the package name. Omit it and the namespace becomes `id.paradym.wallet` while the generated autolinking sources still reference `id.paradym.wallet.preview`, so the build fails in `javac` with "package does not exist" |
| `CREDENTIAL_ISSUER_URLS` | Empty hides the issuer directory entirely, which is the screen the demo opens on |

Also: this is a **pnpm** workspace inside an **npm** repository. The root
`package.json` lists its workspaces explicitly, so `npm install` at the repo root
does not walk in here. The local pnpm launcher on the build machine is broken (it
tries to switch to pnpm 11.7.0 and fails), so use `corepack pnpm`, and run `tsc`
and `biome` from `./node_modules/.bin/` directly.

The lockfile is load-bearing beyond the usual: several dependencies are pinned to
dated prereleases (`@credo-ts/*@0.7.1-alpha-20260707121432` and similar), which are
reproducible only while those alphas remain on the registry.

## Taking a later upstream change

The sibling `../paradym-wallet` checkout is no longer where the wallet is built —
it is only the sync workspace, because it holds the `upstream` remote and the
43 MB of upstream history this repository deliberately does not import. Nothing
here resolves a path into it: the build and every check operate on this directory
unconditionally, and only the importer accepts `--source`.

```bash
# in the sibling: fetch upstream, then rebase the seven commits onto the new point
git fetch upstream && git rebase upstream/main

# in this repository, on a branch:
./scripts/vendor-wallet.sh --base <new-upstream-sha> --tip <new-fork-tip>
```

That produces the same shape again — pristine base, then the replayed changes — so
the at-a-glance boundary survives every sync instead of degrading into a pile of
merges. If the sibling is ever gone, apply the upstream change here as an ordinary
commit and add a row to the table above.

**Explicit non-goal:** no submodule, no `git subtree`, and upstream history is
never merged into this repository. Please do not "fix" that.

## Animo's release identity, removed

One deliberate divergence from upstream, in the eighth commit. The fork carried
the credentials of Animo's *release channel* — not secrets, but enough that
someone running `eas build` here would be building and submitting against another
organisation's Expo project and App Store listing:

| Removed | Was |
|---|---|
| `apps/wallet/app.config.js` | EAS `projectId b5f457fa-…`, Animo's Expo project |
| `apps/wallet/base.app.config.js` | `owner: 'animo-id'`, the Expo account |
| `apps/wallet/eas.json` | the `submit` block: `companyName "Animo Solutions"`, `ascAppId 6449846111` |
| `apps/wallet/app.config.js` | `98.70.36.106.sslip.io`, a dead demo host still registered as an App Link domain and as the default OAuth redirect |

None of it is needed: the showcase builds locally with `expo prebuild` and Gradle,
and passes `WALLET_REDIRECT_BASE_URLS=""` so the redirect default is unused. The
`@animo-id/*` npm dependencies are untouched — those are packages, not identity.

## Things that look like ours and are not

Kept verbatim from upstream, because deleting them would create a diff that is not
a change we made. None of it runs here:

- **`.github/workflows/`** names Animo's organisation secrets and publishes
  `@paradym/wallet-sdk` to npm. GitHub only reads the *root* `.github`, so these
  are inert in this repository — but do not run them.
- **`CLAUDE.md` and `.claude/`** are Animo's agent instructions and skills. A
  nested `CLAUDE.md` is loaded when working on files under this directory; it is
  upstream's guidance for upstream's project, and it does not govern this
  repository. The showcase's own rules are in the root `CLAUDE.md`.
- **`apps/wallet/.env.development`** holds one `EXPO_PUBLIC_*` variable pointing at
  an Animo-operated service endpoint. Client-visible by design, not a secret.
- **`apps/wallet/.maestro/`** end-to-end fixtures use a synthetic persona whose
  email address looks real. Upstream's fixture, unused here.
