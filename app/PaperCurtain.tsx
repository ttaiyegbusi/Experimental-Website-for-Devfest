"use client";

// NOT CURRENTLY MOUNTED. This was the first opening — two sheets parting along
// a torn seam — replaced by PaperLift because halves meeting in the middle
// read as a stage curtain however the edge is drawn. Kept so the two can be
// compared; swap the import in Hero.tsx to bring it back.

import { useCallback, useEffect, useRef } from "react";
import "./PaperCurtain.css";

const SEEN_KEY = "devfest:curtain-seen";

// Play on every load rather than once per session. A refresh keeps
// sessionStorage, so the once-per-session version only ever ran on the very
// first visit — which makes the animation impossible to iterate on. Set this
// back to true when the timing is settled and it should stop greeting people
// on every navigation.
const ONCE_PER_SESSION = false;

// The score-then-tear beat. The seam appears first and the sheets hold still
// for this long before parting — it is most of what separates "paper being
// cut" from "two doors opening". Kept in proportion to the travel — a short
// pause in front of a slow tear reads as a hiccup rather than a beat.
const SCORE_MS = 350;

// Same motion language as the rest of the hero: followers chasing a target,
// no durations. Thickness comes from a fixed mask offset in the CSS, not from
// damping the two plies differently.
//
// The sheets are considered clear at q > 0.995, which is -ln(0.005)/lambda
// seconds, not the 4.6/lambda that 99% would give — so part 2.0 lands the
// travel at ~2.65s and, with the hold, a three-second opening. The seam is
// eased right off to match: at the old 16 the scored line appeared instantly
// in front of a very slow tear, which drew the eye to the wrong thing.
const LAMBDA = { seam: 6, part: 2.0 };

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
    if (ONCE_PER_SESSION) {
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* storage blocked */
      }
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
    if (ONCE_PER_SESSION) {
      try {
        seen = sessionStorage.getItem(SEEN_KEY) === "1";
      } catch {
        /* storage blocked; treat as unseen */
      }
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
