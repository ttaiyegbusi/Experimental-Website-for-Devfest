import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Both faces are self-hosted rather than pulled from Google, so the headline
// resolves on first paint. A swap would be conspicuous here: the H1 is set to
// land on exact measured line widths, and a fallback face at the same size
// would reflow it visibly.
const facultyGlyphic = localFont({
  src: "./fonts/FacultyGlyphic-Regular.ttf",
  weight: "400",
  style: "normal",
  variable: "--font-display",
  display: "block",
});

const geist = localFont({
  src: "./fonts/Geist-VariableFont_wght.ttf",
  weight: "100 900",
  style: "normal",
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DevFest Lagos — One Ecosystem, Endless Opportunities.",
  description:
    "Join the largest annual tech conference in Africa, hosted by Google Developer Group Lagos (GDG Lagos).",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${facultyGlyphic.variable} ${geist.variable}`}>
        {children}
      </body>
    </html>
  );
}
