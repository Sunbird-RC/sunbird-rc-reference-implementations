# Rebuilding `oid4vc-service` from shared source

Everything needed to reconstruct the exact image this showcase runs, from source
anyone can fetch, and to check that what you built is what we ran.

The image is `sunbird-rc-oid4vc-service:v2.1.0-authcode.c8beec27`. Its tag suffix
is the source commit it was built from — patch `0007` below.

## Why patches and not a branch

The working checkout these commits were authored in has exactly one remote,
`https://github.com/Sunbird-RC/sunbird-rc-core.git` — **upstream Sunbird RC
itself, not a fork under this project's control.** Pushing the branch there would
put showcase commits into the upstream project, and merging it would alter the
released `v2.1.0` baseline this programme treats as a controlled input. Neither is
ours to do, and Kartheek confirmed on 2 September 2026 that it must not be merged
to `v2.1.0`.

So the commits travel as patches on this branch instead — the alternative Anand's
review offered. They are not a summary or a rewrite: applying them to the upstream
tag reproduces the authored tree exactly, which the check at the bottom proves.

## Licence

These patches are derivative work of `Sunbird-RC/sunbird-rc-core`, which is
**MIT** licensed ("Copyright (c) 2018 Project Sunbird"). They are offered under
the same MIT terms, with this repository's own copyright holder — see the root
[`LICENSE`](../../LICENSE):

> Copyright (c) 2026 International Institute of Information Technology,
> Bangalore (IIITB), on behalf of the Centre for Open Source Software (COSS)

Same licence as upstream, so the patches can be merged without a licence
change; upstream's own copyright notice stays intact in every file the patches
touch.

## The shared base

| | |
|---|---|
| Repository | `https://github.com/Sunbird-RC/sunbird-rc-core.git` |
| Tag | `v2.1.0` |
| Commit | `2ade66c24afc2d5da7d05121e9cbbd082ba83cd1` |

That commit is reachable from `origin/main` upstream, so it needs nothing from us.

## The seven patches

Applied in order. Every one touches only `services/oid4vc-service/`; together they
are 25 files, +3960 / −42.

| # | Commit | What it does |
|---|---|---|
| 0001 | `bc892456` | Keycloak-as-authorization-server issuance — the port itself |
| 0002 | `1583b7bd` | reports presentation signature algorithms in `/vp/status`, so an algorithm allowlist can be enforced at all (finding 15) |
| 0003 | `ab9be928` | narrows the port to the controls Anand approved |
| 0004 | `4889fbdb` | publishes the issuer's own display metadata |
| 0005 | `9caf3c2b` | `ADVERTISE_OWN_CREDENTIALS_ONLY` — an issuer advertises only what it authored (finding 14) |
| **0006** | **`1147b904`** | **refuses another issuer's credential type, and refuses an unrequested disclosure** — review items 2 and 4 (findings 16, 17) |
| **0007** | **`c8beec27`** | **fixes the wiring that made the disclosure check inert on the keyed `vp_token` path** — the path every SD-JWT presentation here takes |

The two in bold are the ones the Education review asked for. The five before them
are the pre-existing port, unchanged by this review, and are included because the
image cannot be built without them.

## Rebuilding it

```bash
git clone https://github.com/Sunbird-RC/sunbird-rc-core.git
cd sunbird-rc-core
git checkout -b oid4vc-keycloak-as-v2.1.0 v2.1.0
git am /path/to/this-repo/patches/oid4vc-service/000*.patch

# The tag suffix is the source commit, so derive it rather than typing it.
SHA="$(git rev-parse --short=8 HEAD)"        # expect c8beec27

docker build --platform linux/amd64 \
  -t "sunbird-rc-oid4vc-service:v2.1.0-authcode.${SHA}" \
  -f services/oid4vc-service/Dockerfile \
  services/oid4vc-service
```

**`--platform linux/amd64` is not optional.** The demo host is amd64, and an
arm64 build made on an Apple-silicon machine is refused at container-create time
with *"image with reference … was found but does not provide the specified
platform (linux/amd64)"* — after the old containers have already been recreated,
so the stack is left down. The fork's own `Makefile` defaults `PLATFORM` to
`linux/amd64` for the same reason.

Then point the deployment at it:

```bash
# deploy/docker-compose.yml pins this tag in all nine oid4vc-* services
grep -c 'v2.1.0-authcode.c8beec27' deploy/docker-compose.yml     # expect 9
cd deploy && docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

## Running the service's own tests

```bash
cd services/oid4vc-service && npm ci && npx jest
```

**154 tests, 15 suites, 0 failures** — captured verbatim at
[`../../docs/evidence/03-education/runs/test-fork.txt`](../../docs/evidence/03-education/runs/test-fork.txt).
The two review fixes are covered by `src/oid4vci/own-credentials-issuance.spec.ts`
(7) and `src/oid4vp/unrequested-disclosure.spec.ts` (11).

## Checking you got the same source we did

The patches reproduce the authored **tree** exactly. Compare the tree, not the
commit id — `git am` records a new committer and date, so the commit hashes will
differ from ours even though the content is identical:

```bash
git rev-parse HEAD^{tree}   # 561448f3104acb668bc801a7f51cc391b1962c1b
                            # the tree the image was built from
git rev-parse HEAD          # WILL DIFFER from c8beec27 — see below
```

`c8beec279cfa63fd98eefdf04a063eb9040f4a9f` is the commit id in the authoring
checkout, and it is what the image tag names. A fresh `git am` of this series
produces the same tree under a different commit id, because a commit hashes its
committer identity and timestamps as well as its content. An earlier version of
this file told you to expect `c8beec27` from `git rev-parse HEAD`, which is only
true if you happen to reproduce the committer too.

Verified on 2 September 2026 by applying this series to a pristine `v2.1.0`
worktree and comparing `HEAD^{tree}` against the authoring checkout's branch tip:
**identical.** `scripts/verify.sh` re-checks the cheap half of this on every run —
that the series is present, that its length matches, and that patch `0007`'s
commit is the one `deploy/docker-compose.yml` pins.

## Authorship, here versus in the upstream pull request

These patch files preserve authorship as committed: `0001`–`0005` carry
`palla.kartheekreddy@gmail.com`, `0006`–`0007` carry `kartheek@sanketika.in`.
They are left as they were because the image tag and the whole evidence chain are
pinned to this exact series.

The **upstream pull request** unifies all seven to the work address, since commit
metadata contributed to Sunbird RC becomes permanent public record. Same content,
same trees, one identity. Nothing else about the commits changes except the
subject of `0003`, which named an individual reviewer and now reads "narrow the
port to the approved controls".

## If a patch ever stops applying

It means the upstream tag moved or a patch was edited. Regenerate rather than
hand-repair:

```bash
git format-patch --no-signature -o patches/oid4vc-service v2.1.0..oid4vc-keycloak-as-v2.1.0
```

Do **not** add `--zero-commit`: it blanks the `From <sha>` line, and that line is
the only thing tying a patch file back to the commit the image tag names.
