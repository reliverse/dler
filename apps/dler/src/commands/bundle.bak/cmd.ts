// apps/dler/src/cmds/build/cmd.ts

import type { BuildOptions } from "@reliverse/build";
import { applyPresets, runBuildOnAllPackages, validateAndExit } from "@reliverse/build";
import type { GoBuildOptions } from "@reliverse/config/impl/build";
import { clearLoggerInternalsInPackages, replaceExportsInPackages } from "@reliverse/helpers";
import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";

export default defineCommand({
  name: "build",
  description:
    "Build all workspace packages using configurable bundler (mkdist for libraries, bun for apps) with dler.ts configuration. Auto-detects frontend apps and libraries. Supports presets: --production, --dev, --library, --react, --node, --monorepo.",
  options: {
    verbose: option(type("boolean"), {
      description: "Verbose mode (default: false)",
    }),
  },
  handler: async ({ flags }) => {
    const verbose = flags.verbose ?? false;
    console.log("Build command temporarily disabled - needs full migration");
  },
});
