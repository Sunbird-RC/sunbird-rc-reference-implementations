# Publishing the three use cases to rc.sunbird.org

How the showcase pages in this directory reach the Sunbird RC GitBook, and how
short videos go with them.

## What the target actually is

`https://rc.sunbird.org/` is the GitBook rendering of **`Sunbird-RC/community`**
(confirmed: the site title is "Introduction | Sunbird RC" and the repo holds
`.gitbook/`, `SUMMARY.md` and every page the site shows). So publishing is a
**pull request to `Sunbird-RC/community`**, not a CMS task. `SUMMARY.md` is the
navigation; a page that is not listed there is not in the book.

## Where the pages go

**Recommendation: `learn/sunbird-rc-in-action/`.**

| Why | Evidence |
|---|---|
| The section exists for exactly this and is empty | `learn/sunbird-rc-in-action/README.md` is a bare `# Sunbird RC in action` heading with no body |
| Our overview was written for that slot | Anand's page is titled "Applications of Sunbird RC" |
| It sits in the *Learn* arc, where a reader asks "what has this been used for?" | `SUMMARY.md` lines 31–33 |

Add a cross-link from `## Reference Solutions` so a reader who arrives looking
for something to build from also finds it. Do **not** split the four pages across
both sections — they were authored as one set with their own `SUMMARY.md`, and
splitting them duplicates the overview.

Proposed layout and `SUMMARY.md` entries:

```
learn/sunbird-rc-in-action/
  README.md                       <- docs/showcase/README.md (replaces the empty page)
  capability-matrix.md            <- docs/showcase/capability-matrix.md
  age-verification.md             <- docs/showcase/use-cases/age-verification.md
  agriculture-rural-credit.md     <- docs/showcase/use-cases/agriculture-rural-credit.md
  education-employment.md         <- docs/showcase/use-cases/education-employment.md
```

```markdown
* [Sunbird RC in action](learn/sunbird-rc-in-action/README.md)
  * [Capability map](learn/sunbird-rc-in-action/capability-matrix.md)
  * [Age verification](learn/sunbird-rc-in-action/age-verification.md)
  * [Agriculture and rural credit](learn/sunbird-rc-in-action/agriculture-rural-credit.md)
  * [Education and employment](learn/sunbird-rc-in-action/education-employment.md)
  * [Implementations (Work in Progress)](learn/sunbird-rc-in-action/implementations-work-in-progress.md)
  * [Possibilities](learn/sunbird-rc-in-action/possibilities.md)
```

`docs/showcase/SUMMARY.md` and `use-case-template.md` do **not** travel: the book
has its own table of contents, and the template is our authoring aid.

## The videos

**The convention is already set, and we should follow it rather than invent one.**
The book contains **26 `{% embed %}` blocks and 11 YouTube references — and zero
Vimeo, zero `.mp4`**. Both sampled videos are on the **`SB-Internal`** channel,
one of them titled *"Sunbird RC Education use-case demo"*. So:

- **host on YouTube, on Sunbird's own channel** — not a personal channel, and not
  as files in git
- **embed** with the syntax already in use:

```markdown
{% embed url="https://youtu.be/VIDEO_ID" %}
Age verification in 80 seconds — issue once, prove 18+ without revealing a date of birth
{% endembed %}
```

Never commit the MP4s. The three full films are 15.1, 15.1 and 16.5 MB; GitBook would
serve them badly and they would bloat a repository that is already 50 MB.

### Short clips, not the full films

Ask for **one 60–90 second clip per use case**, cut to a single spine:
**issue once → present → the service decides**. A documentation reader is
scanning; a five-minute film is a commitment they have not yet agreed to. Put the
full film underneath as a link for the reader the short clip has convinced.

All three source films already exist under
`RC_video/New_Flow/`, finished and to one spec — 720x1600 H.264, AAC stereo,
each normalised to exactly -16.0 LUFS:

