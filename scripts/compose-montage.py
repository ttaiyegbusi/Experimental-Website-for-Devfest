#!/usr/bin/env python3
"""Compose the four speaker cutouts into the single hero montage.

The hero renders one image rather than four positioned layers: the overlap
between the figures is part of the artwork, and re-deriving it from separate
elements would not survive a resize. This script is how that one image gets
made, so the composition stays reproducible when a speaker is swapped.

Input   public/hero/speakers/speaker-{1..4}.png        (baked greyscale)
        public/hero/speakers/speaker-{1..4}-color.png  (from build-color-cutouts.py)
Output  public/hero/montage.png        greyscale layer
        public/hero/montage-color.png  colour layer, same geometry

Both layers are composed from the same PLACEMENTS in the same order, so they
register exactly — which is what lets the hover reveal wipe between them
without any edge doubling.

Usage   python3 scripts/compose-montage.py

SCALE is 1 because the supplied cutouts are 262-415px wide and sit at roughly
1:1 with the stage, so they are already at native resolution. Raising it would
upsample them and invent detail that is not in the source. If sharper cutouts
ever arrive, raise SCALE to 2 and the placements below still hold — they are
in stage coordinates and get multiplied through.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "hero" / "speakers"
OUT = ROOT / "public" / "hero" / "montage.png"

SCALE = 1
STAGE_W, STAGE_H = 800, 344

# Placements measured off the 1440x1024 reference, in stage coordinates (page
# coordinates minus the stage's origin at 320,368). Derived by fitting each
# cutout's alpha silhouette against the reference by IoU over scale and
# offset, not by eye.
#
# The scales all land within 1% of 1.0, which says the cutouts are already at
# the size the reference used them — so they are placed, not resized. The
# outer figures run past the edges of the stage and are cropped there; that is
# how the reference is built, and it is why the montage cannot be derived from
# the figures' visible heights.
#
# Ordered back to front, and the order is NOT left to right. Speaker 2 sits
# behind both her neighbours: in the reference her left arm is hidden by
# speaker 1 and her raised right hand is hidden by speaker 3, so she is laid
# down first. Speaker 4 overlaps speaker 3 and goes last. Speakers 1 and 3
# never touch, so their relative order is free.
PLACEMENTS = [
    ("speaker-2.png", 104, -2, 1.010),
    ("speaker-1.png", -4, 19, 1.000),
    ("speaker-3.png", 333, 11, 0.990),
    ("speaker-4.png", 434, 1, 1.010),
]


def compose(suffix: str, out_name: str) -> None:
    canvas = Image.new("RGBA", (STAGE_W * SCALE, STAGE_H * SCALE), (0, 0, 0, 0))

    for name, x, y, scale in PLACEMENTS:
        path = SRC / name.replace(".png", f"{suffix}.png")
        if not path.exists():
            raise SystemExit(f"missing cutout: {path}")

        src = Image.open(path).convert("RGBA")

        # Trim transparent padding first, so the placement describes the figure
        # itself rather than whatever margin the export happened to carry.
        bbox = src.getbbox()
        if bbox:
            src = src.crop(bbox)

        factor = scale * SCALE
        if factor != 1.0:
            src = src.resize(
                (round(src.width * factor), round(src.height * factor)),
                Image.LANCZOS,
            )

        # Paste onto an oversized layer, then crop back to the stage, so the
        # figures that overhang the edges are clipped rather than shifted.
        layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        px, py = x * SCALE, y * SCALE
        sx, sy = max(0, -px), max(0, -py)
        if sx < src.width and sy < src.height:
            layer.paste(
                src.crop((sx, sy, src.width, src.height)),
                (max(0, px), max(0, py)),
            )
        canvas.alpha_composite(layer)

    out = OUT.parent / out_name
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)
    print(f"wrote {out.relative_to(ROOT)} ({canvas.width}x{canvas.height})")


def placed_layer(index: int, suffix: str) -> Image.Image:
    """One figure alone, rendered onto the full stage at its placement."""
    name, x, y, scale = PLACEMENTS[index]
    src = Image.open(SRC / name.replace(".png", f"{suffix}.png")).convert("RGBA")
    bbox = src.getbbox()
    if bbox:
        src = src.crop(bbox)
    factor = scale * SCALE
    if factor != 1.0:
        src = src.resize(
            (round(src.width * factor), round(src.height * factor)), Image.LANCZOS
        )
    layer = Image.new("RGBA", (STAGE_W * SCALE, STAGE_H * SCALE), (0, 0, 0, 0))
    px, py = x * SCALE, y * SCALE
    sx, sy = max(0, -px), max(0, -py)
    if sx < src.width and sy < src.height:
        layer.paste(
            src.crop((sx, sy, src.width, src.height)), (max(0, px), max(0, py))
        )
    return layer


def recolor_in_place() -> None:
    """Rebuild montage-color.png so it differs from montage.png *only* in hue.

    Composing the colour montage separately from resampled colour cutouts was
    never going to be safe: LANCZOS over colour and over grey do not land on
    identical luminance, and the registration is close but not exact, so the
    picture appeared to shift on hover — the cutout looked like it had changed
    direction when only the colour was supposed to change.

    So the colour montage is not composed independently at all. It takes the
    grey montage's own pixels for luminance and keeps nothing from the colour
    composite but chroma. Structure, edges, antialiasing and the yellow stroke
    are then identical by construction rather than by good fortune.
    """
    import numpy as np

    grey = np.array(Image.open(OUT.parent / "montage.png").convert("RGBA"))
    col = np.array(
        Image.open(OUT.parent / "montage-color.png").convert("RGBA")
    ).astype(np.float32)

    g = grey.astype(np.float32)
    y = 0.299 * g[..., 0] + 0.587 * g[..., 1] + 0.114 * g[..., 2]

    r, gg_, b = col[..., 0], col[..., 1], col[..., 2]
    cb = 128.0 - 0.168736 * r - 0.331264 * gg_ + 0.5 * b
    cr = 128.0 + 0.5 * r - 0.418688 * gg_ - 0.081312 * b

    dr = 1.402 * (cr - 128.0)
    dg = -0.344136 * (cb - 128.0) - 0.714136 * (cr - 128.0)
    db = 1.772 * (cb - 128.0)

    # These deltas are luminance-neutral (0.299·dr + 0.587·dg + 0.114·db == 0),
    # so scaling them changes saturation without touching brightness. Clipping
    # would not be neutral, so instead find the largest in-gamut scale.
    k = np.ones_like(y)
    for d in (dr, dg, db):
        with np.errstate(divide="ignore", invalid="ignore"):
            hi = np.where(d > 0, (255.0 - y) / d, np.inf)
            lo = np.where(d < 0, -y / d, np.inf)
        k = np.minimum(k, np.nan_to_num(np.minimum(hi, lo), nan=1.0, posinf=1.0))
    k = np.clip(k, 0.0, 1.0)

    out = grey.copy()
    out[..., 0:3] = np.clip(
        np.dstack([y + k * dr, y + k * dg, y + k * db]), 0, 255
    ).astype(np.uint8)
    Image.fromarray(out).save(OUT.parent / "montage-color.png")
    print("recoloured montage-color.png from montage.png (chroma only)")


def reveal_layers() -> None:
    """Per-figure colour layers, so one rectangle lights one speaker only.

    A rectangle drawn around speaker 2 overlaps speakers 1 and 3, so clipping
    the whole colour montage to it would light up their overlapping parts too.
    Each figure therefore gets its own layer holding only *its* visible colour
    pixels: the figure in colour, with every figure drawn after it erased, so
    the occlusion order of the montage is preserved exactly.
    """
    import numpy as np

    later_alpha = [np.array(placed_layer(j, ""))[..., 3] for j in range(len(PLACEMENTS))]

    # Every layer is a cut out of the recoloured composite, never a fresh
    # composition of its own. Because that composite is the grey montage with
    # chroma added, each layer's luminance is the grey montage's luminance to
    # the pixel — hovering can only change colour, never structure.
    colour = np.array(Image.open(OUT.parent / "montage-color.png").convert("RGBA"))

    rects = []
    for i, (name, *_rest) in enumerate(PLACEMENTS):
        layer = colour.copy()
        layer[..., 3] = later_alpha[i]
        for j in range(i + 1, len(PLACEMENTS)):
            layer[..., 3] = np.where(later_alpha[j] > 8, 0, layer[..., 3])
        img = Image.fromarray(layer)

        # Name the output after the speaker, not the draw position. The list is
        # ordered back-to-front (speaker 2 is painted first so speaker 1 laps
        # over her arm), so index and speaker number are not the same thing.
        speaker = name.split("-")[1].split(".")[0]
        img.save(OUT.parent / f"montage-reveal-{speaker}.png")

        # The rectangle framing this speaker's *visible* pixels, padded so the
        # yellow stroke is not clipped.
        bb = img.getbbox()
        pad = 7 * SCALE
        x0 = max(0, bb[0] - pad) / (STAGE_W * SCALE) * 100
        x1 = min(STAGE_W * SCALE, bb[2] + pad) / (STAGE_W * SCALE) * 100
        y0 = max(0, bb[1] - pad) / (STAGE_H * SCALE) * 100
        y1 = min(STAGE_H * SCALE, bb[3] + pad) / (STAGE_H * SCALE) * 100
        rects.append((speaker, x0, x1, y0, y1))

    rects.sort(key=lambda r: (r[1] + r[2]) / 2)

    # Idle state collapses each rectangle to 8% of its size about its own
    # centre, so it grows out of the speaker it belongs to.
    print("\n/* generated by scripts/compose-montage.py — do not hand-edit */")
    for speaker, x0, x1, y0, y1 in rects:
        w, h = x1 - x0, y1 - y0
        k = 0.46
        print(
            f"  --rect-{speaker}: {y0:.1f}% {100 - x1:.1f}% {100 - y1:.1f}% {x0:.1f}%;\n"
            f"  --idle-{speaker}: {y0 + k * h:.1f}% {100 - x1 + k * w:.1f}%"
            f" {100 - y1 + k * h:.1f}% {x0 + k * w:.1f}%;"
        )

    centres = [(r[1] + r[2]) / 2 for r in rects]
    print("\n  /* pointer bands, left to right */")
    bounds = (
        [0.0]
        + [(centres[i] + centres[i + 1]) / 2 for i in range(len(centres) - 1)]
        + [100.0]
    )
    print(
        "  --bands: "
        + ", ".join(f"{b:.1f}" for b in bounds[1:-1])
        + ";  /* speaker order: "
        + ", ".join(r[0] for r in rects)
        + " */"
    )
    print("  --card-x: " + ", ".join(f"{c:.1f}%" for c in centres) + ";")


if __name__ == "__main__":
    compose("", "montage.png")
    compose("-color", "montage-color.png")
    recolor_in_place()
    reveal_layers()
