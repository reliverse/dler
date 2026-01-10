"use client";

import { ArrowRight, Check, Copy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "~/components/ui/button";

const steps = [
  {
    title: "Install Rempts",
    command: "bun add @rempts/core",
    description: "Add Rempts to your project",
  },
  {
    title: "Create your first command",
    command: "bun create @reliverse/rempts my-cli",
    description: "Scaffold a new CLI project",
  },
  {
    title: "Run it",
    command: "bun run my-cli",
    description: "Start building immediately",
  },
];

export function QuickStart() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <section className="bg-muted/30 px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center font-bold text-3xl tracking-tight">
            Start Building in 30 Seconds
          </h2>

          <div className="space-y-8">
            {steps.map((step, index) => (
              <div className="flex gap-4" key={index}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 font-semibold">{step.title}</h3>
                  <div className="group relative rounded-lg border bg-card p-4 transition-all hover:border-primary/50">
                    <code className="text-sm">{step.command}</code>
                    <button
                      aria-label="Copy command"
                      className="absolute top-1/2 right-3 -translate-y-1/2 p-2 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => copyToClipboard(step.command, index)}
                    >
                      {copiedIndex === index ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-muted-foreground text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/docs/libs/rempts/getting-started">
              <Button className="gap-2" size="lg" variant="outline">
                Read the Full Guide
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
