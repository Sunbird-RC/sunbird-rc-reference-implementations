#!/usr/bin/env python3
"""Draws the Education logos the wallet's trust screen renders.

A script rather than three opaque PNGs because these are the only images in the
repo a reviewer cannot read: the wallet shows them beside "Do you trust ...?", so
they are part of the demo's evidence, and a committed binary with no provenance is
the one artefact nobody can check. Re-run it and the bytes are the same.

They deliberately match the five logos already in services/web-assets/logos: a
256x256 solid circle, a white glyph, transparent corners. The colours are new so
that the institutions and the employer are not shades of the same thing on one
screen — the university's maroon is the ADMISSIONS verifier's mark too, since it is
the same organisation, while the employer gets its own.

    python3 scripts/make-education-logos.py

Requires Pillow. Drawn at 4x and downscaled, which is the whole antialiasing
strategy — PIL's draw primitives have no antialiasing of their own.
"""
from PIL import Image, ImageDraw

SIZE = 256
SS = 4  # supersample factor
OUT = 'services/web-assets/logos'

# Distinct from green(58,110,54), brown(124,84,48), navy(32,70,112),
# indigo(30,41,99) and teal(13,110,96), so no two issuers read as one.
PLUM = (94, 48, 96, 255)
OCHRE = (146, 112, 34, 255)
MAROON = (126, 40, 52, 255)
SLATE = (58, 74, 92, 255)
WHITE = (255, 255, 255, 255)


def canvas(colour):
    im = Image.new('RGBA', (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([0, 0, SIZE * SS - 1, SIZE * SS - 1], fill=colour)
    return im, d


def save(im, name):
    im.resize((SIZE, SIZE), Image.LANCZOS).save(f'{OUT}/{name}.png')
    print(f'  {OUT}/{name}.png')


def school():
    """An open book: two pages meeting at a spine."""
    im, d = canvas(PLUM)
    s = SS
    cx, cy = 128 * s, 128 * s
    # Each page is a quadrilateral: outer edge low, spine edge high.
    for sign in (-1, 1):
        d.polygon(
            [
                (cx + sign * 6 * s, cy - 34 * s),
                (cx + sign * 74 * s, cy - 20 * s),
                (cx + sign * 74 * s, cy + 40 * s),
                (cx + sign * 6 * s, cy + 26 * s),
            ],
            fill=WHITE,
        )
    # The spine, as a gap rather than a line: redraw it in the field colour.
    d.rectangle([cx - 5 * s, cy - 40 * s, cx + 5 * s, cy + 32 * s], fill=PLUM)
    return im


def college():
    """A cog: a polytechnic, and the only one of the three that is not paper."""
    import math

    im, d = canvas(OCHRE)
    s = SS
    cx, cy = 128 * s, 128 * s
    # Drawn SUBTRACTIVELY: a solid white disc, then the gaps between the teeth
    # punched back out in the field colour, then the hub hole.
    #
    # The additive version — teeth as separate polygons on a smaller disc — was
    # tried first and read as a sun, then as a plain octagon: the teeth either
    # detached from the rim or merged with each other. Cutting gaps out of one
    # disc cannot produce either failure, because the teeth are the disc.
    outer, root, hub = 74 * s, 46 * s, 19 * s
    teeth = 8
    d.ellipse([cx - outer, cy - outer, cx + outer, cy + outer], fill=WHITE)
    for i in range(teeth):
        centre = 2 * math.pi * (i + 0.5) / teeth  # halfway between two teeth
        # 8 teeth means a 45-degree period, so a gap half-width of 11.5 degrees
        # leaves a 22-degree tooth beside a 23-degree gap. The first value here was
        # 21 degrees, which left 3-degree teeth: the cog rendered as thin spikes.
        half = math.radians(11.5)
        # A wedge reaching past `outer` so the cut is clean at the rim.
        pts = [(cx + root * math.cos(centre - half), cy + root * math.sin(centre - half))]
        steps = 8
        for k in range(steps + 1):
            a = centre - half + (2 * half) * k / steps
            pts.append((cx + (outer + 6 * s) * math.cos(a), cy + (outer + 6 * s) * math.sin(a)))
        pts.append((cx + root * math.cos(centre + half), cy + root * math.sin(centre + half)))
        d.polygon(pts, fill=OCHRE)
    d.ellipse([cx - hub, cy - hub, cx + hub, cy + hub], fill=OCHRE)
    return im


def university():
    """A mortarboard: the cap, its tassel, and the head beneath it."""
    im, d = canvas(MAROON)
    s = SS
    cx, cy = 128 * s, 122 * s
    # The board, as a rhombus seen in perspective.
    d.polygon(
        [(cx, cy - 42 * s), (cx + 76 * s, cy - 10 * s), (cx, cy + 22 * s), (cx - 76 * s, cy - 10 * s)],
        fill=WHITE,
    )
    # The head band under it.
    d.polygon(
        [
            (cx - 38 * s, cy + 4 * s),
            (cx + 38 * s, cy + 4 * s),
            (cx + 32 * s, cy + 48 * s),
            (cx - 32 * s, cy + 48 * s),
        ],
        fill=WHITE,
    )
    d.polygon([(cx - 42 * s, cy - 2 * s), (cx + 42 * s, cy - 2 * s), (cx, cy + 22 * s)], fill=MAROON)
    # The tassel, hanging from the right corner.
    d.line([(cx + 74 * s, cy - 10 * s), (cx + 74 * s, cy + 34 * s)], fill=WHITE, width=5 * s)
    d.ellipse([cx + 66 * s, cy + 30 * s, cx + 82 * s, cy + 46 * s], fill=WHITE)
    return im


def employer():
    """A briefcase: the employer, which is a verifier rather than an institution."""
    im, d = canvas(SLATE)
    s = SS
    cx, cy = 128 * s, 132 * s
    # Order matters: the HANDLE first, then the case painted over its lower half.
    # Punching the handle's bottom edge out with a field-coloured rectangle
    # instead left a dark bar sitting inside the case, which read as a smudge.
    d.rounded_rectangle(
        [cx - 26 * s, cy - 54 * s, cx + 26 * s, cy - 14 * s], radius=8 * s, outline=WHITE, width=9 * s
    )
    d.rounded_rectangle(
        [cx - 66 * s, cy - 26 * s, cx + 66 * s, cy + 44 * s], radius=9 * s, fill=WHITE
    )
    # The clasp, so the case is not a plain rounded rectangle.
    d.rectangle([cx - 11 * s, cy - 1 * s, cx + 11 * s, cy + 18 * s], fill=SLATE)
    return im


if __name__ == '__main__':
    print('drawing the Education logos')
    save(school(), 'state-school-board')
    save(college(), 'polytechnic-college')
    save(university(), 'state-university')
    save(employer(), 'employer')
