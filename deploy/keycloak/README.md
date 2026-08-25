# Keycloak realm for the Age demo

`realm-age.json` is imported at container start, so the stack comes up ready with
no manual clicking. The commentary lives here rather than in the JSON: Keycloak
rejects unknown fields outright, so a `_comment` key in the realm file fails the
import with `Unrecognized field "_comment"` and takes the whole container down.

## What the realm carries, and what it deliberately does not

**No passwords.** Anand's answer 3: *"Do not commit passwords or secrets.
Reproducible demo credentials may be supplied through local configuration or
generated during setup and shown to the demo operator."* So `scripts/bootstrap.sh`
generates one demo password, sets it on every citizen through the admin API,
prints it once, and records it in the gitignored `deploy/.env` so a re-run does not
silently change what the operator wrote down.

**The account-to-citizen mapping**, which is the part that must be deterministic
and reviewable:

| Account | Citizen record | Expected outcome |
|---|---|---|
| `citizen.meera` | `AGE-000001` (adult) | credential issued, later APPROVED |
| `citizen.arjun` | `AGE-000002` (minor) | credential issued, later DENIED |
| `citizen.nikhil` | `AGE-000003` (turns 18 today) | boundary fixture |
| `citizen.sana` | `AGE-000004` (turns 18 tomorrow) | boundary fixture |
| `citizen.unmapped` | *none* | authenticates, receives **no credential** |

The mapping travels as the `citizenId` **token claim**, delivered by the
`citizen-record` client scope, not as a username lookup. Usernames and emails
change and an unverified email is not an identity; the issuer resolves the claim
against the registry and nothing the wallet sends can override it.

`citizen.unmapped` exists on purpose — it is the negative case the charter
requires, and it can only be tested if such an account exists.

## The wallet client

`id.animo.paradym` is a public client with PKCE (S256). Both values come from the
wallet itself, not from preference: `clientId` is the app scheme and the redirect
URIs are what the wallet actually sends — see `apps/wallet/app.config.js` and
`apps/wallet/src/constants.ts` in the wallet repository, where `walletClient` reads
`allowedRedirectBaseUrls[0]`. Change them there and they must change here too.

## Why `/auth`

Keycloak runs with `--http-relative-path=/auth` so the login page, the issuer and
the verifier all share one origin behind nginx. That keeps the redirect URI stable
and avoids the classic failure where Keycloak builds absolute URLs from its own
container address and the wallet is sent somewhere it cannot reach.
