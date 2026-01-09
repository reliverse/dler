"use client";

import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

const traditionalCode = `// 50+ lines of boilerplate
const yargs = require('yargs')
const { hideBin } = require('yargs/helpers')

yargs(hideBin(process.argv))
  .command('serve [port]', 'start server', (yargs) => {
    return yargs
      .positional('port', {
        describe: 'port to bind',
        default: 5000,
        type: 'number'
      })
  }, (argv) => {
    // No type safety
    console.log(\`Server on \${argv.port}\`)
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging'
  })
  .parse()`;

const remptsCode = `// Clean and type-safe
import { defineCommand, option } from '@rempts/core'
import { z } from 'zod'

export default defineCommand({
  name: 'serve',
  description: 'Start the server',
  options: {
    port: option(
      z.coerce.number().default(5000),
      { description: 'Port to bind', short: 'p' }
    ),
    verbose: option(
      z.coerce.boolean().default(false),
      { description: 'Run with verbose logging', short: 'v' }
    )
  },
  handler: ({ flags }) => {
    // flags.port is number
    // flags.verbose is boolean
    console.log(\`Server on \${flags.port}\`)
  }
})`;

export function CodeComparison() {
  const [activeTab, setActiveTab] = useState("rempts");

  return (
    <section className="px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="font-bold text-3xl tracking-tight sm:text-4xl">See the Difference</h2>
          <p className="mt-4 text-lg text-muted-foreground">Less boilerplate, more productivity</p>
        </div>

        <div className="mx-auto max-w-5xl">
          <Tabs className="w-full" onValueChange={setActiveTab} value={activeTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="traditional">Traditional CLI</TabsTrigger>
              <TabsTrigger value="rempts">With Rempts</TabsTrigger>
            </TabsList>

            <TabsContent className="mt-6" value="traditional">
              <div className="overflow-hidden rounded-lg border bg-card">
                <div className="flex items-center gap-2 border-b px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                  </div>
                  <span className="ml-2 text-muted-foreground text-sm">traditional-cli.js</span>
                </div>
                <DynamicCodeBlock code={traditionalCode} lang="javascript" />
              </div>
            </TabsContent>

            <TabsContent className="mt-6" value="rempts">
              <div className="overflow-hidden rounded-lg border bg-card">
                <div className="flex items-center gap-2 border-b px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                  </div>
                  <span className="ml-2 text-muted-foreground text-sm">rempts-cli.ts</span>
                </div>
                <DynamicCodeBlock code={remptsCode} lang="typescript" />
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/30 p-6 text-center">
              <div className="font-bold text-4xl text-primary">80%</div>
              <div className="mt-2 text-muted-foreground text-sm">Less boilerplate</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-6 text-center">
              <div className="font-bold text-4xl text-primary">100%</div>
              <div className="mt-2 text-muted-foreground text-sm">Type safe</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-6 text-center">
              <div className="font-bold text-4xl text-primary">10x</div>
              <div className="mt-2 text-muted-foreground text-sm">Faster development</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
