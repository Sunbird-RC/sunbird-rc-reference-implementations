# Authority Service integration

The reference applications in this repository write to Sunbird RC directly. This document
describes an alternative arrangement, in which an **Authority Service** sits in front of
Sunbird RC as a multi-tenant, configuration-driven issuance layer, and the application no
longer reaches the Registry at all.

It is written for adopters deciding whether that arrangement suits them, and for anyone
adapting it to a different domain. The Agriculture application is used throughout as the
worked example because it is the one with two independent authorities and a genuine
correlation problem.

## Why introduce a service in front of the Registry

Sunbird RC gives you a registry and a credential chain. What it does not give you is an
answer to a set of questions that appear as soon as more than one organisation issues
credentials from the same deployment:

- Which organisation owns this record, and who may read or amend it?
- Who is allowed to bring a record into force, as distinct from entering it?
- What does a verifier learn about an issuer, without learning anything about the deployment?
- When a record is suspended, what happens to credentials already issued from it?

Answering those inside each application means every application re-implements tenancy,
role separation and status. The Authority Service answers them once, and applications
become consumers of a managed write path.

The trade is real and worth stating plainly: you gain isolation, separation of duties and a
public trust surface, and you take on a service to operate, a configuration model to learn,
and a closed claim-mapping vocabulary that will not express everything you might want.

## Reusable architecture

The split that makes this work is between generic credential processing and domain
knowledge. In this repository that split already exists on the verifier side:

```
services/verifier/src/
  core/          domain-neutral: DCQL, trust, checks, algorithms, sessions, OID4VC client
  domains/
    agriculture/ the eligibility rule, the crop policy, money formatting
    ...
```

`core/` answers protocol and trust questions. `domains/` answers business questions. A new
domain adds a directory under `domains/` and configuration; it does not touch `core/`.

The Authority Service extends the same principle to the write path. It knows about tenants,
authorities, registry bindings, issuers, credential profiles and claim mappings. It knows
nothing about farmers, parcels, learners or lending. Domain meaning lives in the entity
schemas you register with Sunbird RC and in the claim mappings you configure — not in
service code.

What stays in the application:

- Entity schemas (`registry-schemas/`)
- The eligibility or decision rule
- Published policy the decision depends on (`config/policy/`)
- Which credentials a journey requests, and which claims within them
- The relying-party user interface

What moves to the Authority Service:

- Record creation, amendment, submission, approval and lifecycle
- Tenant ownership and role enforcement
- Issuer and signing-key configuration
- Claim mapping from registry fields to credential claims
- Issuance, revocation and public status

## Deployment topology

The arrangement rests on one property: **Sunbird RC is not publicly reachable.** If an
application can bypass the Authority Service and write to the Registry directly, none of the
tenancy guarantees hold, because they are enforced in the service rather than in RC.

```
            public                      managed
   ┌──────────────────────┐   ┌──────────────────────────────────┐
   │ wallet               │   │                                  │
   │ relying party (bank) │   │  Sunbird RC registry             │
   │ verifier             │   │  identity / credential-schema /  │
   └──────────┬───────────┘   │  credentials services            │
              │               └───────────────┬──────────────────┘
              │ public trust routes           │ private network only
              │ (unauthenticated)             │
   ┌──────────▼───────────────────────────────▼──────────────────┐
   │ Authority Service                                           │
   │   /api/v1/trust/...            public, unauthenticated      │
   │   /api/v1/...                  authenticated, not public    │
   └─────────────────────────────────────────────────────────────┘
```

Two exposure rules follow:

- **The administrative API is authenticated but not public.** In the Compose arrangement here
  it binds to loopback only; in Kubernetes the equivalent is a ClusterIP service with a
  network policy and no ingress route.
- **The trust routes are public and unauthenticated by design**, because a verifier has no
  credentials to present. They are rate-limited and expose only verification material.

### Two authorities, one service

Agriculture needs two organisations that must not read each other's records, yet whose
credentials must be correlatable by a third party:

```
Farmer Authority                    Land Authority
  tenant   T-AGRI-FARMER              tenant   T-AGRI-LAND
  binding  FarmerRecord                binding  LandRecord
  issuer   ISS-FARMER                  issuer   ISS-LAND
  profile  P-FARMER                    profile  P-LAND
```

