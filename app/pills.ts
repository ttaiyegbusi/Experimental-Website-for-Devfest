// The topic pills. Each carries its own fill and text colour — the set mixes
// saturated fills with white text against pale tints with saturated text, and
// one with no fill at all, so the pile reads as varied rather than as a block
// of colour.
//
// These are content, not palette. The three-colour rule that governs the page
// (yellow, white, black) is about the grounds the sections sit on; the pill
// cloud is meant to look like a spread of different industries, which is the
// whole point of the section.

export interface Pill {
  label: string;
  /** Fill. `transparent` renders as an outline-less, text-only pill. */
  bg: string;
  fg: string;
}

export const PILLS: Pill[] = [
  // The four from the newer mock-up, which the earlier set did not have.
  { label: "Ui Design", bg: "#fbd5da", fg: "#9f1239" },
  { label: "Motion Design", bg: "#fdebc8", fg: "#92400e" },
  { label: "SAAS", bg: "#d6ecfb", fg: "#075985" },
  { label: "Compliance", bg: "#ded5fb", fg: "#6d28d9" },

  { label: "Product Management", bg: "#3b5bf6", fg: "#ffffff" },
  { label: "Blockchain", bg: "#22bf68", fg: "#ffffff" },
  { label: "Mobile Development", bg: "#8b5cf6", fg: "#ffffff" },
  { label: "Machine Learning", bg: "#ece9fe", fg: "#7c3aed" },
  { label: "Data Analysis", bg: "#f97316", fg: "#ffffff" },
  { label: "AI", bg: "#8e8e8e", fg: "#ffffff" },
  { label: "Fintech", bg: "#111111", fg: "#ffffff" },
  { label: "Cloud & DevOps", bg: "#d3f8e2", fg: "#16a34a" },
  { label: "Cybersecurity", bg: "#f5b400", fg: "#ffffff" },
  { label: "Product Design", bg: "transparent", fg: "#f5b400" },
  { label: "Design Engineering", bg: "#dee7ff", fg: "#3b5bf6" },
  { label: "Engineering", bg: "#ffe4e6", fg: "#ef4444" },

  // A second wave, so the pit fills rather than settling into one thin layer.
  // Same principle as above: saturated fills with white text alternating with
  // pale tints carrying saturated text, and a few unfilled outlines.
  { label: "Firebase", bg: "#ffca28", fg: "#3e2723" },
  { label: "Flutter", bg: "#0468d7", fg: "#ffffff" },
  { label: "Kotlin", bg: "#f3e8ff", fg: "#7e22ce" },
  { label: "Android", bg: "#3ddc84", fg: "#0b3d20" },
  { label: "Web Performance", bg: "transparent", fg: "#3b5bf6" },
  { label: "Accessibility", bg: "#0f766e", fg: "#ffffff" },
  { label: "Design Systems", bg: "#fde68a", fg: "#78350f" },
  { label: "Developer Advocacy", bg: "#ede9fe", fg: "#5b21b6" },
  { label: "Open Source", bg: "#111111", fg: "#ffffff" },
  { label: "Gemini", bg: "#4285f4", fg: "#ffffff" },
  { label: "Prompt Engineering", bg: "#fee2e2", fg: "#b91c1c" },
  { label: "Data Engineering", bg: "#0891b2", fg: "#ffffff" },
  { label: "Startups", bg: "#fed7aa", fg: "#9a3412" },
  { label: "Technical Writing", bg: "transparent", fg: "#16a34a" },
  { label: "AR / VR", bg: "#7c3aed", fg: "#ffffff" },
  { label: "Robotics", bg: "#e2e8f0", fg: "#334155" },
  { label: "Payments", bg: "#22c55e", fg: "#ffffff" },
  { label: "Career Growth", bg: "#fce7f3", fg: "#be185d" },
];
