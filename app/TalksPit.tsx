"use client";

/* Ported from the DevFest Lagos 2026 site, where this was built and debugged.
   The engine is unchanged — the notes on Strict Mode, tunnelling and matter's
   MouseConstraint were all paid for once already. Only the markup differs, so
   the pit sits inside this project's section shell.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Body,
  Constraint,
  Engine,
  World,
} from "matter-js";
import { PILLS } from "./pills";
import "./TalksPit.css";

// Pills are real DOM elements — the text stays selectable, searchable and
// crisp — and the physics engine only ever supplies each one a position and an
// angle. Drawing them into a canvas instead would cost all of that for nothing.
//
// matter-js is loaded on demand as the section approaches, so it stays out of
// the initial bundle for anyone who never scrolls this far.

/** Simulated pixels per second squared. */
const GRAVITY = 1.25;
/** Seconds between successive pills entering. */
const DROP_INTERVAL = 0.11;
/** Fixed physics step, ms. Fixed rather than frame-derived, or a slow frame
 *  lets a pill tunnel through the floor. */
const STEP_MS = 1000 / 60;

interface Sim {
  engine: Engine;
  world: World;
  bodies: Body[];
  walls: Body[];
  drag: Constraint;
  M: typeof import("matter-js");
}

export function TalksPit() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const pitRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<(HTMLDivElement | null)[]>([]);
  const simRef = useRef<Sim | null>(null);
  const rafRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  /**
   * Bumped on teardown to invalidate a build that is still awaiting its
   * import. Strict Mode mounts twice, and without this the second mount
   * starts a second world and a second render loop while the first is still
   * resolving — two engines writing to the same pills.
   */
  const genRef = useRef(0);
  const [reduced, setReduced] = useState(false);

  // Lay the pills out statically for anyone who has asked for less motion.
  useEffect(() => {
    setReduced(
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    );
  }, []);

  const teardown = useCallback(() => {
    genRef.current += 1; // invalidate any build still awaiting its import
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    cleanupRef.current?.();
    cleanupRef.current = null;
    const sim = simRef.current;
    if (sim) {
      sim.M.World.clear(sim.world, false);
      sim.M.Engine.clear(sim.engine);
      simRef.current = null;
    }
  }, []);

  const build = useCallback(async () => {
    const pit = pitRef.current;
    if (!pit || simRef.current) return;

    const gen = genRef.current;
    const M = await import("matter-js");
    // Torn down, or superseded, while the import was in flight.
    if (gen !== genRef.current || !pitRef.current || simRef.current) return;

    const { Engine, Bodies, Composite, Constraint, Body, Sleeping, Query } = M;
    const W = pit.clientWidth;
    const H = pit.clientHeight;

    const engine = Engine.create();
    engine.gravity.y = GRAVITY;
    engine.enableSleeping = true;
    const world = engine.world;

    // Walls sit outside the visible box so their edges never show.
    const T = 200;
    const walls = [
      Bodies.rectangle(W / 2, H + T / 2, W + T * 2, T, { isStatic: true }),
      Bodies.rectangle(-T / 2, H / 2, T, H * 3, { isStatic: true }),
      Bodies.rectangle(W + T / 2, H / 2, T, H * 3, { isStatic: true }),
    ];
    Composite.add(world, walls);

    // One body per pill, sized from what the DOM actually measured, so the
    // physics outline matches the rendered pill exactly at any font size.
    const bodies: Body[] = [];
    pillRefs.current.forEach((el, i) => {
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const body = Bodies.rectangle(
        // Spread the entry points across the width, avoiding the very edges.
        W * (0.18 + 0.64 * ((i + 0.5) / PILLS.length)),
        // Stagger above the top so they arrive in a cascade, not a curtain.
        -h - i * (H * 0.55) * DROP_INTERVAL * 6,
        w,
        h,
        {
          // A stadium outline. Full h/2 can degenerate, so stay just inside.
          chamfer: { radius: h / 2 - 1 },
          restitution: 0.42,
          friction: 0.38,
          frictionAir: 0.012,
          density: 0.0014,
          angle: (Math.random() - 0.5) * 0.35,
          sleepThreshold: 90,
        }
      );
      bodies.push(body);
    });
    Composite.add(world, bodies);

    // Dragging uses our own pointer handling rather than matter's
    // MouseConstraint: that binds wheel and touchmove with preventDefault,
    // which stops the page scrolling past this section.
    const drag = Constraint.create({
      pointA: { x: 0, y: 0 },
      // Required up front even though the body is attached on grab: without it
      // Constraint.create dereferences pointB while working out its length.
      pointB: { x: 0, y: 0 },
      stiffness: 0.14,
      damping: 0.12,
      length: 0,
      render: { visible: false },
    });

    simRef.current = { engine, world, bodies, walls, drag, M };

    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__talks = {
        get sim() {
          return simRef.current;
        },
        pit,
      };
    }

    // --- pointer dragging ---
    const local = (e: PointerEvent) => {
      const r = pit.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onDown = (e: PointerEvent) => {
      const sim = simRef.current;
      if (!sim) return;
      const p = local(e);
      const hit = Query.point(sim.bodies, p).pop();
      // Miss? Leave the event alone so the page still scrolls.
      if (!hit) return;
      Sleeping.set(hit, false);
      // Grab offset, expressed in the body's own frame so it rotates with it.
      const dx = p.x - hit.position.x;
      const dy = p.y - hit.position.y;
      const a = -hit.angle;
      sim.drag.bodyB = hit;
      // Constraint.create only records angleA/angleB when the bodies are
      // supplied up front. This one is created empty and given its body on
      // grab, so both stay undefined, and the first solve turns that undefined
      // into NaN and poisons the body's position — the pill stops existing in
      // world space and can never be moved again. Set them alongside the body.
      // angleA/angleB are real runtime fields that @types/matter-js omits.
      const drag = sim.drag as Constraint & { angleA: number; angleB: number };
      drag.angleA = 0; // pointA is a world anchor, so it never rotates
      drag.angleB = hit.angle;
      sim.drag.pointB = {
        x: dx * Math.cos(a) - dy * Math.sin(a),
        y: dx * Math.sin(a) + dy * Math.cos(a),
      };
      sim.drag.pointA = p;
      Composite.add(sim.world, sim.drag);
      pit.setPointerCapture(e.pointerId);
      pit.classList.add("is-grabbing");
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      const sim = simRef.current;
      if (!sim?.drag.bodyB) return;
      sim.drag.pointA = local(e);
      Sleeping.set(sim.drag.bodyB, false);
      e.preventDefault();
    };

    const onUp = (e: PointerEvent) => {
      const sim = simRef.current;
      if (!sim?.drag.bodyB) return;
      Composite.remove(sim.world, sim.drag);
      sim.drag.bodyB = null;
      try {
        pit.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
      pit.classList.remove("is-grabbing");
    };

    pit.addEventListener("pointerdown", onDown);
    pit.addEventListener("pointermove", onMove);
    pit.addEventListener("pointerup", onUp);
    pit.addEventListener("pointercancel", onUp);

    // --- render loop ---
    let acc = 0;
    let last = performance.now();
    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      const sim = simRef.current;
      if (!sim) return;

      // Clamp so a backgrounded tab doesn't try to catch up in one go.
      acc += Math.min(now - last, 100);
      last = now;
      while (acc >= STEP_MS) {
        M.Engine.update(sim.engine, STEP_MS);
        acc -= STEP_MS;
      }

      for (let i = 0; i < sim.bodies.length; i++) {
        const el = pillRefs.current[i];
        const b = sim.bodies[i];
        if (!el) continue;
        el.style.transform = `translate3d(${(
          b.position.x -
          el.offsetWidth / 2
        ).toFixed(1)}px, ${(b.position.y - el.offsetHeight / 2).toFixed(
          1
        )}px, 0) rotate(${b.angle.toFixed(4)}rad)`;
      }
    };
    rafRef.current = requestAnimationFrame(frame);

    cleanupRef.current = () => {
      pit.removeEventListener("pointerdown", onDown);
      pit.removeEventListener("pointermove", onMove);
      pit.removeEventListener("pointerup", onUp);
      pit.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // Start the drop the first time the section comes into view.
  useEffect(() => {
    if (reduced) return;
    const el = sectionRef.current;
    if (!el) return;

    // If the section is already on screen when this mounts — a deep link, a
    // restored scroll position, a short page — build straight away rather than
    // waiting on the observer's first callback, whose timing is not guaranteed
    // and which some embedded browsers never deliver at all.
    const r = el.getBoundingClientRect();
    const onScreen =
      r.top < window.innerHeight * 0.75 && r.bottom > window.innerHeight * 0.25;
    if (onScreen) {
      void build();
      return () => teardown();
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        void build();
      },
      { threshold: 0.25 }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      teardown();
    };
  }, [reduced, build, teardown]);

  // Rebuild on resize — the walls and the pills' own widths both move.
  useEffect(() => {
    if (reduced) return;
    let t = 0;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        if (!simRef.current) return;
        teardown();
        pillRefs.current.forEach((el) => {
          if (el) el.style.transform = "";
        });
        void build();
      }, 250);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [reduced, build, teardown]);

  return (
    <div
      className={`pit${reduced ? " is-static" : ""}`}
      ref={sectionRef as unknown as React.RefObject<HTMLDivElement>}
    >
      <div className="pit__box" ref={pitRef} aria-hidden="true">
        {PILLS.map((p, i) => (
          <div
            key={p.label}
            className="pill"
            ref={(el) => {
              pillRefs.current[i] = el;
            }}
            style={{
              background: p.bg,
              color: p.fg,
              // Until the engine takes over, park them out of sight rather
              // than letting them flash in their document position.
              transform: reduced ? undefined : "translate3d(0,-200vh,0)",
            }}
          >
            {p.label}
          </div>
        ))}
      </div>

      {/* The pills are decorative in the pit; keep the list readable. */}
      <ul className="pit__sr">
        {PILLS.map((p) => (
          <li key={p.label}>{p.label}</li>
        ))}
      </ul>
    </div>
  );
}