| Page | Short clip | Source film | Full film |
|---|---|---|---|
| Age verification | ~70 s | `27-08-2016/Age-Verification-Showcase-27Aug.mp4` (285 s) | link |
| Agriculture | ~75 s | `Agri_Demo/Agriculture-Rural-Credit-Showcase-31Aug.mp4` (322 s) | link |
| Education | ~90 s | `Edu_Demo/Education-Employment-Showcase-01Sep.mp4` (332 s) | link |
| Education, purpose fix | 39 s, use as-is | `Education-Purpose-Followup-02Sep.mp4` | - |

**No new filming is needed.** Every clip is a cut from footage that already
exists, which makes this a day of editing rather than a reshoot.

Two things to know about the Age film specifically. It is **not committed to this
repository** — Agriculture and Education are, Age is not — so
`docs/evidence/01-age/` has no video beside its README, and the showcase page
still carries Anand's placeholder *"Add the public customer demonstration video
and live-demo link here when they ..."*. Committing it would add 15.1 MB; given
the YouTube decision above, the better fix is to fill that placeholder with the
embed rather than the file. And note `Age-Verification-Showcase-27Aug.pass1.mp4`
(342 s) sitting next to it is the superseded earlier cut — the 285 s file without
`.pass1` is the one to use.

Cutting the clips reuses the existing pipeline in
`RC_video/New_Flow/Edu_Demo/` — `build-body.py` for segment assembly with
measured crops, `make-yaml.py` for narration cues derived from the timeline.
Every hold must be checked on the frame it lands on: `tpad` clones the *last*
frame, which has silently frozen six holds on the wrong screen before.

### What each clip should show

Not a feature tour. One decision, end to end:

- **Age** — a citizen proves 18+ to a shop; the shop learns nothing else. The
  point is the withheld date of birth.
- **Agriculture** — two credentials from two registries, one loan decision. The
  point is that the bank never gets a shared database.
- **Education** — the same three cards give a university and an employer
  *different* answers. The point is one issuance, many purposes.

## Prerequisites

Four, and the first two are blocking.

1. **The pages carry 18 factual errors** — 12 invented credential names in the
   Education page ("School Certificate" where the deployment publishes "School
   Record Credential"), four claim names that exist in no schema (`status`,
   `degree`, `cultivatedAcres`, `registrationStatus`), two sample identifiers in
   the wrong format, and a sample that contradicts the page's own "two rules, two
   answers" claim. Publishing these under Sunbird's name and correcting in public
   is the worse order. Anand signed them off believing them accurate, so the list
   goes to him for approval first.
2. **Every evidence link points at a repository that is still private.** The 20
   links now resolve to `Sunbird-RC/sunbird-rc-reference-implementations`, which
   404s for anyone outside until it is made public.
3. **YouTube uploads need Sunbird channel access.** `SB-Internal` is not ours.
   Sunbird uploads, or grants access; either way it is a dependency, not a task
   we can schedule. This is now the only external dependency, since the footage
   all exists.
4. **The Education page is missing the "Information design" section** its two
   siblings have, and all three diverge from `use-case-template.md`. Worth
   reconciling before they become the published reference.

## Sequence

1. Send Anand the 18 corrections; get approval.
2. Correct the pages here, on a branch, so the fixes are reviewable before they
   travel.
3. Make the repository public (or the links stay dead).
4. Cut the three clips from the existing films. No filming required.
5. Sunbird uploads the three clips to `SB-Internal`, unlisted or public.
6. Open the `Sunbird-RC/community` PR: five pages, the `SUMMARY.md` entries, the
   embeds, and the cross-link from Reference Solutions.
7. In the same PR, fix `use/releases.md`, which still says *"The current version
   is `v0.0.14`"* — this is very likely what led Anand to think `v2.0.3` was the
   latest release when it is in fact `v2.1.0`.

## Verification

- GitBook preview renders all five pages, each embed plays, and the navigation
  nests as above.
- No dead links: re-run `verify-showcase-docs.sh`, which already checks link
  reachability, credential naming against the deployment, claim names against the
  registry schemas, and thresholds against the live policy endpoints.
- Every page renders on a phone — the tables are wide, and the participants table
  is the widest thing in the set.
- No `.mp4` is added to `Sunbird-RC/community`: `git diff --stat` on the PR shows
  markdown only.
