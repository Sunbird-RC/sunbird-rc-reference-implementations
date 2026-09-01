# Sunbird RC showcase visual style

This guide is derived from the live visual treatment at
[rc.sunbird.org](https://rc.sunbird.org). It should govern diagrams, video
titles, thumbnails, screenshots, standalone showcase pages and any custom
assets added to the GitBook.

Pages added to the existing Sunbird RC GitBook will inherit its native
typography and navigation treatment. The values below are primarily for custom
visuals and any application surface that must visually align with the site.

## Design character

- Clear, quiet and documentation-led.
- White canvas with restrained neutral surfaces.
- Dark charcoal primary text rather than pure black.
- Blue reserved for links, active navigation and meaningful emphasis.
- Rounded borders used selectively for controls, cards and navigation blocks.
- Generous reading line-height and limited content width.
- Illustrations should explain systems, not decorate empty space.

## Typography

### Font families

| Use | Font stack |
|---|---|
| Interface and content | `Inter, "Inter Fallback", system-ui, Arial, sans-serif` |
| Code and technical identifiers | `"IBM Plex Mono", monospace` |

### Type scale

| Element | Size | Line height | Weight | Letter spacing |
|---|---:|---:|---:|---:|
| Page title / H1 | 36px | 45px | 700 | -0.9px |
| Section heading / H2 | 30px | 36px | 600 | -0.375px |
| Subsection heading / H3 | 24px | 32px | 600 | approximately -0.3px |
| Minor heading / H4 | 20px | 28px | 600 | -0.25px |
| Body copy | 16px | 26px | 400 | normal |
| List copy | 16px | 24px | 400 | normal |
| Navigation | 14px | 20px | 400 | normal |
| Buttons and controls | 14px | 21px | 400–500 | normal |
| Breadcrumbs and compact metadata | 12px | 16px | 400 | normal |
| Footer metadata | 14px | 20px | 400 | normal |

Use bold text sparingly. Maintain the heading hierarchy rather than simulating
headings with bold paragraphs.

## Colour palette

| Token | Value | Use |
|---|---|---|
| Primary text | `#1C1D1F` | Headings, body text and icons |
| Secondary text | `#6A6E77` | Supporting copy and metadata |
| Muted text | `#79859B` | Captions and diagram connectors |
| Accent blue | `#346DDB` | Links, active navigation and selected emphasis |
| Soft blue | `#E0EEFF` | Highlighted diagram nodes and light accent surfaces |
| Border | `#E2E6EC` | Cards, tables, dividers and controls |
| Neutral surface | `#F6F7FA` | Secondary cards and grouped content |
| Canvas | `#FFFFFF` | Page and primary card background |

Do not introduce a separate colour palette for each sector. Use small icons,
labels or restrained tints to distinguish applications while retaining one
Sunbird RC identity.

## Layout and spacing

- Header height: 64px.
- Primary reading column: maximum 768px; the live three-column layout presents
  approximately 608px of readable content at a 1280px viewport.
- Left navigation: approximately 288px on desktop.
- Supporting right rail: approximately 256px on wide screens.
- Base spacing unit: 4px.
- Preferred content spacing: 8px, 12px, 16px, 20px, 24px, 32px and 40px.
- Paragraph separation: approximately 20px.
- Keep diagrams within the reading width or allow intentional full-width display
  only when labels remain legible.

## Components

### Cards and navigation blocks

- 1px solid `#E2E6EC` border.
- 12px corner radius.
- 16px desktop padding; 12px compact padding.
- 12px internal gap.
- White or `#F6F7FA` background.
- Avoid heavy shadows; separation should come from whitespace and borders.

### Buttons and compact controls

- 12px corner radius.
- Approximately 8px compact padding.
- 14px text with a 21px line height.
- Blue for primary action or active state; neutral treatments otherwise.

### Links

- Use `#346DDB` for linked text and active navigation.
- Underline links in body content when the surrounding context does not already
  make interactivity obvious.

### Tables

- Use concise headers and 1px `#E2E6EC` separators.
- Keep backgrounds white; use `#F6F7FA` only for a header or grouped row when
  needed.
- Avoid wide tables when the same information can be expressed through a simple
  diagram or short list.

### Diagrams

- Inter typeface.
- `#1C1D1F` labels and `#79859B` connectors.
- `#E0EEFF` for the primary Sunbird RC or selected node.
- `#F6F7FA` for supporting actors.
- `#346DDB` for trusted exchange or active-flow emphasis.
- 12px rounded nodes, thin borders and minimal shadows.
- One main idea per diagram; avoid architecture diagrams on introductory pages.

### Video thumbnails and title cards

- White or neutral background with a single soft-blue focal panel.
- Short title in Inter 600 or 700.
- One ecosystem illustration or genuine application frame.
- Sunbird RC mark positioned consistently.
- Avoid dense text, gradients unrelated to the site, stock-photo collages and
  sector-specific branding that overwhelms Sunbird RC.

## Responsive behaviour

- Collapse multi-column visuals into a top-to-bottom sequence on narrow screens.
- Keep body copy at 16px; do not shrink it to force desktop diagrams onto mobile.
- Ensure diagram labels remain readable without horizontal scrolling where
  practical.
- Use a shorter H1 scale on compact screens while retaining the same hierarchy.
- Place video before detailed steps so mobile readers reach the main experience
  early.

## Accessibility

- Maintain WCAG-compliant contrast for text and interactive states.
- Never use colour as the only carrier of meaning.
- Provide alternative text for every image and diagram.
- Provide captions and transcripts for every video.
- Preserve keyboard-visible focus states in custom interfaces.
- Avoid autoplay with sound and avoid motion that cannot be paused.

## GitBook implementation note

GitBook controls the native page typography, navigation and responsive layout.
When these pages are placed in the existing Sunbird RC space, use its inherited
theme instead of attempting per-page font overrides. Enable the Mermaid
integration for the diagrams and apply this guide to custom SVGs, screenshots,
video assets and any separately hosted showcase experience.
