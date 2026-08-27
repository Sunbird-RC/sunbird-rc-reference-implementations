# Questions for Anand — Iteration 01 revised scope

**From:** Kartheek
**Date:** 25 August 2026
**About:** the Iteration 01 review feedback and the revised Age charter

The three journeys you have described are clear, and we are not asking you to
restate them. What we need are decisions on points the review leaves open. Each
one below changes either what we build or what we bring to the demo, so it is
cheaper to settle now than to discover at the next review — which is the lesson
your retrospective drew.

We have deliberately not proposed answers here. Where we have a view, we would
rather give it in the discussion than anchor yours in writing.

---

## 1. The released product cannot do wallet-driven issuance. How should we proceed?

The required issuance journey has the wallet start and finish the process itself:
the citizen signs in, picks the issuer, and the credential arrives. The released
version of Sunbird RC we are told to build on does not support that. It supports
only the other style of issuance, where something outside the wallet — a portal, a
counter, a QR code — creates the credential offer first and the wallet merely
picks it up. There is no setting or compatibility mode that changes this; the
capability is simply absent from the released version.

So the journey you require and the version we are required to use are, today,
incompatible.

**Question:** how would you like us to proceed? This is the one decision that
blocks all three journeys, because the other two present the credential this one
issues.

*(A separate note has been prepared with the technical detail, the options we can
see, and their trade-offs, for whenever you want it.)*

---

## 2. How is the wallet supposed to know which issuers exist?

Your step 3 is "the wallet displays the available issuer(s)". A wallet cannot
discover this on its own — something has to tell it that the National Identity
Authority exists and where to reach it.

In the wallets we have examined, that list does not come from the issuer. It comes
from a companion service published by the wallet's own vendor, which the wallet
queries on startup. That companion service is not part of the architecture you
have approved, so including it would be an addition to the approved design,
however small.

**Questions:**
- Is introducing that additional service acceptable, given the wallet requires it?
- Your wording says "issuer(s)". Is listing only the National Identity Authority
  sufficient, or do you want more than one issuer visible so that the citizen's act
  of choosing is meaningful? A second issuer would mean inventing one, which we do
  not want to do without your agreement.

---

## 3. Where does the citizen's username and password come from?

Your step 2 requires the citizen to sign in with credentials associated with their
synthetic record. Nothing in the current scope covers how a citizen would come to
have those credentials: in the real world that is enrolment and identity proofing,
which the charter puts out of scope.

That leaves the demo starting from a point where the account already exists, with
accounts and passwords we create in advance and hand to whoever runs the demo.

**Questions:**
- Is it acceptable that the demo begins after the account exists, and does not show
  how a citizen would obtain one?
- Is it acceptable for the demo accounts to have fixed, published passwords so that
  anyone can reproduce the journeys?

---

## 4. Which system should the citizen actually sign in to?

"The wallet authenticates the citizen through Keycloak" can be built two ways, and
they are indistinguishable to the citizen — the same login page, the same
username and password, no QR code either way.

In the first, the wallet talks to Keycloak directly. In the second, the wallet
talks to the issuer, and the issuer sends the citizen to Keycloak to sign in.

The distinction matters for a practical reason: some wallets only work with one of
the two arrangements, and we will not know which until we have tested the wallet
against a live setup. If only one arrangement is considered to satisfy your
requirement, a wallet limitation could force us to reduce the journey.

**Question:** is either arrangement acceptable, provided the citizen signs in at
Keycloak using the credentials tied to their record?

---

## 5. What exactly counts as a "mobile verifier app"?

Your same-device journey requires "a separate demo mobile verifier app" that opens
the wallet on the same phone. That could mean an application installed on the
device, or a mobile web page that opens the wallet in the same way. The protocol,
the wallet's behaviour and the verification are identical in both; the difference
is only in how the verifier itself is delivered and how much work it is to build.

We are asking because you have already declined one substitution, and we do not
want to present another one you consider inadequate.

**Question:** must the mobile verifier be an installed application, or is a mobile
web page acceptable?

---

## 6. What will you accept as proof of the consent screen?

You require the real wallet's consent screen and a successful presentation, not
just a technical result. That could be a screen recording of each journey, or a set
of annotated screenshots at each step.

**Question:** which do you want, and is there anything you specifically want
visible — or specifically kept out — of those captures?

---

## 7. For the returning-citizen check, what does "authenticates again" mean?

Your evidence list asks that the credential is still available after the citizen
closes and reopens the wallet and authenticates again. That reads two ways:

- unlocking the wallet again, which shows the credential survived the app closing;
- signing in to Keycloak again, which shows the credential does not depend on a
  live session with the issuer.

They demonstrate different things and take different effort to show.

**Question:** which are you expecting? If both, we will show both.

---

## 8. How should we demonstrate that a citizen cannot obtain someone else's credential?

You require that attempting to request another citizen's credential fails. In the
design you have asked for, that attempt has no user journey: the wallet never names
a citizen, because the issuer works out whose record it is from the sign-in. There
is no screen where a citizen could ask for someone else's credential.

The only way to demonstrate the protection is therefore a technical test rather
than a demo step — showing that a request naming another citizen still produces
only the signed-in citizen's own data.

**Question:** is a test result acceptable as the evidence for this item, given
there is no journey to record?

---

## 9. The wallet best suited to Age is not the one the compatibility note assumed

The compatibility note earmarked one wallet for Age and a different one for
Agriculture. Having looked at both, the wallet earmarked for Age does not offer the
sign-in-then-choose-an-issuer journey you now require; the other one does, as
standard behaviour.

The charter leaves wallet selection to engineering, so we intend to proceed on that
basis and confirm it with a short compatibility test before building anything.

**Question:** any objection, given it reverses what the compatibility note assumed?

---

## 10. Age data separation cannot be done the way the design describes

The design asks for Age data to live in a named section of a shared database. The
product's registry does not offer that: it decides where its tables go and always
puts them in the default section, and there is no setting to change it. We
confirmed this by running it, not by reading documentation.

The closest equivalent that genuinely separates the data is to give Age its own
database inside the same database server — which is stronger separation than the
design asked for, still a single database server, and it lets Agriculture and
Education each have their own later. The intent of the design is preserved; the
mechanism differs.

**Question:** do you acknowledge this as an engineering choice, or would you rather
treat it as a change to the design that needs formal approval?

---

## 11. How would you like the branch history handled?

You asked that temporary setup documents from an earlier stage not reach the main
branch. Those documents have been removed, so they will not arrive with the merge.
Their history is still part of the branch, though, because the branch was
originally started from that earlier stage.

**Question:** how would you like the merge performed so that this is fully
resolved to your satisfaction?

---

## What is not waiting on you

So that nothing stalls while you consider these:

- The wallet compatibility test, which will answer several of the questions above
  with evidence instead of opinion.
- The sign-in setup and the link between each demo account and its citizen record.
- The removal of the work you rejected — the issuance QR page and the stand-in for
  a real wallet are already gone.
