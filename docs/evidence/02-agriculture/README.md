# Agriculture and rural-credit demo evidence

## Two films, and they show different things

| | Shows | Status |
|---|---|---|
| [**Authority-backed journey, 21 September**](Agriculture-Authority-Showcase-21Sep.mp4) | Two authorities, wallet-held credentials, a holder-bound presentation, **live public status**, and the same credential accepted → refused on source suspension → accepted on reinstatement → refused on revocation | Filmed and delivered · 5 min 45 s |
| [Rural credit showcase, 31 August](Agriculture-Rural-Credit-Showcase-31Aug.mp4) | Two registries, consented presentation, eligible / ineligible / mismatched outcomes | Filmed and delivered |

**The 31 August film predates the Authority Service.** There is no status check in it,
nothing is suspended, and its credentials are not linked to a lifecycle. It remains
accurate for what it covers — issuance, wallet storage, consented presentation and the
lending decision — and it is not superseded. It simply does not show the part this
iteration added: that a credential stops being accepted when its source is suspended, and
is accepted again when the source is reinstated.

The 21 September film was shot against the sandbox with Authority authentication on,
and every value on screen is live: the two issuer DIDs, the public status route
flipping to `SUSPENDED`, and the bank's own refusal text naming the reason. Its shot
script is [`AGRICULTURE-AUTHORITY-FILM.md`](../../showcase/AGRICULTURE-AUTHORITY-FILM.md).

## Written evidence

| File | What it records |
|---|---|
| [`AUTHENTICATED-JOURNEY.txt`](AUTHENTICATED-JOURNEY.txt) | The current package: Authority authentication on, refreshable service-to-service tokens, the public trust boundary tested from outside the service network, and the suite results |
| [`PUBLIC-DID-JOURNEY.txt`](PUBLIC-DID-JOURNEY.txt) | The earlier capture, proving issuance from authorities with publicly resolvable DIDs. Superseded by the above, which closes the two gaps it recorded as open |
| [`STATUS-JOURNEY.txt`](STATUS-JOURNEY.txt) | The six status outcomes — active, suspended, reinstated, inactivated, revoked, unlinked — captured against a localhost deployment |
| [`runs/e2e-sandbox-deployment.txt`](runs/e2e-sandbox-deployment.txt) | The clean run: full acceptance suite output against the deployment, with Authority authentication on — 162/162, 43 suites, 0 failures, 0 skipped |
| [`runs/public-gateway.txt`](runs/public-gateway.txt) | The public-gateway evidence from the same deployment at the same time: the two trust routes answering, and the administrative, issuance and revocation routes absent from that listener |

The last two are the pair to review together — one is what the deployment does, the other
is what it refuses to expose while doing it.

## One thing to be clear about when reading any of it

**Credential status is live; issuer trust is not.** A revoked credential or a suspended
source is caught on every presentation. Deactivating an *issuer* is configuration, read
once when the verifier starts, and does not reach a running verifier until it is
restarted. See
[issuer trust is loaded at startup](../../authority-service-integration.md#issuer-trust-is-loaded-at-startup-and-only-at-startup).

## Also

The [application guide](../../showcase/use-cases/agriculture-rural-credit.md), the
[Authority Service integration guide](../../authority-service-integration.md) and the
[testing guide](../../testing.md).

All data is synthetic.
