# Visual and video plan

The showcase should be understandable by scanning the diagrams and watching the
videos before reading implementation detail.

## Required visual assets

| Page | Primary visual | Supporting visuals |
|---|---|---|
| Applications of Sunbird RC | Three sectors converging on the common Sunbird RC pattern | One image or short animation showing Registry → Credential → Wallet → Verifier |
| Age verification | Citizen, identity authority, wallet and verifier ecosystem map | Credential card, consent screen, disclosed-versus-private comparison |
| Agriculture and rural credit | Two registries issuing into one wallet and one bank request | Farmer credential, Land credential and loan-calculation illustration |
| Education and employment | Three issuers, one wallet and two verifier purposes | Three credential cards and side-by-side Master's/job rules |

The Mermaid diagrams in this draft provide the first version of each ecosystem
map. GitBook's Mermaid integration must be enabled for them to render. Before
public release, they may be replaced or supplemented with branded SVG diagrams
created from the same information.

## Required videos

### Cross-sector overview

A concise overview that introduces the three real-world problems, shows the
common Sunbird RC capability pattern and directs viewers to the sector pages.

### Age verification

Show direct issuance, stored credential, web QR verification, mobile deep link,
consent, minimum disclosure and approved/denied results.

### Agriculture and rural credit

Show the two issuers, both credentials, persistence after wallet restart, the
bank's multi-credential request, verified loan calculation, ineligibility,
mismatched-record rejection and refusal.

### Education and employment

Show all three issuers and credentials, followed by the Master's and employment
journeys. Include the different rules and make clear that eligibility is not
admission or employment.

## Publishing approach

- Host customer-facing videos on a stable public video platform such as YouTube
  or Vimeo and paste the public URL into GitBook to create a playable embed.
- Use descriptive thumbnails, captions and transcripts.
- Do not expose credentials, passwords, private keys, National IDs, deployment
  administration details or raw presentations.
- Keep the customer video focused on the problem, journey and outcome; link to
  the reference implementation for technical detail.
- Provide a static image and text summary for readers who cannot play video.

GitBook can embed a publicly accessible video URL directly. Large MP4 files
should not be served from the documentation repository because they increase
page weight and reduce playback and search performance.
