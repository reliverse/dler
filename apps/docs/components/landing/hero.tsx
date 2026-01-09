"use client";

import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export function Hero() {
  const code = `import { defineCommand, option } from '@rempts/core'
import { z } from 'zod'

export default defineCommand({
  name: 'greet',
  description: 'Greet someone',
  options: {
    name: option(
      z.string().min(1),
      { description: 'Name to greet', short: 'n' }
    ),
    excited: option(
      z.coerce.boolean().default(false),
      { description: 'Add excitement', short: 'e' }
    )
  },
  handler: async ({ flags }) => {
    const greeting = \`Hello, \${flags.name}\${flags.excited ? '!' : '.'}\`
    console.log(greeting)
  }
})`;

  const terminalOutput = `$ greet --name World --excited
Hello, World!`;

  return (
    <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:px-8">
      {/* Subtle gradient background */}
      <div className="hero-gradient pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <Badge className="mb-4" variant="secondary">
            <Sparkles className="mr-1 h-3 w-3" />
            Built for Bun
          </Badge>
          <h1 className="font-bold text-4xl tracking-tight sm:text-6xl">
            The Minimal CLI Framework <span className="text-primary">for Bun</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-8">
            Type-safe, fast, and delightfully simple. Build production-ready CLIs with zero
            configuration and full TypeScript support.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href="/docs/getting-started">
              <Button className="gap-2" size="lg">
                Start Building
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline">
                View Docs
              </Button>
            </Link>
          </div>
        </div>

        {/* Interactive Code Example */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="grid gap-4">
            {/* Code Display */}
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                </div>
                <span className="ml-2 text-muted-foreground text-sm">greet.ts</span>
              </div>
              <DynamicCodeBlock code={code} lang="typescript" />
            </div>

            {/* Terminal Output */}
            <div className="rounded-lg border bg-black">
              <div className="flex items-center gap-2 border-gray-800 border-b px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                </div>
                <span className="ml-2 text-gray-400 text-sm">Terminal</span>
              </div>
              <div className="p-4">
                <pre className="font-mono text-green-400 text-sm">{terminalOutput}</pre>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-muted-foreground text-sm">
            ✨ Full TypeScript support with automatic type inference
          </p>
        </div>
      </div>
    </section>
  );
}
