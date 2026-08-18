"use client";

import { useCallback, useEffect, useRef } from "react";
import "./PaperLift.css";

const SEEN_KEY = "devfest:lift-seen";

// Play on every load rather than once per session. A refresh keeps
// sessionStorage, so the once-per-session version only ever runs on the very
// first visit — which makes the animation impossible to iterate on. Set this
// back to true when the timing is settled.
const ONCE_PER_SESSION = false;

// The beat before the sheet goes: it shifts a few pixels, which brings the
// torn edge and its yellow line just into frame, and only then peels. Without
// it the sheet simply drops and the torn edge is never actually read.
const SCORE_MS = 450;

// Followers chasing a target, no durations — the same motion language as the
// rest of the hero. The sheet is dismissed at q > 0.995, which takes
// -ln(0.005)/lambda seconds, so part 1.3 gives ~4.08s of travel and, with the
// hold, an opening of about four and a half seconds.
const LAMBDA = { seam: 4.5, peek: 9, part: 1.3 };

const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

export function PaperLift({ onDone }: { onDone?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const partFromRef = useRef(0);
  const stateRef = useRef({ seam: 0, peek: 0, q: 0 });
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    // Marked seen only once it has actually played through. Writing it up
    // front looks equivalent and is not: React mounts twice in development, so
    // the first mount would set the flag, its cleanup would cancel the
    // animation, and the second mount would read the flag and skip.
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
    el.style.setProperty("--peek", "1");
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
      s.peek = damp(s.peek, 1, LAMBDA.peek, dt);
      if (now >= partFromRef.current) {
        s.q = damp(s.q, 1, LAMBDA.part, dt);
      }
      el.style.setProperty("--seam", s.seam.toFixed(4));
      el.style.setProperty("--peek", s.peek.toFixed(4));
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

    // Server-rendered every time and only then decided on the client. On a
    // skip that would normally flash, but the sheet is the page's own cream,
    // so a frame of cream over cream is invisible.
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

  // Back ply, then seam, then front ply. Each is masked a few pixels higher
  // than the one above it, so the front sheet leaves a band of yellow along
  // the torn edge and the back sheet a darker band beyond that — the paper's
  // thickness against the page.
  return (
    <div className="lift" ref={rootRef} aria-hidden="true">
      <div className="lift__sheet">
        <div className="lift__ply lift__ply--back" />
        <div className="lift__seam" />
        <div className="lift__ply lift__ply--front" />
      </div>
    </div>
  );
}
