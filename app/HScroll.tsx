"use client";

import { useCallback, useEffect, useRef } from "react";
import "./HScroll.css";

/* A section that travels sideways while the page scrolls down.

   The page keeps its ordinary vertical scrollbar — nothing is hijacked, no
   wheel events are swallowed, and the keyboard, scrollbar and trackpad all
   behave normally. A tall runway is reserved, a sticky viewport pins inside
   it, and the track's horizontal offset is read off how far through that
   runway the page has scrolled. Scroll up and it runs backwards; land on it
   from a deep link and it is already in the right place.

   Travel is damped rather than bound rigidly to the scroll position, using the
   same follower as the rest of the page, so a trackpad flick eases out instead
   of stopping dead. */

const LAMBDA = 12;

const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

export function HScroll({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const runwayRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const reducedRef = useRef(false);

  /** How far the track must travel: its width minus what is already visible. */
  const distance = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 0;
    return Math.max(0, track.scrollWidth - track.clientWidth);
  }, []);

  const measure = useCallback(() => {
    const runway = runwayRef.current;
    if (!runway) return;
    const d = distance();
    // The runway is as tall as the sideways distance plus one screen, so the
    // horizontal speed roughly matches the vertical speed rather than racing
    // ahead of the finger.
    runway.style.height = `${window.innerHeight + d}px`;

    const r = runway.getBoundingClientRect();
    const travelled = Math.min(Math.max(-r.top, 0), d);
    targetRef.current = travelled;
  }, [distance]);

  const frame = useCallback(
    (now: number) => {
      const track = trackRef.current;
      if (!track) {
        rafRef.current = null;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.001, (now - lastRef.current) / 1000));
      lastRef.current = now;

      xRef.current = reducedRef.current
        ? targetRef.current
        : damp(xRef.current, targetRef.current, LAMBDA, dt);

      track.style.transform = `translate3d(${-xRef.current.toFixed(1)}px,0,0)`;

      // Stop once it has caught up; any scroll starts it again.
      if (Math.abs(xRef.current - targetRef.current) < 0.4) {
        track.style.transform = `translate3d(${-targetRef.current}px,0,0)`;
        xRef.current = targetRef.current;
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    },
    []
  );

  const kick = useCallback(() => {
    if (rafRef.current !== null) return;
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(frame);
  }, [frame]);

  useEffect(() => {
    reducedRef.current =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const onScroll = () => {
      measure();
      kick();
    };
    const onResize = () => {
      measure();
      kick();
    };

    measure();
    kick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [measure, kick]);

  return (
    <div className={`hscroll ${className}`.trim()} ref={runwayRef}>
      <div className="hscroll__sticky">
        <div className="hscroll__track" ref={trackRef}>
          {children}
        </div>
      </div>
    </div>
  );
}
