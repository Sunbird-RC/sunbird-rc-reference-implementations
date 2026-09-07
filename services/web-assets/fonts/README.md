# Third-party font

`rubik-latin.woff2` is a subset of **Rubik**, which is **not** covered by this
repository's MIT licence. It is bundled because the showcase has to run on a
laptop with no network, so there is no CDN to fetch it from.

| | |
|---|---|
| Font | Rubik |
| Designers | Philipp Hubert and Sebastian Fischer, with Meir Sadan and Cyreal |
| Licence | SIL Open Font License, Version 1.1 |
| Upstream | https://github.com/googlefonts/rubik |
| Licence text | https://github.com/googlefonts/rubik/blob/main/OFL.txt |

The OFL permits bundling and redistribution, including inside a work released
under a different licence, provided the font itself stays under the OFL and the
copyright and licence notice travel with it — which is what this file is for.

Two OFL conditions worth knowing before anyone changes this file:

- **The Reserved Font Name.** "Rubik" is reserved. A modified version must be
  renamed. Subsetting to the Latin range, which is all that was done here, is not
  a modification of the design, so the name is retained.
- **The font may not be sold on its own**, and it must remain OFL — it cannot be
  relicensed to MIT along with the rest of this repository.

If you would rather not redistribute a font at all, `services/web-assets/styles.css`
declares it in one `@font-face` block and falls back through the system sans
stack; deleting the block and this directory degrades the look and breaks
nothing.
