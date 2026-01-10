"use client";

import { ArrowRight, Github, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";

export function CTASection() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    // Fetch GitHub stars count
    fetch("https://api.github.com/repos/reliverse/dler")
      .then((res) => res.json())
      .then((data) => {
        if (data.stargazers_count) {
          setStars(data.stargazers_count);
        }
      })
      .catch(() => {
        // Fallback to hardcoded value if API fails
        setStars(2300);
      });
  }, []);
  return (
    <section className="bg-muted/30 px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 font-bold text-3xl tracking-tight sm:text-4xl">
            Start Building in 30 Seconds
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Join developers building fast, type-safe CLIs with Rempts
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/docs/libs/rempts/getting-started">
              <Button className="gap-2" size="lg">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="https://github.com/reliverse/dler">
              <Button className="gap-2" size="lg" variant="outline">
                <Github className="h-4 w-4" />
                View on GitHub
              </Button>
            </Link>
          </div>

          {stars && (
            <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Star className="h-4 w-4 fill-current" />
              <span>{(stars / 1000).toFixed(1)}k stars on GitHub</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
