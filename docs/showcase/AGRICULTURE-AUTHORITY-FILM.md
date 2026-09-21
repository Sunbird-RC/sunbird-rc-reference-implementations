# Agriculture, Authority-backed — film production script

The 31 August film shows two registries and a consented presentation. **It predates the
Authority Service**: there is no status check in it, nothing is suspended, and the
credentials in it are not linked to a lifecycle. This film is the one that shows the part
that iteration added — that the same credential stops working when its source does.

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

Reset the two lifecycle fixtures to ACTIVE before a take, or the suspension beat has
nothing to suspend:

```bash
scripts/lifecycle-agriculture.sh show     FRM-PB-0117
scripts/lifecycle-agriculture.sh reinstate FRM-PB-0117   # if it is SUSPENDED
```

**Fixtures.** Synthetic throughout. Sign-in password is in `deploy/.env` on the host and
is not recorded here.

| Role | Account | National id | Record |
|---|---|---|---|
| The farmer the film follows | `farmer.lakshmi` | NAT-90023815 | FRM-PB-0117 |
| Inactivation case (terminal) | `farmer.terminal.inactive` | NAT-90077001 | FRM-KA-0901 |
| Revocation case (terminal) | `farmer.terminal.revoked` | NAT-90077002 | FRM-KA-0902 |

Use `farmer.lakshmi`, not `farmer.ravi`: Ravi is the canonical eligible farmer the rest of
the suite depends on, and this film changes its subject's record.

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
scripts/lifecycle-agriculture.sh suspend FRM-PB-0117
scripts/lifecycle-agriculture.sh show    FRM-PB-0117    # SUSPENDED
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
scripts/lifecycle-agriculture.sh reinstate FRM-PB-0117
```

Present the same credential once more. Accepted, and a loan offered again — no reissue, no
new credential, nothing done in the wallet.

### 8 — A terminal refusal  *(~35s, include if it fits cleanly)*

Anand asked for a revoked or inactive refusal if it reads clearly. **Prefer inactivation**
— it is the easier one to show, because the record's state is visible:

```bash
scripts/lifecycle-agriculture.sh inactivate FRM-KA-0901   # farmer.terminal.inactive
```

Present as `farmer.terminal.inactive`: refused, and it stays refused. Unlike suspension
this cannot be undone — the Authority refuses INACTIVE → ACTIVE — which is exactly the
distinction worth stating on camera.

**Do not use `farmer.lakshmi` for this shot.** Inactivation is terminal and would spend the
fixture the rest of the suite uses.

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
