"use client";

import { useCallback, useEffect, useRef } from "react";
import "./PaperCurtain.css";

const SEEN_KEY = "devfest:curtain-seen";

// The score-then-tear beat. The seam appears first and the sheets hold still
// for this long before parting — it is most of what separates "paper being
// cut" from "two doors opening". Lengthened along with the parting so the
// pause stays in proportion to the travel rather than becoming a hiccup.
const SCORE_MS = 170;

// Same motion language as the rest of the hero: followers chasing a target,
// no durations. Thickness comes from a fixed mask offset in the CSS, not from
// damping the two plies differently.
// part 5 = 99% open in ~0.92s; with the score hold the whole opening is a
// little over a second. The seam is eased off 20 too, so the scored line does
// not snap in ahead of a now-slower tear.
const LAMBDA = { seam: 16, part: 5 };

const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

export function PaperCurtain({ onDone }: { onDone?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const partFromRef = useRef(0);
  const stateRef = useRef({ seam: 0, q: 0 });
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    // Marked seen only once it has actually played through. Writing it up
    // front looks equivalent and is not: React mounts twice in development,
    // so the first mount would set the flag, its cleanup would cancel the
    // animation, and the second mount would read the flag and skip — the
    // curtain would never run.
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage blocked */
    }
    onDoneRef.current?.();
  }, []);

  const open = useCallback((el: HTMLDivElement) => {
    el.style.setProperty("--seam", "1");
    el.style.setProperty("--q", "1");
    el.dataset.done = "true";
  }, []);

  const frame = useCallback(
    (now: number) => {
      const el = rootRef.current;
      if (!el) {
        rafRef.current = null;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.001, (now - lastRef.current) / 1000));
      lastRef.current = now;

      const s = stateRef.current;
      s.seam = damp(s.seam, 1, LAMBDA.seam, dt);
      if (now >= partFromRef.current) {
        s.q = damp(s.q, 1, LAMBDA.part, dt);
      }
      el.style.setProperty("--seam", s.seam.toFixed(4));
      el.style.setProperty("--q", s.q.toFixed(4));

      if (s.q > 0.995) {
        open(el);
        rafRef.current = null;
        finish();
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    },
    [finish, open]
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    // Rendered by the server every time, and only *then* decided on the
    // client. That would normally cause a flash on repeat visits, but the
    // sheets are the page's own cream, so a frame of cream over cream is
    // invisible — which is a large part of why cream was the right choice.
    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage blocked; treat as unseen */
    }

    if (reduced || seen) {
      open(el);
      finish();
      return;
    }

    partFromRef.current = performance.now() + SCORE_MS;
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [frame, finish, open]);

  // Order matters: back ply, then seam, then front ply. Each is masked a few
  // pixels further toward the cut than the one above it, so the front sheet
  // leaves a band of yellow along the tear and the back sheet leaves a darker
  // band beyond that — the paper's thickness against the page.
  return (
    <div className="curtain" ref={rootRef} aria-hidden="true">
      <div className="curtain__side curtain__side--left">
        <div className="curtain__ply curtain__ply--back" />
        <div className="curtain__seam" />
        <div className="curtain__ply curtain__ply--front" />
      </div>
      <div className="curtain__side curtain__side--right">
        <div className="curtain__ply curtain__ply--back" />
        <div className="curtain__seam" />
        <div className="curtain__ply curtain__ply--front" />
      </div>
    </div>
  );
}
