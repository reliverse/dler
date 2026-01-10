import Link from "next/link";

import NoiseEffect from "~/ui/components/noise-effect";
import { Button } from "~/ui/primitives/button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background font-mono text-foreground">
      <NoiseEffect />
      <div className="scanlines" />

      <div className="container mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="glitch-text mb-4 font-bold text-6xl" data-text="404">
          404
        </h1>
        <h2 className="mb-6 text-2xl">page not found</h2>
        <p className="mb-8">
          this page is broken.
          <br />
          but broken things are pretty.
          <br />
          sometimes.
        </p>
        <Link href="/">
          <Button className="brutal-button px-6 py-3">go home</Button>
        </Link>
      </div>
    </main>
  );
}
