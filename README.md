# DevFest Lagos — experimental hero

A pixel-matched reconstruction of the DevFest Lagos hero, built against a
1440×1024 reference screenshot.

```bash
npm install
npm run dev          # http://localhost:3200
```

## The speaker artwork

The hero renders **one** montage image rather than four positioned layers —
the overlap between the figures is part of the artwork and would not survive a
resize if it were rebuilt from separate elements in CSS.

The four transparent cutouts live in `public/hero/speakers/`, left to right:

```
speaker-1.png   # patterned outfit, looking down
speaker-2.png   # long braids, white tee
speaker-3.png   # cream tee, lanyard, gesturing
speaker-4.png   # dark tee, microphone
```

After changing any of them, regenerate the montage:

```bash
python3 scripts/compose-montage.py
```

The cutouts arrive **pre-treated** — greyscale with the yellow silhouette
stroke already baked in — which is why `--montage-filter` in `app/Hero.css` is
`none`. If a raw colour cutout is ever used instead, set it to
`grayscale(1) url(#montage-outline)` and the `feMorphology` filter already in
`Hero.tsx` will produce the stroke at render time.

`PLACEMENTS` in `scripts/compose-montage.py` holds each figure's position and
scale in stage coordinates. Those numbers were not chosen by eye: each
cutout's silhouette was fitted against `reference/hero-1440x1024.png` by IoU
over scale and offset, then refined by greyscale mean-absolute-error over the
whole montage. All four scales land within 1% of 1.0, so the cutouts are
placed at native size rather than resized, and the outermost figures are
clipped by the edges of the stage — which is why the composition cannot be
derived from the figures' visible heights.

Final agreement with the reference is **9.4/255 mean absolute error** across
the montage region, and that figure still counts the heading's descenders,
which overlap the region but are drawn by the browser rather than by the
compositor.

## The hover reveal

Hovering the montage runs a Vizcom-style reveal: the picture grows slightly, a
design-tool selection rectangle expands over it, and the photograph turns full
colour **only inside that rectangle** while everything outside stays grey.

### Recovering the colour

This was the hard part, and it is worth knowing why. The supplied cutouts are a
*baked* greyscale export — desaturation and the yellow stroke are burned into
the pixels — so no CSS filter can bring colour back. A real colour layer had to
be reconstructed from the original photography:

| Cutout | Source | Match |
|---|---|---|
| speaker-1 | `DSC06429.jpg` | 0.905 **mirrored** |
| speaker-2 | `DSC05258.jpg` | 0.940 |
| speaker-3 | `DSC09208 (1).jpg` | 0.967 |
| speaker-4 | `DSC08967.jpg` | 0.990 |

`scripts/build-color-cutouts.py` registers each original against its cutout by
normalised cross-correlation over scale, offset **and orientation**, then
repaints the silhouette with colour photography while copying the yellow stroke
through untouched.

### Hover must change colour and nothing else

The colour montage is **not** composed independently of the grey one. It is the
grey montage, with chroma added:

```
luminance ← montage.png          (its own pixels, untouched)
chroma    ← registered photography
```

Composing the two separately looked reasonable and was wrong. LANCZOS over
colour and over grey do not land on identical luminance, and registration is
close but never exact, so every feature shifted a pixel or two on hover — the
cutout appeared to change direction when only its colour should have changed.
Measured, the two layers' luminance differed by a mean of 26.7/255, with a
3px rim at each silhouette averaging 41.

Taking luminance from the finished grey composite makes that impossible by
construction. The four reveal layers are then cut out of the recoloured
composite rather than composed afresh. Structure, edges, antialiasing and the
yellow stroke are now identical to within **1/255** — integer rounding — while
saturation is fully present.

Two supporting details. The BT.601 chroma deltas are luminance-neutral
(`0.299·dr + 0.587·dg + 0.114·db == 0`), so where strong colour would push a
channel out of gamut the chroma is *scaled* to fit rather than clipped —
clipping is not luminance-neutral and would have moved brightness on the
darkest and most saturated pixels. And because three of the four speakers were
shot against a green stage backdrop, the outermost pixels inside each
silhouette sample that backdrop wherever registration is off by a pixel; that
leaked out as a green fringe, so interior colour is grown outward by normalised
convolution and faded to neutral over the last few pixels. Residual green went
from 231 pixels to 60 on the worst figure, and to zero on two others.

Two details in the registration that cost real time:

- Speaker 1 was **mirrored** when the montage was composed. Unflipped she scores
  0.30; flipped, 0.86. Orientation is now searched rather than assumed.
- Plain SSD picked the laptop screen in her frame — a big flat region can beat
  the true match on raw difference. Normalising each window by its own contrast
  makes the score about structure, not level.

Both montages are composed from the same `PLACEMENTS` in the same order, so
they share an identical alpha channel: no double edges, no halo.

### How the reveal is built

**One rectangle per speaker.** The pointer's horizontal band selects a single
speaker; only that speaker turns to colour, framed on their own.

That constraint drives the architecture. A single shared colour montage does
not work: a rectangle drawn around speaker 2 overlaps speakers 1 and 3, so
clipping one colour image to it would light their overlapping parts up too. So
`compose-montage.py` also emits **four** `montage-reveal-N.png` layers, each
holding only that speaker's *visible* pixels — the figure in colour, with every
figure drawn after it erased, preserving the montage's occlusion order exactly.
Together the four tile the composition, which is what lets touch devices simply
open all of them to get the full colour picture.

