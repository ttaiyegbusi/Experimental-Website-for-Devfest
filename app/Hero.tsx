"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DevFestLogo } from "./DevFestLogo";
import "./Hero.css";

// The rotating half of the headline. "Ecosystem" leads because that is the
// resting state the reference screenshot was measured against — the hero has
// to match it on first paint, before the cycle has moved.
const WORDS = [
  "Ecosystem",
  "Community",
  "Event",
  "Place",
  "Experience",
  "Network",
];

const HOLD_MS = 2600;
const FADE_MS = 260;

// The prompt cycles through what people actually turn up wanting to know.
// "Ask me anything..." leads for the same reason "Ecosystem" does: it is the
// resting state in the reference.
const QUESTIONS = [
  "Ask me anything...",
  "What is DevFest?",
  "When is DevFest happening?",
  "How many days is the event?",
  "Where is it holding?",
  "How much does a ticket cost?",
  "Who is speaking this year?",
];

// Typing is deliberately uneven — a fixed interval reads like a ticker rather
// than someone typing.
const TYPE_MS = 52;
const DELETE_MS = 24;
const QUESTION_HOLD_MS = 1900;
const BETWEEN_MS = 320;

const NAV_LINKS = [
  { label: "About", href: "#about" },
  { label: "Community Board", href: "#community" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

// The montage is a single composed image per slide, not four positioned
// cutouts: the overlap between the figures is part of the artwork, and
// re-deriving it from separate layers would not survive a resize.
const SLIDES = [
  {
    base: "/hero/montage.png",
    alt: "Four DevFest Lagos speakers on stage, cut out and outlined in yellow",
  },
];

// The carousel needs a slide either side of the centre to fill the peeks, so
// with only one montage the same picture is rendered in three slots. Adding
// real slides to SLIDES is then a data change and nothing else: once there are
// three or more, each slot holds a different line-up.
const VIRTUAL = SLIDES.length * Math.ceil(3 / SLIDES.length);
const SLOTS = Array.from({ length: VIRTUAL }, (_, i) => i);

// Distance between neighbouring slide centres, as a fraction of the slide
// width. Measured off the mock: half the centre slide (450) + the 87px gutter
// + half of a 50%-scale neighbour (225) = 762, over a 900px slide.
const STEP_RATIO = 762 / 900;
const PEEK_SCALE = 0.5;

const SPEAKERS = [1, 2, 3, 4] as const;

// Boundaries between the four pointer bands, as a percentage of the montage
// width. Emitted by scripts/compose-montage.py from where the speakers
// actually sit — the midpoints between neighbouring figure centres.
const BANDS = [27.2, 47.6, 69.6];

// Keyboard has no pointer position to read, so focusing the card selects a
// speaker rather than showing nothing.
const KEYBOARD_DEFAULT = 3;

// Where the card sits for each speaker: px from the montage centre at the
// 800px reference stage. The outer two are pulled in from the true figure
// centres (16.6% and 81.9%) so a 330px card stays on the montage.
const CARD_DX = [-224, -97, 58, 224];

// Damping rates, per second. Each animated value chases its target at its own
// rate, and that is where the sequencing comes from — the reveal is quick, the
// scale is slower and heavier, the card is slowest so it visibly joins last.
// No delays, no durations.
const LAMBDA = { reveal: 13, scale: 8, card: 5.5, cardX: 12, carousel: 9 };

// Frame-rate-independent exponential decay toward a target. This is the whole
// trick: it has no notion of a start, an end, or a duration, so changing the
// target mid-flight just bends the motion instead of restarting it.
const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

export function Hero() {
  const [active, setActive] = useState<number | null>(null);

  const revealRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const slideTargetRef = useRef(0); // integer, unbounded — modulo handles wrap
  const dragRef = useRef<{ id: number; x: number; pos: number; moved: boolean } | null>(
    null
  );
  const targetRef = useRef(0); // 0 = nothing selected
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const reducedRef = useRef(false);
  const motionRef = useRef({ p: [0, 0, 0, 0], s: 0, cv: 0, cx: 0, pos: 0 });

  useEffect(() => {
    reducedRef.current =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // The follower loop. It writes plain scalars onto the element as custom
  // properties and lets CSS do all the interpolation; React is never involved
  // in a frame. It stops itself once everything has settled at rest, and any
  // pointer activity starts it again.
  const runFrame = useCallback((now: number) => {
    const el = revealRef.current;
    if (!el) {
      rafRef.current = null;
      return;
    }
    // Clamped so a background tab or a dropped frame cannot teleport values.
    const dt = Math.min(0.05, Math.max(0.001, (now - lastRef.current) / 1000));
    lastRef.current = now;

    const m = motionRef.current;
    const t = targetRef.current;
    const boost = reducedRef.current ? 40 : 1; // effectively instant

    const pTarget = [0, 0, 0, 0];
    if (t) pTarget[t - 1] = 1;
    const sTarget = t ? 1 : 0;
    const cvTarget = t ? 1 : 0;
    // While the card is effectively invisible there is nothing to slide, so it
    // is placed outright — otherwise the first hover would fly it in from
    // wherever the previous speaker left it.
    const cxTarget = t ? CARD_DX[t - 1] : m.cx;

    for (let i = 0; i < 4; i += 1) {
      m.p[i] = damp(m.p[i], pTarget[i], LAMBDA.reveal * boost, dt);
    }
    m.s = damp(m.s, sTarget, LAMBDA.scale * boost, dt);
    m.cv = damp(m.cv, cvTarget, LAMBDA.card * boost, dt);
    m.cx = m.cv < 0.02 ? cxTarget : damp(m.cx, cxTarget, LAMBDA.cardX * boost, dt);

    // --- carousel ---------------------------------------------------------
    // While a finger or pointer is down the position is the drag, not a
    // follower; it only starts chasing again on release.
    if (!dragRef.current) {
      m.pos = damp(m.pos, slideTargetRef.current, LAMBDA.carousel * boost, dt);
    }
    const track = carouselRef.current;
    const stepPx = (track?.offsetWidth ?? 900) * STEP_RATIO;
    for (let j = 0; j < VIRTUAL; j += 1) {
      const node = slideRefs.current[j];
      if (!node) continue;
      // Shortest signed distance from the current position, so slides wrap
      // around the ends instead of running off in one direction.
      let d = (((j - m.pos) % VIRTUAL) + VIRTUAL) % VIRTUAL;
      if (d > VIRTUAL / 2) d -= VIRTUAL;
      const grow = Math.max(0, 1 - Math.abs(d));
      const sc = PEEK_SCALE + (1 - PEEK_SCALE) * grow;
      node.style.transform = `translate3d(${(d * stepPx).toFixed(2)}px,0,0) scale(${sc.toFixed(4)})`;
      node.style.zIndex = String(50 + Math.round(grow * 50));
    }

    // Exponential decay only ever approaches its target, so without this the
    // loop would keep running for the whole time a speaker is hovered, doing
    // arithmetic nobody can see. Once everything is within a rounding error,
    // land on the targets exactly and let the loop stop; any change of target
    // starts it again.
    const eps = 0.0015;
    const settled =
      !dragRef.current &&
      m.p.every((v, i) => Math.abs(v - pTarget[i]) < eps) &&
      Math.abs(m.s - sTarget) < eps &&
      Math.abs(m.cv - cvTarget) < eps &&
      Math.abs(m.cx - cxTarget) < 0.05 &&
      Math.abs(m.pos - slideTargetRef.current) < 0.0005;
    if (settled) {
      m.p = [...pTarget];
      m.s = sTarget;
      m.cv = cvTarget;
      m.cx = cxTarget;
      m.pos = slideTargetRef.current;
    }

    for (let i = 0; i < 4; i += 1) {
      el.style.setProperty(`--p${i + 1}`, m.p[i].toFixed(4));
    }
    el.style.setProperty("--s", m.s.toFixed(4));
    el.style.setProperty("--cv", m.cv.toFixed(4));
    el.style.setProperty("--cx", m.cx.toFixed(2));

    if (settled) {
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(runFrame);
  }, []);

  const kick = useCallback(() => {
    if (rafRef.current !== null) return;
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  const select = useCallback(
    (next: number) => {
      targetRef.current = next;
      setActive((cur) => (cur === (next || null) ? cur : next || null));
      kick();
    },
    [kick]
  );

  // --- carousel controls ---------------------------------------------------

  const [slideIndex, setSlideIndex] = useState(0);
  const centreSlot = ((slideIndex % VIRTUAL) + VIRTUAL) % VIRTUAL;

  const go = useCallback(
    (delta: number) => {
      slideTargetRef.current += delta;
      setSlideIndex(slideTargetRef.current);
      select(0); // the reveal belongs to whichever slide is centre
      kick();
    },
    [kick, select]
  );

  const onCarouselKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  };

  // Drag is the same position value, written directly instead of damped. On
  // release it becomes a target again, with a flick if the throw was quick
  // enough, and the follower carries whatever motion the drag had.
  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      id: e.pointerId,
      x: e.clientX,
      pos: motionRef.current.pos,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    kick();
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const track = carouselRef.current;
    const stepPx = (track?.offsetWidth ?? 900) * STEP_RATIO;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) d.moved = true;
    motionRef.current.pos = d.pos - dx / stepPx;
    kick();
  };

  const onDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!d.moved) return;
    slideTargetRef.current = Math.round(motionRef.current.pos);
    setSlideIndex(slideTargetRef.current);
    select(0);
    kick();
  };

  // Which speaker the pointer is over. React state changes only when a band
  // boundary is crossed, and only to drive `data-active` for pointer-events;
  // the motion itself never touches React.
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    const box = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - box.left) / box.width) * 100;
    let next = SPEAKERS.length;
    for (let i = 0; i < BANDS.length; i += 1) {
      if (pct < BANDS[i]) {
        next = i + 1;
        break;
      }
    }
    select(next);
  };

  // --- rotating headline word ---------------------------------------------
  // The line stays centred on the page axis, so a wider word pushes "One" and
  // the comma outwards. Rather than let that jump, the slot's width is
  // animated and the swap happens while the word is at zero opacity — so the
  // only thing moving during the change is the glide, and the new word fades
  // in once the width has settled.
  const [wordIndex, setWordIndex] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);
  const [widths, setWidths] = useState<number[]>([]);
  const measureRef = useRef<HTMLSpanElement>(null);

  const measure = useCallback(() => {
    const el = measureRef.current;
    if (!el) return;
    const next = WORDS.map((w) => {
      el.textContent = w;
      return el.getBoundingClientRect().width;
    });
    el.textContent = "";
    setWidths(next);
  }, []);

  useLayoutEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    // The display face is loaded with `display: block`, so the first
    // measurement can land on the fallback if fonts are still resolving.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let swap: number;
    const tick = window.setInterval(() => {
      setWordVisible(false);
      swap = window.setTimeout(() => {
        setWordIndex((i) => (i + 1) % WORDS.length);
        setWordVisible(true);
      }, FADE_MS);
    }, HOLD_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(swap);
    };
  }, []);

  // --- typed prompt --------------------------------------------------------
  const [typed, setTyped] = useState(QUESTIONS[0]);
  const [promptValue, setPromptValue] = useState("");
  const [promptFocused, setPromptFocused] = useState(false);
  // Kept in refs so pausing on focus and resuming on blur picks up mid-phrase
  // instead of restarting the cycle.
  const questionRef = useRef(0);
  const typedRef = useRef(QUESTIONS[0]);

  const typingIdle = promptFocused || promptValue !== "";

  useEffect(() => {
    if (typingIdle) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let timer: number;
    let cancelled = false;
    let phase: "hold" | "delete" | "type" = "hold";

    const write = (text: string) => {
      typedRef.current = text;
      setTyped(text);
    };

    const step = () => {
      if (cancelled) return;
      if (phase === "hold") {
        phase = "delete";
        timer = window.setTimeout(step, QUESTION_HOLD_MS);
        return;
      }
      if (phase === "delete") {
        const text = typedRef.current;
        if (text.length > 0) {
          write(text.slice(0, -1));
          timer = window.setTimeout(step, DELETE_MS);
        } else {
          questionRef.current = (questionRef.current + 1) % QUESTIONS.length;
          phase = "type";
          timer = window.setTimeout(step, BETWEEN_MS);
        }
        return;
      }
      const target = QUESTIONS[questionRef.current];
      const text = typedRef.current;
      if (text.length < target.length) {
        write(target.slice(0, text.length + 1));
        // Vary the cadence slightly, and rest a beat longer after a space.
        const last = target[text.length];
        timer = window.setTimeout(
          step,
          TYPE_MS + (last === " " ? 70 : 0) + Math.random() * 40
        );
      } else {
        phase = "hold";
        step();
      }
    };

    timer = window.setTimeout(step, QUESTION_HOLD_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [typingIdle]);

  return (
    <main className="page">
      <header className="header">
        <a className="brand" href="#top" aria-label="DevFest Lagos, home">
          <DevFestLogo className="brand__logo" />
        </a>

        <nav className="nav" aria-label="Primary">
          <ul className="nav__list">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a className="nav__link" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a className="nav__ticket" href="#tickets">
            Buy Ticket
          </a>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-heading">
        {/* Screen readers get the canonical sentence once; announcing a
            heading that rewrites itself every few seconds would be hostile,
            so the animated copy is hidden from them. */}
        <h1 className="headline" id="hero-heading">
          <span className="sr-only">One Ecosystem, Endless Opportunities.</span>
          <span aria-hidden="true">
            One{" "}
            <span
              className="headline__accent"
              style={
                widths.length ? { width: `${widths[wordIndex]}px` } : undefined
              }
            >
              <span
                className={`headline__word${wordVisible ? "" : " is-out"}`}
              >
                {WORDS[wordIndex]}
              </span>
            </span>
            ,
            <br />
            Endless Opportunities.
          </span>
          <span
            className="headline__measure"
            ref={measureRef}
            aria-hidden="true"
          />
        </h1>

        {/* The grid, the montage and the heading's descenders all share this
            stage. The grid is inset 33px from the left so its right edge lines
            up with the montage while its left edge does not — that asymmetry
            is in the reference and is deliberate. */}
        {/* The carousel. Each slide carries its own grid and montage; the
            centre one additionally carries the whole hover-reveal machinery,
            because only the slide you are looking at can be interrogated. */}
        <div className="stageband">
          <div
            className="carousel"
            ref={carouselRef}
            role="group"
            aria-roledescription="carousel"
            aria-label="DevFest Lagos speakers"
            tabIndex={0}
            onKeyDown={onCarouselKeyDown}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            {SLOTS.map((slot) => {
              const s = SLIDES[slot % SLIDES.length];
              const isCentre = slot === centreSlot;
              return (
                <div
                  className="slide"
                  key={slot}
                  ref={(el) => {
                    slideRefs.current[slot] = el;
                  }}
                  aria-hidden={!isCentre}
                >
                  <div className="slide__grid" aria-hidden="true" />
                  {isCentre ? (
                      <div
                        className="reveal"
                        ref={revealRef}
                        data-active={active ?? undefined}
                        onPointerMove={onPointerMove}
                        onPointerLeave={() => select(0)}
                      >
                        <div className="reveal__media">
                          <img
                            className="reveal__img"
                            src={s.base}
                            alt={s.alt}
                            width={800}
                            height={344}
                            draggable={false}
                          />

                          {/* One colour layer per speaker, each holding only that
                              speaker's *visible* pixels. A single shared colour montage
                              would not work: a rectangle drawn around one speaker overlaps
                              their neighbours, and clipping the whole montage to it would
                              light those neighbours up too. */}
                          {SPEAKERS.map((n) => (
                            <img
                              key={n}
                              className={`reveal__layer reveal__layer--${n}`}
                              src={`/hero/montage-reveal-${n}.png`}
                              alt=""
                              aria-hidden="true"
                              width={800}
                              height={344}
                              draggable={false}
                            />
                          ))}

                          {SPEAKERS.map((n) => (
                            <div
                              key={n}
                              className={`reveal__frame reveal__frame--${n}`}
                              aria-hidden="true"
                            >
                              <span className="reveal__handle reveal__handle--tl" />
                              <span className="reveal__handle reveal__handle--tr" />
                              <span className="reveal__handle reveal__handle--bl" />
                              <span className="reveal__handle reveal__handle--br" />
                            </div>
                          ))}
                        </div>

                        <a
                          className="reveal__card"
                          href="#explore"
                          onFocus={() => select(targetRef.current || KEYBOARD_DEFAULT)}
                          onBlur={() => select(0)}
                        >
                          <span className="reveal__cardtext">Explore DevFest Lagos</span>
                          <span className="reveal__cardbtn" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path
                                d="M5 12h13m-5-6 6 6-6 6"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        </a>
                      </div>
                  ) : (
                    <div className="reveal reveal--static">
                      <div className="reveal__media">
                        <img
                          className="reveal__img"
                          src={s.base}
                          alt=""
                          aria-hidden="true"
                          width={900}
                          height={388}
                          draggable={false}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              className="carousel__btn carousel__btn--prev"
              onClick={() => go(-1)}
              aria-label="Previous speakers"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M14 6 8 12l6 6"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="carousel__btn carousel__btn--next"
              onClick={() => go(1)}
              aria-label="Next speakers"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m10 6 6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <p className="lede">
          Join the largest annual tech conference in Africa, hosted by Google
          Developer Group Lagos (GDG Lagos).
        </p>

        <form
          className="prompt"
          role="search"
          onSubmit={(e) => e.preventDefault()}
        >
          <span className="prompt__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle
                cx="10.5"
                cy="10.5"
                r="6.75"
                stroke="currentColor"
                strokeWidth="1.75"
              />
              <path
                d="m15.5 15.5 4.75 4.75"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </span>
          {/* The typed line is a sibling overlay rather than the input's own
              placeholder attribute, so it can carry a real blinking caret.
              It is hidden the moment anything is typed. */}
          <span className="prompt__field">
            <input
              className="prompt__input"
              type="search"
              name="q"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onFocus={() => setPromptFocused(true)}
              onBlur={() => setPromptFocused(false)}
              aria-label="Ask me anything about DevFest Lagos"
            />
            {promptValue === "" && (
              <span className="prompt__ghost" aria-hidden="true">
                {typingIdle ? QUESTIONS[0] : typed}
                {!typingIdle && <i className="prompt__caret" />}
              </span>
            )}
          </span>
        </form>
      </section>

      {/* feMorphology gives a true dilation of the cutout's alpha, so the
          stroke follows the silhouette at an even width. Chained drop-shadows
          were the alternative and they scallop at the corners. */}
      <svg className="filters" aria-hidden="true" focusable="false">
        <filter
          id="montage-outline"
          x="-8%"
          y="-8%"
          width="116%"
          height="116%"
          primitiveUnits="userSpaceOnUse"
        >
          <feMorphology
            in="SourceAlpha"
            operator="dilate"
            radius="7"
            result="dilated"
          />
          <feFlood floodColor="#F6B51E" result="yellow" />
          <feComposite in="yellow" in2="dilated" operator="in" result="stroke" />
          <feMerge>
            <feMergeNode in="stroke" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>
    </main>
  );
}