Neither tenant can reach the other's binding or records. Correlation happens **outside both**,
in the relying party, from claims in two credentials presented together — which is the point.
Correlation must not require either authority to have access to the other's registry.

A cross-tenant request is answered exactly as a request from a complete stranger is:
`404`, with an identical body. A `403` would be an existence oracle — it would confirm that
the binding is real and merely out of reach, which over enough requests maps the other
tenant.

## Integrating an application

### 1. Record writes move behind the service

A seeding or onboarding script stops posting to `$REGISTRY/EntityName` and instead:

```
POST /api/v1/registries/{bindingId}/records          create  (OPERATOR)
POST /api/v1/registries/{bindingId}/records/{osid}/submit    (OPERATOR)
POST /api/v1/registries/{bindingId}/records/{osid}/approve   (AUTHORISED_OFFICER)
```

The service assigns the owning tenant; the caller does not choose it. Two consequences worth
planning for:

- **Records now have a state.** A record is `DRAFT` until submitted and `APPROVED` before it
  has a lifecycle at all. Only an approved record can be suspended, which is what makes
  status demonstrable.
- **Separation of duties is enforced, not advisory.** An `OPERATOR` may create and submit but
  not approve. Seeding therefore needs two identities, and they must be different ones —
  granting a single account both roles configures the separation away while appearing to
  satisfy it.

Lifecycle transitions are a separate call:

```
POST /api/v1/registries/{bindingId}/records/{osid}/lifecycle
     { "state": "SUSPENDED" | "ACTIVE" | "INACTIVE", "reason": "..." }
```

`SUSPENDED` is reversible. `INACTIVE` is terminal and the service refuses to move out of it.

### 2. Trust resolution replaces a DID in a config file

The reference applications carry a version-controlled allowlist of issuer DIDs, expanded from
environment variables that a bootstrap script writes. The allowlist does not disappear — it
changes from *"this DID is trusted"* to *"this Authority Service issuer is trusted, resolve
it"*:

```jsonc
{
  "issuers": [
    { "name": "Farmer Registry", "authorityIssuer": "<issuer id>", "roles": ["farmer"] },
    { "name": "National Identity Authority", "did": "${AGE_ISSUER_DID}" }
  ]
}
```

Both forms coexist, which matters when only some issuers move behind the service.

`GET /api/v1/trust/issuers/{issuerId}` returns the issuer DID, a display name and resolvable
verification methods, and nothing else:

```json
{
  "issuer": "did:web:farmer-authority.example",
  "name": { "en": "Farmer Authority" },
  "verificationMethods": [
    { "id": "key-0", "type": "IDENTITY_SERVICE_DID", "algorithm": "Ed25519",
      "reference": "did:web:farmer-authority.example" }
  ]
}
```

No tenant, no authority relationship, no internal service address, no KMS reference, and no
database identifier. A KMS-held key is deliberately omitted from the response: a KMS URI is
private by nature and a verifier could not resolve it anyway.

Two things the integrating application must get right:

- **Keep the role constraints local.** Being resolvable is not being trusted *for a slot*.
  Without a role per issuer, a Farmer credential can satisfy a Land requirement — both
  signatures are valid and both issuers are listed. Resolution should change where a DID comes
  from and nothing else.
- **Fail closed at startup.** An issuer that cannot be resolved should stop the verifier
  starting. A verifier that drops an unreachable issuer and carries on will reject that
  issuer's credentials as untrusted, which presents as a credential fault a long way from the
  cause.

