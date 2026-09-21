# Journey diagrams

Source for the three journey diagrams published on the Sunbird RC GitBook, under
`reference-solutions-for-digital-credentials/applications-of-sunbird-rc/`.

The book has no mermaid support — every one of its 324 existing figures is a PNG
in `.gitbook/assets/`. These `.mmd` files are the editable source; the published
artefact is the rendered PNG.

## Re-rendering

Two settings are not optional.

**`flowchart: { htmlLabels: false }`** — by default mermaid puts node text in an
SVG `<foreignObject>` containing HTML. `rsvg-convert` cannot render
`<foreignObject>`, so the result is boxes and arrows with **no text at all**.
With `htmlLabels: false` mermaid emits real SVG `<text>` nodes instead.

**`flowchart TD`** — laid out left-to-right these graphs are 6:1 to 17:1 strips.
Scaled into GitBook's ~800px column the labels become unreadable. Top-down gives
0.7:1 to 1.9:1, which matches the book's existing figures.

```js
mermaid.initialize({
  startOnLoad: true,
  securityLevel: "loose",
  flowchart: { htmlLabels: false, useMaxWidth: false },
});
```

Then, per diagram:

```bash
rsvg-convert -z 2 -b white <name>.svg -o <name>.png
```

`-z 2` renders at 2x so the PNG stays crisp at column width; `-b white` avoids a
transparent background, which reads as black in GitBook's dark mode.

## Do not paste the source into the markdown page

An HTML comment ends at its first `-->`, and mermaid's arrows *are* `-->`. A
diagram wrapped in `<!-- ... -->` closes the comment at the first edge and spills
the remaining source onto the rendered page as visible body text. That is why the
source lives here and the page carries only the image.
