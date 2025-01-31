#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import consola from "consola";
import { resolve } from "pathe";

import { build } from "./build.js";

const main = defineCommand({
  meta: {
    name: "@reliverse/bundler",
    version: "1.0.1",
    description: "Bundles your code",
  },
  args: {
    dir: {
      type: "positional",
      description: "The directory to build",
      required: false,
    },
    config: {
      type: "string",
      description: [
        "The configuration file to use relative to the current working directory.",
        "                 Relidler tries to read `build.config` from the build `DIR` by default.",
        "",
      ].join("\n"),
    },
    watch: {
      type: "boolean",
      description: "Watch the src dir and rebuild on change (experimental)",
    },
    stub: {
      type: "boolean",
      description: "Stub the package for JIT compilation",
    },
    minify: {
      type: "boolean",
      description: "Minify build",
    },
    sourcemap: {
      type: "boolean",
      description: "Generate sourcemaps (experimental)",
    },
    parallel: {
      type: "boolean",
      description:
        "Run different types of builds (untyped, mkdist, Rollup, copy) simultaneously.",
    },
  },
  async run({ args }) {
    const rootDir = resolve(process.cwd(), args.dir || ".");
    // @ts-expect-error TODO: fix ts
    await build(rootDir, args.stub, {
      sourcemap: args.sourcemap,
      config: args.config ? resolve(args.config) : undefined,
      stub: args.stub,
      watch: args.watch,
      rollup: {
        esbuild: {
          minify: args.minify,
        },
      },
    }).catch((error) => {
      consola.error(`Error building ${rootDir}: ${error}`);
      throw error;
    });
  },
});

await runMain(main);