Resolution happens **once, at startup**. This buys authoritative keys and display names that
can change without a configuration edit; it does not make the allowlist dynamic, and
deactivating an issuer does not reach a running verifier. See
[issuer trust is loaded at startup](#issuer-trust-is-loaded-at-startup-and-only-at-startup).

### 3. Two credentials, and they are not the same credential

This is the part most likely to be misread, so it is worth stating before the mechanism.

| | |
| --- | --- |
| **Authority credential** | the authoritative status and provenance anchor |
| **Wallet credential** | the holder-bound presentation credential |

The Authority Service issues a JSON-LD credential when a record is approved. It never leaves
the Authority, no wallet holds it, and no verifier sees it. It is what
`GET /trust/credentials/{id}/status` answers about, and it is the thing whose standing can
change after issuance.

The wallet holds an SD-JWT, issued through OpenID4VCI and bound to a key the wallet
generated. That is what a holder presents and what a verifier checks signatures on.

Neither replaces the other. The wallet credential proves who is presenting; the Authority
credential is what its current standing is a statement about. Treating them as one thing
leads to two mistakes in opposite directions: expecting a wallet to hold something a
verifier can ask an Authority to re-evaluate, or assuming a signature that verified once
means the record behind it is still good.

They are tied together by a single claim. The OID4VC issuer asks the Authority Service to
issue, server to server, and carries the resulting identifier into the SD-JWT as
`authorityCredentialId` — technical linkage, not a business claim, and deliberately not part
of any domain vocabulary. It comes only from the Authority's response: the claim source is
the one component in the issuance path that talks to the Authority, and it is called with a
subject read from a validated token, so nothing a wallet, holder or caller sends can reach
or override it. A linkage a caller could influence would let a credential nominate its own
status anchor, which is the same as having no status check at all.

Issuance is idempotent on the profile, the record and the subject, so a wallet that retries
gets the same anchor rather than minting a second one. That is what keeps the linkage one to
one, and auditable in both directions.

### 4. Credential status becomes a real check

Sunbird RC's OID4VP verifier proves a signature is valid. It does not answer whether the
issuer is one you accept, nor whether the credential is still good — its `revocation` check
reports OK without consulting anything, which is worse than no check because it reads like
one.

`GET /api/v1/trust/credentials/{credentialId}/status` gives a verifier a public answer derived
from both the issuance state and the source record's lifecycle:

| Source record | Credential | Reported |
| --- | --- | --- |
| any | revoked | `REVOKED` |
| `INACTIVE` | issued | `INACTIVE` |
| `SUSPENDED` | issued | `SUSPENDED` |
| `ACTIVE` | issued | `ACTIVE` |

Revocation is checked before the record is consulted, so reinstating a record cannot
resurrect a revoked credential. Suspension is reversible in both directions: suspending the
source changes what a verifier is told, and reinstating it changes it back, without the
credential itself being reissued or revoked.

This is the mechanism that makes "the underlying record was suspended" visible to a relying
party that has no access to the record — and it is why the managed-registry boundary and the
public status route are two halves of one design.

### 5. Claim mapping is a closed vocabulary

A credential claim is produced in one of three ways, and the set does not grow at
configuration time:

| Source | Produces |
| --- | --- |
| `DIRECT` | a copy of a registry field, at a dotted path |
| `CONSTANT` | a fixed value, independent of the record |
| `DERIVED` | one of a small number of named derivations |

There is deliberately no expression language, no arithmetic and no way to combine fields. The
derivations available are narrow on purpose — for example, one asserts that a field is present
without disclosing its value, and one asserts an age threshold from a date of birth without
disclosing the date.

This is the constraint most likely to bite when adapting the pattern. If your credential needs
a value the registry does not hold in that form, the options are to store it in the registry,
to add a named derivation to the service, or to compute it in the relying party — and the
third weakens the guarantee, because the value is then asserted by the verifier rather than by
the issuer.

### 6. Correlation across authorities

Two credentials from organisations that have never heard of each other can only be correlated
if they carry a common handle. A **bare local identifier will not do**: two jurisdictions may
legitimately both hold record `FRM-0041`, and a credential carrying the bare value would
present them as the same subject.

Record uniqueness is therefore scoped to the tenant — no global registry index, no
platform-wide identifier — and the credential carries a canonical reference that is
unambiguous by construction:

```
{authorityBase}#{resourceType}/{jurisdiction}/{localIdentifier}
did:web:farmer-authority.example#farmer/KA/FRM-0041
```

The authority base and resource type are configuration; the jurisdiction and local identifier
are read from the record and percent-encoded. A record cannot influence which authority it
claims to belong to, and a value containing a separator cannot restructure the reference.

The critical configuration detail: the credential from the *second* authority must carry the
reference in the **first** authority's namespace. A Land credential that qualifies the farmer
reference with the Land Authority's own namespace will produce a well-formed reference that
silently fails to match — nothing errors, and the two credentials simply stop correlating.

> This derivation is in review and is **not present in the currently published service
> image**. Until it is, credential profiles that need a canonical reference cannot be
> completed. Nothing else described in this document depends on it.

## Adapting this to another domain

1. **Define entity schemas** for Sunbird RC, one per record type. Keep each domain's records
   in their own entities; do not introduce a shared cross-domain person table.
2. **Decide the tenancy shape.** One authority per organisation that must not read another's
   records. Each authority is primary for its own tenant.
3. **Configure the topology** — tenants, authorities, registry bindings, issuers and signing
   keys, credential profiles — through the administrative API. Reference bindings and issuers
   by a stable code in your own scripts, not by generated identifier, so a rebuilt environment
   does not require edits.
4. **Register a JSON-LD context** with an absolute IRI for every issued claim, and set the
   profile's `contextUris` to it. See [`contexts/agriculture/README.md`](../contexts/agriculture/README.md)
   for the namespace-versus-document distinction, which is easy to get wrong and expensive to
   correct after issuance.
5. **Configure claim mappings**, keeping the credential's claim names independent of registry
   field names. Request the minimum a decision needs, and nothing more.
6. **Point the verifier's trust policy** at the service for the issuers that moved, keeping
   role constraints local.
7. **Add the status check** to your verification path, before any business rule runs.
8. **Seed with synthetic data** through the service, including at least one case that fails,
   because "fails safely" cannot be demonstrated without it.

### Configuration details that are easy to get wrong

- **Unique fields must name fields that exist.** Uniqueness is claimed only for fields a record
  actually carries, so a misspelled name silently claims nothing for every record and the
  constraint quietly does not exist. Check that a duplicate is refused rather than assuming it
  would be.
- **Issuer DIDs and key references are published verbatim.** The service filters its own
  internal detail out of the trust response, but it cannot judge whether a DID it was *given*
  is publicly resolvable. A DID minted from an in-cluster service address is both a disclosure
  of internal topology and useless to an external verifier.
- **Records reach search indexes asynchronously.** A record created a moment ago is really
  there and really not findable yet. Poll to a bound rather than sleeping for a fixed period,
  which encodes an idle machine's timing and then reports load instead of behaviour.

## What is on by default

Status checking is the **default** for the Agriculture journey, not an option. A lender
deciding on a credential whose source may since have been suspended is the failure this
arrangement exists to remove, and a check that ships off by default is a check most
deployments never turn on.

Two consequences follow, and both are deliberate:

- A credential carrying no linkage identifier is **refused**, not waved through. "Nothing to
  check" is unknown standing, not good standing. A credential minted outside the Authority
  issuance path — for example through an unauthenticated offer endpoint with caller-supplied
  claims — cannot fund a decision, however well-formed it is.
- The identifier is requested, and therefore disclosed, only in journeys that check status.
  A journey that does not need it does not ask for it, and the holder does not send it.

**Authentication is the other default.** `ENABLE_AUTH` defaults to *on* in the committed
compose file, and `ENABLE_AUTH=false` is a local-development escape hatch that belongs in a
developer's shell rather than in a file a demo host inherits. `BOOTSTRAP_ADMINS` is empty by
default, which disables root tenant creation rather than granting it to anyone. The
administrative API is published on `127.0.0.1` and is served by no public listener.

## Bringing it up, in order

The services are not independent at boot, and two of them deliberately refuse to start
rather than start wrongly. On a stack reset the order therefore matters:

1. `docker compose up -d` — the platform comes up. **The verifier and the issuer will be
   unhealthy at this point, and that is correct.** The verifier resolves its trusted
   issuers from the Authority Service at boot and refuses to start when it cannot; after a
   reset, the trust policy still names the issuer identifiers of the deployment that was
   just destroyed.
2. `scripts/bootstrap.sh` — mints the `did:web` identifiers and registers the credential
   schemas.
3. `scripts/bootstrap-authority-realm.sh` — reads the realm's generated client secrets and
   service account subjects into `deploy/.env`, and composes `BOOTSTRAP_ADMINS`.
4. Recreate `authority-service`. It reads `BOOTSTRAP_ADMINS` and the OIDC settings **at
   start**, so until it is recreated it will reject the bootstrap principal.
5. `scripts/bootstrap-agriculture-authority.sh` — creates the tenants, authorities,
   bindings, issuers, memberships, schemas and profiles, and writes the resulting wiring
   back to `deploy/.env` and to the verifier's trust policy.
6. Seed, then recreate `oid4vc-farmer`, `oid4vc-land` and `verifier` so they read it.

**Do not wait for a fully healthy stack between 1 and 2.** The verifier cannot become
healthy until step 5 has run, so waiting for it first is waiting for the thing the
bootstrap is a prerequisite of. This is a deadlock a setup script falls into naturally, and
the symptom — a crash-looping verifier reporting `HTTP 404` for an issuer identifier —
looks like a broken Authority rather than an ordering problem.

`scripts/bootstrap.sh` handles its own half of this: before recreating the verifier it
checks whether the selected trust policy names issuers the Authority actually publishes,
and falls back to the default policy for that boot if not, saying so. It does not edit
`deploy/.env` — the Agriculture bootstrap rewrites the policy with live identifiers and
recreates the verifier again at step 6. Without that check the bootstrap fails at its last
step and blames the verifier.

## Authenticating to the service

Every route except the two public trust routes requires an OAuth2 bearer token. The service
reduces a token to `(iss, sub)` and looks that pair up in its own `TenantMembership` table:
**roles come from the service's database, not from the token.** No provider-specific claim is
read, so Keycloak is the reference IdP rather than a dependency.

### Machine principals belong in their own realm

The reference deployment adds a fourth Keycloak realm, `authority`, containing no people. An
issuing service placed in a citizen realm would present the same `iss` as a citizen's login,
and the only thing between a citizen's token and an administrative route would be that no
membership row happens to match its subject. A separate realm makes the separation
structural instead of incidental.

Its clients are one per principal — a bootstrap administrator, an operator and an issuing
officer per Authority — because separation of duties that shares a credential is not
separation of duties.

### The subject cannot be written down in advance

For a client-credentials token, `sub` is the service account's generated id. Memberships
therefore cannot be seeded from a configuration file that names readable subjects: such a row
looks correct and matches nothing, and every call then authenticates successfully and is
refused for lack of a role. `scripts/bootstrap-authority-realm.sh` reads each client's
service account id and secret from Keycloak and writes them to `deploy/.env`; the Agriculture
bootstrap creates memberships for those subjects.

### Pin the realm's issuer

Keycloak derives `iss` from the request it received, so the same credentials yield an
internal issuer for a service on the container network and a public one for a script coming
through the gateway. The service compares `iss` against a single configured value, so one of
those callers is always rejected — reported only as `Invalid token`. The `authority` realm
therefore pins `attributes.frontendUrl`. This is safe only because no browser visits that
realm.

### Hold credentials, not a token

An issuing service configured with a static bearer token stops issuing once that token
expires, and fails with a `401` that reads like a permissions problem rather than an expiry.
Nothing restarts and nothing alarms. The issuer is instead given a client id and secret and
exchanges them whenever its token nears expiry, renewing early because two containers' clocks
are not identical, and retrying once on a `401` so a revocation or clock skew is a retry
rather than a failed issuance for a holder who is waiting.

The reference realm issues **60-second** tokens deliberately: shorter than a full journey
run, so the acceptance suite cannot pass unless renewal genuinely works.

## Issuer trust is loaded at startup, and only at startup

**The verifier resolves its trusted issuers once, at boot, and never re-reads them while
running. Deactivating an issuer in the Authority Service does not reach a running verifier.
It is not revocation and must not be described as propagating.**

This is deliberate rather than unfinished. The verifier resolves trust *before* it opens
its port, and exits non-zero if it cannot:

```
[verifier] refusing to start: Authority Service did not publish issuer "Land Registry" (…): HTTP 404
```

A verifier that opened its port first and resolved afterwards would accept presentations
during the gap with no allowlist and answer them. There is no useful degraded state here —
every decision branch refuses everything without an allowlist — so failing to start is the
safe outcome.

### What this means operationally

| Change | Reaches a running verifier? |
|---|---|
| Credential revoked, or its source record suspended / inactivated | **Yes, immediately.** Status is checked live, per presentation. |
| Issuer deactivated in the Authority Service | **No.** Requires a verifier restart. |
| Issuer key rotated | **No.** Requires a verifier restart. |
| Issuer added or removed from the trust policy file | **No.** Requires a verifier restart. |

The distinction matters: **credential status is live, issuer trust is not.** The first row
is what the Agriculture journey demonstrates and is checked on every presentation. The rest
are configuration, and configuration is read at boot.

### Refreshing a verifier after an issuer change

There is no reload endpoint and no signal handler. Restart the container:

```bash
# local
docker compose -f deploy/docker-compose.yml up -d --force-recreate --no-deps verifier

# a deployment with TLS enabled — include the overlay, or nginx reverts to plain HTTP
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.tls.yml   up -d --force-recreate --no-deps verifier
```

Then confirm what it actually loaded, rather than assuming the restart worked:

```bash
docker logs sunbird-rc-age-verifier-1 2>&1 | tail -1
# [verifier] listening on 4300; trusting 6 issuer(s); …
```

Two failure modes worth knowing before you restart:

- **If the issuer you deactivated is still named in the trust policy, the verifier will
  refuse to start.** That is the fail-closed behaviour above, and it will take the verifier
  down rather than bring it back with a smaller allowlist. Remove the issuer from the
  policy in the same change, not afterwards.
- **A restart is a gap in service, not a hot reload.** Presentations in flight fail. For a
  deployment where that matters, run more than one verifier and restart them in turn; this
  reference deployment runs one.

If you need deactivation to take effect without a restart, that is a change to the
verifier — re-resolving trust on an interval, or on a signal — and it is not in this
iteration.

## The public boundary

Two routes must answer without authentication, because a verifier holding a credential has no
tenant and no membership:

| Route | Answers |
|---|---|
| `GET /trust/issuers/{issuerId}` | the issuer DID, a sanitised display name, verification methods |
| `GET /trust/credentials/{credentialId}/status` | `ACTIVE`, `SUSPENDED`, `INACTIVE` or `REVOKED`, and when that took effect |

Neither exposes a tenant or Authority relationship, a profile, a record, an internal hostname
or a KMS reference. The status route is not an existence oracle either: a credential this
Authority did not issue gets the same answer as one it did.

**The risk in publishing them is not those two routes — it is the third one nobody meant to
publish.** The gateway therefore matches a single anchored regular expression admitting only
those two shapes, and there is deliberately no `location /api/v1/` anywhere in it: one prefix
line would expose tenants, records, profiles, issuance and revocation at once. The
administrative API is published on `127.0.0.1` and is reachable through no public listener.

`tests/e2e/authority-gateway-boundary.test.mjs` asserts both halves — that the trust routes
answer and that the administrative, issuance and revocation routes do not exist through the
same listener, including under path traversal. A `401` from those routes would itself be a
failure: it would mean the gateway forwarded the request and only the service refused it.

## Limitations

Architectural and operational limits of the arrangement as described here:

- **Tokens are held per issuing service, not per holder.** The issuer authenticates as itself
  and is entitled to issue for its tenant; a compromised issuing service can issue within that
  tenant. This is the same blast radius as the issuing key it already holds.
- **Trust resolution happens at startup**, and only at startup — see
  [Issuer trust is loaded at startup](#issuer-trust-is-loaded-at-startup-and-only-at-startup)
  for what that does and does not reach, and how an operator refreshes a verifier.
  Credential status is live; issuer trust is not.
- **Issuers are resolved by generated identifier.** The public trust route is keyed by the
  issuer's identifier, so that identifier still has to reach the verifier's configuration. This
  trades copying a DID for copying an identifier; the gain is that the DID, display name and
  keys become authoritative and can change without a configuration edit, not that configuration
  distribution disappears.
- **A record's unique-field configuration is fixed once set**, and the uniqueness check fails
  open rather than closed if it names a field that does not exist.
- **Holder binding is not performed at issuance.** Issuance binds a credential to a record, not
  to a holder key. In these applications the binding that matters is minted by the wallet and
  proven in the OpenID4VP exchange, which is what lets a relying party know one party holds
  both credentials. If you replace the wallet, that property is yours to preserve.
- **Claim mapping will not express everything.** The closed vocabulary is a deliberate limit,
  not an unfinished feature; expect to extend the service rather than the configuration when
  you hit it.
- **A context URI that stops resolving breaks verification everywhere**, including for
  credentials already issued. Substituting a namespace after release is a new vocabulary, not a
  configuration change.
- **All data here is synthetic**, and the policies are simplified reference patterns rather
  than sector recommendations. Production governance, key custody, recovery, status operations,
  audit and regulatory controls remain adopter responsibilities — as set out in
  [`technical-profile.md`](technical-profile.md).

## Service image

The Authority Service is published as a multi-architecture container image
(`linux/amd64`, `linux/arm64`) and should be **pinned by digest rather than by tag**: a tag can
be moved, and a deployment would then run something other than what was reviewed.

It is currently published under the fork owner's container registry namespace, pending an
official one. Deployments should treat the digest recorded in their own configuration as the
authoritative reference.
