import { defineCommand } from "@reliverse/prompts";

import { relidler } from "~/libs/sdk/sdk-mod.js";

export default defineCommand({
  meta: {
    name: "cli",
    description: `Runs the @reliverse/relidler`,
  },
  args: {
    /**
     * isDev
     */
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
      required: false,
    },
    /**
     * cliFlags
     */
    bump: {
      type: "string",
      description: "Specify a version to bump to",
      required: false,
    },
    dryRun: {
      type: "boolean",
      alias: "d",
      description: "Run in dry run mode (no actual publish)",
      required: false,
    },
    jsrAllowDirty: {
      type: "boolean",
      description: "Allow publishing from a dirty working directory",
      required: false,
    },
    jsrSlowTypes: {
      type: "boolean",
      description: "Enable slow type-checking for JSR",
      required: false,
    },
    registry: {
      type: "string",
      description: "Select the registry to publish to (npm|jsr|npm-jsr)",
      required: false,
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Enable verbose logging",
      required: false,
    },
    /**
     * argsBuilderConfig
     */
    config: {
      type: "string",
      description: [
        "The configuration file to use relative to the current working directory.",
        "                 Relidler tries to read the config from the build `DIR` by default.",
        "",
      ].join("\n"),
      required: false,
    },
    dir: {
      type: "positional",
      description: "The directory to build",
      required: false,
    },
    minify: {
      type: "boolean",
      description: "Minify build",
      required: false,
    },
    parallel: {
      type: "boolean",
      description:
        "Run different types of builds (untyped, mkdist, rollup, copy) simultaneously",
      required: false,
    },
    sourcemap: {
      type: "boolean",
      description: "Generate sourcemaps (experimental)",
      required: false,
    },
    stub: {
      type: "boolean",
      description: "Stub the package for JIT compilation",
      required: false,
    },
    watch: {
      type: "boolean",
      description: "Watch the src dir and rebuild on change (experimental)",
      required: false,
    },
  },
  run: async ({ args }) => {
    await relidler({ args });
  },
});
