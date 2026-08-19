import { Hero } from "./Hero";
import { About, Experts, Faq, Networking, Pricing, Talks } from "./Sections";

export default function Page() {
  return (
    <>
      <Hero />
      <About />
      {/* What actually happens on the day, before the ask. */}
      <Talks />
      <Experts />
      <Networking />
      <Pricing />
      <Faq />
    </>
  );
}
