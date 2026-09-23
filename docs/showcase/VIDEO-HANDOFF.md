# Video handoff — three showcase demonstrations

Everything needed to put the demonstration videos on the Sunbird YouTube
channel and into the documentation. **No filming or editing is required**: all
three films are finished, narrated and to one spec.

The only step that cannot be done from this repository is the upload itself,
because it needs access to the Sunbird channel.

## Why YouTube

It is what the book already does. Across `Sunbird-RC/community`:

| | count |
|---|---|
| `{% embed %}` blocks | 48 |
| YouTube links | 15 |
| Vimeo links | 0 |
| `.mp4` files committed | **0** |

Several existing links carry `&ab_channel=Sunbird`, so the videos live on the
organisation's channel rather than an individual's. Committing the MP4s instead
would add ~47 MB to a repository that serves them poorly, and no other page in
the book does it.

## What to upload

All three are 720x1600, H.264, 30 fps, AAC stereo, each normalised to -16.0
LUFS. Paths are relative to `RC_video/New_Flow/`.

| # | File | Length | Size |
|---|---|---|---|
| 1 | `27-08-2016/Age-Verification-Showcase-27Aug.mp4` | 4m 46s | 15.9 MB |
| 2 | `Agri_Demo/Agriculture-Rural-Credit-Showcase-31Aug.mp4` | 5m 22s | 15.9 MB |
| 3 | `Edu_Demo/Education-Employment-Showcase-01Sep.mp4` | 5m 32s | 17.3 MB |

Take the file **without** `.pass1` in the name — `Age-Verification-Showcase-27Aug.pass1.mp4`
(5m 42s) is the superseded earlier cut.

Unlisted is enough. The pages link to them; they do not need to be discoverable
on the channel.

### Suggested titles and descriptions

**1 — Age verification**

> Sunbird RC — Age verification: prove you are over 18 without revealing your date of birth

> A citizen receives an Age Verification Credential straight into their wallet, then proves they are over 18 to an age-restricted service. The service learns one fact and nothing else — the date of birth never leaves the issuing registry. Covers wallet-driven issuance, a cross-device check, a same-device check, and a refusal. All data is synthetic.

**2 — Agriculture and rural credit**

> Sunbird RC — Agriculture and rural credit: two registries, one consented presentation

> A farmer holds credentials from two authorities that share no database — a farmer registry and a land registry — and presents both to a bank in a single consented presentation. The bank verifies each, checks they describe the same farmer, and applies a published lending rule. Covers an eligible decision, an ineligible one, and a rejection where the two credentials name different farmers. All data is synthetic.

**3 — Education and employment**

> Sunbird RC — Education and employment: three credentials, two decisions, two different answers

> A learner carries qualifications from school, college and university in one wallet, and presents the same three to a university admissions office and to an employer. The two apply different published rules and correctly reach different answers, with no reissuance. Covers issuance, persistence across a restart, both decisions, a threshold case, and a refusal. All data is synthetic.

## Where each link goes

Each page has a `## Watch the demonstration` section containing an HTML comment
marked `VIDEO SLOT`. Replace the **whole comment** with the embed. The comment
itself carries the same instructions, so it can be done without this file.

| Video | Page |
|---|---|
| 1 | `reference-solutions-for-digital-credentials/applications-of-sunbird-rc/age-verification.md` |
| 2 | `reference-solutions-for-digital-credentials/applications-of-sunbird-rc/agriculture-rural-credit.md` |
| 3 | `reference-solutions-for-digital-credentials/applications-of-sunbird-rc/education-employment.md` |

The embed uses the syntax already used across the book:

```
{% embed url="https://youtu.be/VIDEO_ID" %}
Age verification: one credential, one disclosed fact, and a date of birth that never leaves the registry
{% endembed %}
```

Keep the caption line — it is what a reader sees before deciding to watch.

## Until then

The slots are HTML comments, so they render as nothing. A reader sees a complete
page with no gap and no "coming soon", and each page already links to the
evidence directory holding the recorded walkthrough. Publishing before the
uploads happen costs nothing.

## Optional, later: short clips

These films run about five minutes each. A documentation reader is usually
scanning, so a 60-90 second cut per page — **issue once, present, the service
decides** — would sit better on the page, with the full film linked underneath.

That is an editing task on footage that already exists, reusing the pipeline in
`RC_video/New_Flow/Edu_Demo/` (`build-body.py` for segment assembly,
`make-yaml.py` for narration cues). One caution learned the hard way: every hold
must be checked on the frame it lands on, because `tpad` clones the *last* frame
and has silently frozen holds on the wrong screen.

This is a refinement, not a prerequisite. The full films can go up first and be
swapped for shorter cuts later without touching the pages, since only the video
id changes.