Each layer is full-size and clipped by an animated `clip-path: inset(...)`. The
rectangle is a **window**, never a container — the image is never resized to fit
it, which is what keeps every layer registered against the greyscale base. The
frame uses `inset` with the same four values as the clip-path, so frame and
colour edge move as one, and it lives *inside* the scaled box so the 4.5% growth
cannot drift it off that edge.

Rectangles, their collapsed idle forms and the pointer bands are all generated
by `compose-montage.py` from where the speakers actually sit — regenerate rather
than hand-edit.

### The motion is damped followers, not transitions

This is the part that gives the interaction its feel, and it is worth
understanding before changing any of it.

There are no transitions on the reveal. Every animated value is a *follower*
that chases a target once per frame:

```
current += (target − current) × (1 − e^(−λ·dt))
```

No duration, no start, no end — only a target that may change at any moment.
That is the whole difference. A CSS transition that is interrupted restarts
from its current value with **zero velocity**, and that reset is what reads as a
snap. A follower just receives a new target and keeps the motion it already
had: move the pointer between two speakers mid-reveal and one rectangle
collapses while the other grows, both from wherever they happened to be.

The loop lives in `Hero.tsx` and writes plain scalars as custom properties —
`--p1…--p4` (per-speaker reveal), `--s` (image scale), `--cv` and `--cx` (card
presence and offset). `Hero.css` only interpolates between the idle and final
rectangles with `calc`. React is never involved in a frame; its state changes
only when a band boundary is crossed, to drive `data-active` for pointer-events.

Sequencing comes from each value having its own λ rather than from delays:
reveal 13/s, scale 8/s, card 5.5/s. Settle-to-99% is therefore 0.35s, 0.57s and
0.84s — the card visibly joins last because it is the slowest, not because it
was told to wait. This replaced a hand-set 210ms delay and a `left`-transition
workaround, both of which existed only to fight duration-based animation.

Two implementation details:

- `dt` is real elapsed time, clamped to 50ms, which makes the motion
  frame-rate independent — the same on a 60Hz and a 120Hz display, and it
  cannot teleport after a dropped frame or a background tab.
- Exponential decay only ever *approaches* its target, so the loop would
  otherwise run for as long as a speaker is hovered. Once every value is within
  a rounding error it lands on the targets exactly and stops; changing target
  starts it again.

This is deliberately scoped to the hero. The reference site gets part of its
feel from smooth-scroll inertia (Lenis) applied page-wide, which is a separate
decision and is not implemented here.

Verified at 1440×1024: exactly one frame and one layer open at a time, the card
lands on all four speakers and stays inside the montage at both extremes, the
reverse returns every property to idle, and there is **zero layout shift** —
header, H1, grid, arrows, paragraph and prompt are byte-identical between idle
and active, document height stays 1024.

## The two animations

They are deliberately different effects, and both rest on the state the
reference screenshot captured, so the hero still matches it on first paint and
under `prefers-reduced-motion`.

**Headline** (`WORDS` in `app/Hero.tsx`) — the yellow word cross-fades through
Ecosystem → Community → Event → Place → Experience → Network. "One" and the
comma stay; only the accent changes. Because the line stays centred on the
page axis, a wider word pushes them outwards, so the word sits in a slot whose
width is measured per word and animated. The swap happens while the word is at
zero opacity, so nothing jumps — "One" glides. Verified: the line's centre
stays at x=720 across the whole cycle.

**Prompt** (`QUESTIONS`) — a typing effect, character by character, with a
blinking caret: types a question, holds, deletes faster than it typed, moves
on. Cadence is uneven on purpose, with a longer rest after spaces; a fixed
interval reads like a ticker rather than someone typing. The animated line is
an overlay rather than the input's `placeholder` attribute, so it can carry a
real caret. It pauses on focus and disappears the moment anything is typed.

## Where the numbers come from

Geometry is in custom properties at the top of `app/Hero.css`. Everything that
looks like an arbitrary number was measured off the reference raster.

**Type.** The display face is Faculty Glyphic and the body face is Geist, both
self-hosted via `next/font/local`. The H1 size was not guessed: Faculty
Glyphic's two lines came out within 0.4% of each other's scale factor against
the reference, so size was the only free variable. Rasterising both lines in
the browser across a range of sizes and least-squaring against the measured
611px / 851px of reference ink gives **82.6px**, off by −4px and +3px. Tracking
stays at 0 — the two errors are opposite-signed, so letter-spacing cannot fix
both.

**Verified at 1440×1024** (measured, not eyeballed):

| Element | Target | Measured |
|---|---|---|
| Navigation | 220, 38, 1000×72 | exact |
| Buy Ticket | 1101, 54, 99×40 | exact |
| Grid panel | 353, 326, 767×386 | exact |
| Montage | 320, 368, 800×344 | exact |
| Controls | 320 / 1080, 735, 40×40 | exact |
| Prompt field | 547, 893, 346×60 | exact |
| H1 line 1 ink top | 172 | 171.8 |
| H1 line 2 ink top | 258 | 257.8 |
| Lede ink top | 784 | 783.8 |
| Document height | 1024 | 1024 |

The grid is inset 33px from the left of the stage but flush with its right
edge. That asymmetry is in the reference and is deliberate — don't "fix" it.
# Experimental-Website-for-Devfest
