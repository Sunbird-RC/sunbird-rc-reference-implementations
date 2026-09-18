# Agriculture JSON-LD context

`v1/context.jsonld` defines the seven claim terms and two credential types the
Agriculture credentials carry. Both credential profiles point `contextUris` at it and
leave `claimVocabulary` unset, which is the path the Authority Service supports.

## Two different URIs, and why they are not the same thing

The namespace baked into every credential is **not** the address the document happens to be
served from.

| | |
| --- | --- |
| Vocabulary namespace | `https://w3id.org/sunbird-rc/agriculture/v1#` |
| Context document | `https://w3id.org/sunbird-rc/agriculture/v1` |

Term IRIs are identity. `farmerReference` expands to the namespace IRI above, and that
expansion is what a verifier compares and what a signature covers. If the namespace differed
per environment, a credential issued in development would mean something different from one
issued in production while looking identical, and neither would match the other. So the
namespace is fixed here.

A consequence worth stating plainly: **a context URI that stops resolving breaks verification
everywhere**, including for credentials already issued. Substituting a namespace after
release is not a configuration change, it is a new vocabulary.

### Why w3id.org

A W3ID identifier is a permanent redirect the project controls, so the redirect target can
move — initially to this fork, later to the official Sunbird RC repository — **without
changing the identifier**, and therefore without invalidating anything already issued. That
is the whole reason to spend an indirection on it.

An earlier draft used `https://sunbirdrc.dev/contexts/agriculture/v1#`. It was rejected on
review: that URL resolves to a generic HTML landing page, not a context document, so it
looked operational while serving nothing a JSON-LD processor could use.

### Current state

> The W3ID redirect is **not yet registered**. Until it resolves to the immutable `v1`
> context, development may load an identical copy from the deployment's own HTTPS origin.
>
> Credentials issued that way are **disposable development fixtures**. They cannot be used
> as interoperability evidence, and acceptance or externally shared credentials must not be
> issued until the permanent URI resolves and the expansion tests pass against it.

## Fixed decisions

- **JSON-LD 1.1, `@protected: true`, no `@vocab`.** Protection is what stops a second
  context in the array from re-pointing a term after release; the absence of `@vocab` is
  what stops an unmapped claim from being mapped by accident instead of refused.
- **Immutable after release.** A change in meaning is `v2/`, a new directory and a new
  namespace. Editing `v1` in place invalidates credentials already issued against it.
- **Units live in the term, not the value.** `cultivatedArea` is acres, fixed by the
  definition of the IRI. That is why the claim is no longer named `cultivatedAreaAcres`:
  the unit is a property of the vocabulary, not something a credential restates.
- **`registrationStatus` is a boolean**, carried over from `registeredFarmer`. The
  rename was agreed as naming only, so the type did not change with it. It reads like a
  string and is not one — the awkwardness is deliberate rather than overlooked.

## What safe mode actually does

It drops what it cannot map, it does not refuse it. A credential with a misspelled or
unmapped claim will sign and verify while carrying less than it appears to, and the loss
surfaces at a verifier rather than at the issuer. `tests/unit/agriculture-context.test.mjs`
therefore asserts against expanded output, including a negative case proving `nationalId`
cannot enter the credential even if something upstream tries to put it there.

Run it with `npm run test:unit`.
