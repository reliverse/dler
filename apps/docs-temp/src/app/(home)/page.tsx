import { CodeComparison } from "~/components/landing/code-comparison";
import { CTASection } from "~/components/landing/cta-section";
import { ExamplesShowcase } from "~/components/landing/examples-showcase";
import { FeaturesGrid } from "~/components/landing/features-grid";
import { Hero } from "~/components/landing/hero";
import { QuickStart } from "~/components/landing/quick-start";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <FeaturesGrid />
      <CodeComparison />
      <QuickStart />
      <ExamplesShowcase />
      {/* <Testimonials /> */}
      <CTASection />
    </main>
  );
}
