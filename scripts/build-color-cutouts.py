#!/usr/bin/env python3
"""Rebuild the speaker cutouts in full colour, pixel-aligned with the grey ones.

The supplied cutouts are a *baked* greyscale export — the desaturation and the
yellow silhouette stroke are burned into the pixels. Removing a CSS filter
cannot bring the colour back, so the hover reveal needs a real colour layer.

This script recovers one. For each cutout it registers the original colour
photograph against the cutout's own luminance (searching scale and offset by
sum-of-squared-difference over the person's pixels only), then rebuilds the
cutout with colour photography inside the silhouette. The yellow stroke is
copied through untouched, so the outline stays yellow in both layers and the
two montages share an identical alpha channel — no double edges, no halo.

Input   public/hero/speakers/speaker-{1..4}.png   (baked greyscale + stroke)
        the colour originals listed in SOURCES below
Output  public/hero/speakers/speaker-{1..4}-color.png

Usage   python3 scripts/build-color-cutouts.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
CUTOUTS = ROOT / "public" / "hero" / "speakers"

# Confirmed by comparing each cutout against the shoot: identical pose, hands
# and lanyard in every case. Speaker 1 is NOT DSC06329 (a similar outfit on a
# different slide) — it is DSC06429.
DOWNLOADS = Path("/Users/temitopeaiyegbusi/Downloads")
SOURCES = {
    1: DOWNLOADS / "DSC06429.jpg",
    2: DOWNLOADS / "Devfest Images" / "DSC05258.jpg",
    3: DOWNLOADS / "Devfest Images" / "DSC09208 (1).jpg",
    4: DOWNLOADS / "Devfest Images" / "DSC08967.jpg",
}


def masks(cut: Image.Image):
    """Split a cutout into its person pixels and its yellow stroke."""
    a = np.array(cut)
    r, g, b, alpha = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    solid = alpha > 200
    # The stroke is the only saturated thing in a greyscale export.
    stroke = solid & (r.astype(int) - b.astype(int) > 60) & (r > 150)
    person = solid & ~stroke
    return person, stroke


def _score(cand: np.ndarray, tv: np.ndarray, tnorm: float, mask: np.ndarray):
    """Zero-mean normalised cross-correlation of every window against tv.

    Plain SSD is not safe here: a large flat region (a projector screen, a
    laptop lid) can beat the true match on raw difference. Normalising by each
    window's own contrast makes the score about structure instead of level.
    """
    sh, sw = mask.shape
    win = np.lib.stride_tricks.sliding_window_view(cand, (sh, sw))
    v = win[:, :, mask].astype(np.float32)
    v = v - v.mean(axis=2, keepdims=True)
    num = (v * tv).sum(axis=2)
    den = np.sqrt((v * v).sum(axis=2)) * tnorm + 1e-6
    return num / den


def register(gray: np.ndarray, person: np.ndarray, src: Image.Image):
    """Find (scale, dx, dy, flipped) placing `src` under the cutout.

    Orientation is searched, not assumed: speaker 1 was mirrored when the
    montage was composed, and matching her unflipped scores 0.30 against 0.86
    flipped. Testing both costs one extra pass and removes a whole class of
    silent misregistration.
    """
    best_overall = (-2.0, None, False)
    for flipped in (False, True):
        source = src.transpose(Image.FLIP_LEFT_RIGHT) if flipped else src
        score, params = _register_one(gray, person, source)
        if score > best_overall[0]:
            best_overall = (score, params, flipped)
    return best_overall


def _register_one(gray: np.ndarray, person: np.ndarray, src: Image.Image):
    srcL = src.convert("L")

    def prep(step):
        t = gray[::step, ::step].astype(np.float32)
        m = person[::step, ::step]
        tv = t[m]
        tv = tv - tv.mean()
        return m, tv, float(np.sqrt((tv * tv).sum()) + 1e-6)

    # Coarse: every scale, every offset, at 1/8 resolution.
    step = 8
    mask, tv, tnorm = prep(step)
    sh, sw = mask.shape
    best = (-2.0, None)
    for f in np.geomspace(0.05, 0.50, 46):
        w, h = int(src.width * f / step), int(src.height * f / step)
        if w < sw or h < sh:
            continue
        cand = np.asarray(srcL.resize((w, h), Image.BILINEAR), dtype=np.float32)
        z = _score(cand, tv, tnorm, mask)
        iy, ix = np.unravel_index(int(np.argmax(z)), z.shape)
        if z[iy, ix] > best[0]:
            best = (float(z[iy, ix]), (f, ix * step / f, iy * step / f))

    # Refine: narrow scale band and a local offset window, at 1/2 resolution.
    f0, ox0, oy0 = best[1]
    step = 2
    mask, tv, tnorm = prep(step)
    sh, sw = mask.shape
    for f in np.linspace(f0 * 0.88, f0 * 1.12, 25):
        w, h = int(src.width * f / step), int(src.height * f / step)
        if w < sw or h < sh:
            continue
        cand = np.asarray(srcL.resize((w, h), Image.BILINEAR), dtype=np.float32)
        cx, cy = int(ox0 * f / step), int(oy0 * f / step)
        pad = 24
        x0, y0 = max(0, cx - pad), max(0, cy - pad)
        x1 = min(w - sw, cx + pad)
        y1 = min(h - sh, cy + pad)
        if x1 < x0 or y1 < y0:
            continue
        sub = cand[y0 : y1 + sh, x0 : x1 + sw]
        if sub.shape[0] < sh or sub.shape[1] < sw:
            continue
        z = _score(sub, tv, tnorm, mask)
        iy, ix = np.unravel_index(int(np.argmax(z)), z.shape)
        if z[iy, ix] > best[0]:
            best = (
                float(z[iy, ix]),
                (f, (x0 + ix) * step / f, (y0 + iy) * step / f),
            )
    return best


def bleed_inward(col: np.ndarray, person: np.ndarray, rim: int = 9) -> np.ndarray:
    """Replace the outer rim of the silhouette with colour grown from inside.

    Registration is accurate to a pixel or two, which is invisible in the
    middle of a figure and obvious at its edge: the outermost pixels sample
    whatever was *behind* the speaker in the original frame — a green stage
    backdrop, in three of these four — and that leaked out as a green fringe
    once the chroma was blurred. Growing the interior colour outward by
    normalised convolution fills the rim with skin and shirt instead.
    """
    interior = np.asarray(
        Image.fromarray((person * 255).astype(np.uint8)).filter(
            ImageFilter.MinFilter(rim)
        )
    ) > 128
    if not interior.any():
        return col

    # 8-bit throughout: GaussianBlur has no float mode, and this only has to
    # carry low-frequency colour a few pixels outward.
    blur = ImageFilter.GaussianBlur(10)
    m8 = (interior * 255).astype(np.uint8)
    den = np.asarray(Image.fromarray(m8).filter(blur)).astype(np.float32)
    out = col.astype(np.float32).copy()
    for c in range(3):
        masked = np.where(interior, col[..., c], 0).astype(np.uint8)
        num = np.asarray(Image.fromarray(masked).filter(blur)).astype(np.float32)
        grown = np.divide(
            num * 255.0, den, out=np.zeros_like(num), where=den > 1.0
        )
        ch = out[..., c]
        ch[~interior] = grown[~interior]

    # Fade what is left toward neutral over the last few pixels. Any residual
    # bleed is strongest exactly at the boundary, and losing saturation there
    # costs nothing: the yellow stroke sits immediately outside it, and the
    # composite takes its luminance from the grey montage either way, so these
    # pixels stay pixel-identical in brightness — they just stop being green.
    taper = (
        np.asarray(
            Image.fromarray((person * 255).astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(2)
            )
        ).astype(np.float32)
        / 255.0
    )
    taper = np.clip((taper - 0.55) / 0.35, 0.0, 1.0)[..., None]
    grey = out.mean(axis=2, keepdims=True)
    out = grey + (out - grey) * taper
    return np.clip(out, 0, 255).astype(np.uint8)


def build(i: int) -> None:
    cut = Image.open(CUTOUTS / f"speaker-{i}.png").convert("RGBA")
    person, stroke = masks(cut)
    gray = np.array(cut)[..., 0]

    src = Image.open(SOURCES[i]).convert("RGB")
    score, (f, ox, oy), flipped = register(gray, person, src)
    if flipped:
        src = src.transpose(Image.FLIP_LEFT_RIGHT)

    # Render the source at the registered scale and crop the matching window.
    w, h = int(round(src.width * f)), int(round(src.height * f))
    placed = src.resize((w, h), Image.LANCZOS)
    x0, y0 = int(round(ox * f)), int(round(oy * f))
    canvas = Image.new("RGB", cut.size, (0, 0, 0))
    canvas.paste(placed.crop((x0, y0, x0 + cut.width, y0 + cut.height)), (0, 0))

    out = np.array(cut).copy()
    col = bleed_inward(np.array(canvas), person)
    # Straight photographic colour inside the silhouette; the stroke keeps its
    # own pixels. No luminance work happens here — this file only has to get
    # the right photograph into the right place. Guaranteeing that the hover
    # changes *nothing but colour* is done once, on the finished composite, in
    # compose-montage.py: it keeps the grey montage's own luminance and takes
    # only chroma from here, so the two can never drift.
    out[person, 0:3] = col[person]
    Image.fromarray(out).save(CUTOUTS / f"speaker-{i}-color.png")
    flag = "" if score > 0.75 else "   <-- LOW, check this one"
    mirror = " mirrored" if flipped else ""
    print(
        f"speaker-{i}: scale={f:.4f} offset=({ox:.0f},{oy:.0f}) "
        f"ncc={score:.3f}{mirror}{flag}"
    )
    return


if __name__ == "__main__":
    for i in (1, 2, 3, 4):
        if not SOURCES[i].exists():
            raise SystemExit(f"missing colour source: {SOURCES[i]}")
        build(i)
