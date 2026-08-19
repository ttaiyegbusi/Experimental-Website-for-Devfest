"use client";

import { useEffect, useRef } from "react";
import {
  ABOUT_PARAGRAPHS,
  EVENT,
  EXPERTS,
  FAQS,
  NETWORKING,
  SPECIFICS,
  STATS,
  TALKS,
  TIERS,
} from "./content";
import { HScroll } from "./HScroll";
import { TalksPit } from "./TalksPit";
import "./Sections.css";

/* Reveal on scroll. One observer per section rather than one per element: it
   adds `is-in` to the section, and the CSS staggers the children from there,
   so nothing needs a per-item observer or an inline delay.

   It unobserves after firing — these are entrances, not something that should
   replay every time you scroll back up, which quickly becomes seasick. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No observer at all under reduced motion: the CSS already shows
    // everything, and adding the class would only start transitions.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.in = "true";
      return;
    }
    if (!("IntersectionObserver" in window)) {
      el.dataset.in = "true";
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.dataset.in = "true";
          io.unobserve(el);
        }
      },
      // Fires a little before the section is fully in view, so the motion has
      // finished by the time it is properly on screen.
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}

function SectionHead({
  label,
  title,
  id,
}: {
  label: string;
  title: React.ReactNode;
  id: string;
}) {
  return (
    <header className="sec__head">
      <p className="sec__label reveal-item">{label}</p>
      <h2 className="sec__title reveal-item" id={`${id}-title`}>
        {title}
      </h2>
    </header>
  );
}

export function About() {
  const ref = useReveal<HTMLElement>();
  return (
    <section
      className="sec sec--about"
      id="about"
      ref={ref}
      aria-labelledby="about-title"
    >
      <div className="sec__inner">
        <SectionHead
          label="About"
          id="about"
          title="A conference the community builds for itself."
        />

        <div className="sec__body">
          {ABOUT_PARAGRAPHS.map((p) => (
            <p className="reveal-item" key={p.slice(0, 24)}>
              {p}
            </p>
          ))}
          <p className="sec__meta reveal-item">
            {SPECIFICS.dateLine} &middot; {SPECIFICS.venue} &middot; {EVENT.city}
          </p>
        </div>

        {/* The white gridded card echoes the panel behind the speakers. */}
        <dl className="stats reveal-item">
          {STATS.map((s) => (
            <div className="stats__item" key={s.label}>
              <dt className="stats__label">{s.label}</dt>
              <dd className="stats__value">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function Pricing() {
  const ref = useReveal<HTMLElement>();
  return (
    <section
      className="sec sec--pricing"
      id="pricing"
      ref={ref}
      aria-labelledby="pricing-title"
    >
      <div className="sec__inner">
        <SectionHead label="Pricing" id="pricing" title="Three ways in." />

        <ul className="tiers">
          {TIERS.map((t) => (
            <li
              className={`tier reveal-item${t.featured ? " tier--featured" : ""}`}
              key={t.name}
            >
              {t.featured && <p className="tier__flag">Most popular</p>}
              <h3 className="tier__name">{t.name}</h3>
              <p className="tier__price">{t.price}</p>
              <p className="tier__summary">{t.summary}</p>
              <ul className="tier__perks">
                {t.perks.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <a className="tier__cta" href="#tickets">
                Buy Ticket
              </a>
            </li>
          ))}
        </ul>

        <p className="sec__note reveal-item" id="tickets">
          Tickets are sold through the GDG Lagos event page. Student pricing
          requires a valid school email or student ID at check-in.
        </p>
      </div>
    </section>
  );
}

export function Faq() {
  const ref = useReveal<HTMLElement>();
  return (
    <section
      className="sec sec--faq sec--last"
      id="faq"
      ref={ref}
      aria-labelledby="faq-title"
    >
      <div className="sec__inner">
        <SectionHead label="FAQ" id="faq" title="The things people ask." />

        {/* <details> rather than a scripted accordion: keyboard and
            screen-reader accessible with no JavaScript, and it still works if
            the bundle never loads. */}
        <div className="faq">
          {FAQS.map((f) => (
            <details className="faq__item reveal-item" key={f.q}>
              <summary className="faq__q">
                {f.q}
                <span className="faq__mark" aria-hidden="true" />
              </summary>
              <div className="faq__a">
                <p>{f.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---- what to expect ------------------------------------------------------ */

/* The heading, standfirst and label repeat across all three, so they share one
   block rather than three near-identical copies. */
function ExpectHead({ s }: { s: { label: string; title: string; body: string } }) {
  return (
    <div className="expect__head">
      <p className="sec__label reveal-item">{s.label}</p>
      <h2 className="expect__title reveal-item">{s.title}</h2>
      <p className="expect__body reveal-item">{s.body}</p>
    </div>
  );
}

export function Talks() {
  const ref = useReveal<HTMLElement>();
  return (
    <section className="sec sec--talks expect" id="talks" ref={ref}>
      <div className="sec__inner expect__inner">
        <ExpectHead s={TALKS} />
      </div>

      {/* The pit sits outside the 1000px column deliberately: the pile should
          use the whole width of the window, not stack into a narrow strip with
          empty margins either side of it.

          The pills are not laid out — they are dropped. Each is a real DOM
          element that matter-js only ever hands a position and an angle, so
          the text stays selectable and crisp, and they can be thrown around
          once they land. */}
      <TalksPit />
    </section>
  );
}

export function Experts() {
  const ref = useReveal<HTMLElement>();
  const tiles = Array.from({ length: EXPERTS.count }, (_, i) => i + 1);
  return (
    <section className="sec sec--experts expect" id="experts" ref={ref}>
      <div className="sec__inner">
        <ExpectHead s={EXPERTS} />
      </div>

      {/* The faces travel sideways while the page scrolls down, so this stretch
          reads across rather than continuing to stack. The page keeps its own
          scrollbar — see HScroll: nothing is hijacked.

          Greyscale at rest, colour on hover — the same idea as the hero
          montage. Decorative: the names are not listed, so alt is empty and
          the strip is hidden from assistive tech. */}
      <HScroll className="experts__rail">
        <ul className="strip" aria-hidden="true">
          {tiles.map((n) => (
            <li className="strip__cell" key={n}>
              <img
                className="grid__img"
                src={`/speakers/speaker-${String(n).padStart(2, "0")}.webp`}
                alt=""
                width={234}
                height={250}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </li>
          ))}
        </ul>
      </HScroll>
    </section>
  );
}

export function Networking() {
  const ref = useReveal<HTMLElement>();
  return (
    <section className="sec sec--networking expect" id="networking" ref={ref}>
      <div className="sec__inner expect__inner">
        <ExpectHead s={NETWORKING} />

        <ol className="points">
          {NETWORKING.points.map((pt, i) => (
            <li className="points__item reveal-item" key={pt.heading}>
              <span className="points__num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="points__heading">{pt.heading}</h3>
              <p className="points__copy">{pt.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
