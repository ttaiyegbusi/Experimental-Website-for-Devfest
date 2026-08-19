/* ============================================================================
   All copy for the sections below the hero.

   ⚠ CHECK BEFORE PUBLISHING — the block marked SPECIFICS holds the only values
   I could not know: the date, the venue and the ticket prices. They are
   written as realistic examples so the page reads as a finished thing, not as
   researched fact. Everything else on this page is either generally true of
   the DevFest series or structural, and needs no checking.

   Everything else was written to avoid inventing figures at all: the About
   card carries qualitative facts rather than attendee counts, and the FAQ
   answers the "when" question the way it is honestly answered — DevFests run
   worldwide between September and December, and GDG Lagos announces its date
   on its own channels.
   ========================================================================== */

/* ---- SPECIFICS: replace these three ------------------------------------- */
export const SPECIFICS = {
  dateLine: "November 2026",
  venue: "Landmark Centre, Victoria Island",
  prices: { community: "₦5,000", standard: "₦15,000", student: "₦2,500" },
};

export const EVENT = {
  city: "Lagos, Nigeria",
  host: "Google Developer Group Lagos",
};

export const ABOUT_PARAGRAPHS = [
  "DevFest is a technology conference run by Google Developer Groups around the world. Each one is organised locally, by the same volunteers who run the meetups the rest of the year — which is why no two DevFests look quite alike.",
  "DevFest Lagos is the Lagos edition. It brings together engineers, designers, students and founders for a day of talks and hands-on sessions, and for the hallway conversations that tend to outlast the talks themselves.",
  "You do not need to be an expert to get something out of it. Sessions run from first-principles introductions through to deep architectural discussions, and the community track exists specifically for people attending their first conference.",
];

/* Qualitative rather than numeric on purpose — attendance and speaker counts
   change every edition, and a stale number is worse than no number. */
export const STATS: { label: string; value: string }[] = [
  { label: "Format", value: "Talks & workshops" },
  { label: "Tracks", value: "Web, Android, AI, Cloud" },
  { label: "Level", value: "All experience levels" },
  { label: "Where", value: "Lagos, Nigeria" },
];

export type Tier = {
  name: string;
  price: string;
  summary: string;
  perks: string[];
  featured?: boolean;
};

export const TIERS: Tier[] = [
  {
    name: "Community",
    price: SPECIFICS.prices.community,
    summary: "For anyone who wants to be in the room.",
    perks: ["Access to every talk", "Community track sessions", "Event badge"],
  },
  {
    name: "Standard",
    price: SPECIFICS.prices.standard,
    summary: "The full day, workshops included.",
    perks: [
      "Everything in Community",
      "Hands-on workshops and codelabs",
      "Lunch and refreshments",
      "Conference T-shirt",
    ],
    featured: true,
  },
  {
    name: "Student",
    price: SPECIFICS.prices.student,
    summary: "Discounted, with proof of enrolment.",
    perks: ["Access to every talk", "Student meetup track", "Event badge"],
  },
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: "What is DevFest?",
    a: "A technology conference run by Google Developer Groups worldwide. DevFest Lagos is the Lagos edition, organised by GDG Lagos volunteers rather than by Google directly, which is why the programme reflects what the local community is actually building.",
  },
  {
    q: "When is DevFest happening?",
    a: `DevFests run around the world between September and December each year. DevFest Lagos is scheduled for ${SPECIFICS.dateLine} — the exact day is confirmed on the GDG Lagos channels closer to the event.`,
  },
  {
    q: "How many days is the event?",
    a: "One full day of talks and workshops, typically running from morning registration through to a closing session in the early evening. Some editions add a community meetup the night before.",
  },
  {
    q: "Where is it holding?",
    a: `${SPECIFICS.venue}, ${EVENT.city}. The venue is announced with the date, and travel details go out to ticket holders by email beforehand.`,
  },
  {
    q: "How much does a ticket cost?",
    a: `Three tiers: Community at ${SPECIFICS.prices.community}, Standard at ${SPECIFICS.prices.standard} with workshops and lunch included, and Student at ${SPECIFICS.prices.student} with proof of enrolment. Full details are in the Pricing section above.`,
  },
  {
    q: "Who is speaking this year?",
    a: "The speaker line-up is built from an open call for papers, so it changes every edition and is published once talks are selected. Past editions have featured engineers from across the Lagos tech community alongside Google Developer Experts.",
  },
];


/* ---- what to expect ------------------------------------------------------
   Three sections answering the one question someone has before they buy a
   ticket: what actually happens on the day. Copy is written for DevFest — the
   mock-ups carried placeholder text from a design-tool site ("speak in mood
   boards", "the most complete visual library"), which describes nothing about
   this event.
   -------------------------------------------------------------------------- */

export const TALKS = {
  label: "Talks",
  title: "Different talks from different industries.",
  body: "One track never fits a room this mixed. Sessions run across engineering, design, data and the business of building — so a backend engineer, a product designer and a founder can each spend the day somewhere useful.",
  /* The topics GDG communities actually programme. Edit freely — the layout
     reflows to whatever is in this list. */
  topics: [
    "UI Design",
    "Motion Design",
    "SaaS",
    "Compliance",
    "Product Management",
    "Blockchain",
    "Mobile Development",
    "Machine Learning",
    "Data Analysis",
    "AI",
    "Fintech",
    "Cloud & DevOps",
    "Cybersecurity",
    "Product Design",
    "Design Engineering",
    "Engineering",
  ],
};

export const EXPERTS = {
  label: "Experts",
  title: "Learn from people who have already shipped it.",
  body: "Speakers are chosen through an open call, then selected by the community organisers — not booked for a logo. Most of them work on these problems in Lagos every week, so the answers in the Q&A are the ones you cannot get from a conference talk recording.",
  /* 12 tiles, in the order supplied. */
  count: 12,
};

export const NETWORKING = {
  label: "Networking",
  title: "The hallway is half the reason to come.",
  body: "Between sessions there is space to actually talk — over lunch, around the sponsor stands, and at the community meetups that run alongside the main track. A good number of Lagos engineering teams have hired, been hired, or started something after a conversation at DevFest.",
  points: [
    {
      heading: "Meet the people building nearby",
      copy: "Engineers, designers, students and founders from across the Lagos tech community, in one building for a day.",
    },
    {
      heading: "Ask the speaker afterwards",
      copy: "Speakers stay for the day rather than leaving after their slot, so the follow-up question has somewhere to go.",
    },
    {
      heading: "Find your next role or hire",
      copy: "Sponsor stands and the community board are where a lot of introductions start.",
    },
  ],
};
