// apps/dler/src/cmds/unused/cmd.ts

import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";
import { findUnusedDependencies } from "./impl";

export default defineCommand({
  description: "Find unused dependencies in package.json files",
  options: {
    // Target package selection
    target: option(type("string | undefined"), {
      short: "t",
      description:
        "Target workspace package(s) (from workspaces.packages). Use '.' for current directory package. Supports multiple packages (space-separated) and glob patterns.",
    }),
    package: option(type("string | undefined"), {
      description:
        "Target workspace package(s) (alias for --target). Use '.' for current directory package. Supports multiple packages (space-separated) and glob patterns.",
    }),
    pkg: option(type("string | undefined"), {
      description:
        "Target workspace package(s) (alias for --target). Use '.' for current directory package. Supports multiple packages (space-separated) and glob patterns.",
    }),
    w: option(type("boolean | undefined"), {
      description: "Check unused dependencies in root package.json",
    }),

    // Scope filtering
    scope: option(type("'dev'|'prod'|'peer'|'optional' | undefined"), {
      short: "s",
      description:
        "Check specific dependency scope: dev, prod, peer, optional. If not specified, checks all scopes.",
    }),
    dev: option(type("boolean | undefined"), {
      short: "D",
      description: "Check only devDependencies (shorthand for --scope dev)",
    }),
    prod: option(type("boolean | undefined"), {
      short: "P",
      description: "Check only dependencies (shorthand for --scope prod)",
    }),
    peer: option(type("boolean | undefined"), {
      short: "R",
      description: "Check only peerDependencies (shorthand for --scope peer)",
    }),
    optional: option(type("boolean | undefined"), {
      short: "O",
      description: "Check only optionalDependencies (shorthand for --scope optional)",
    }),

    // Analysis options
    ignore: option(type("string | undefined"), {
      short: "i",
      description:
        "Comma-separated list of package names to ignore when checking for unused dependencies",
    }),
    includePeer: option(type("boolean | undefined"), {
      description: "Include peerDependencies in the analysis (default: false)",
      default: false,
    }),

    // Other options
    cwd: option(type("string | undefined"), {
      description: "Working directory (monorepo root)",
    }),
    verbose: option(type("boolean | undefined"), {
      short: "v",
      description: "Verbose output",
    }),
  },
  handler: async ({ flags }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime.");
        logger.error("Please run this command using Bun: bun dler unused");
        process.exit(1);
      }

      // Show command start
      logger.log("🔍 Finding unused dependencies...");

      // Resolve dependency scope
      let scope: "dev" | "prod" | "peer" | "optional" | undefined;

      if (flags.scope) {
        scope = flags.scope;
      } else if (flags.dev) {
        scope = "dev";
      } else if (flags.peer) {
        scope = "peer";
      } else if (flags.optional) {
        scope = "optional";
      }

      // Parse ignore list
      const ignoreList = flags.ignore
        ? flags.ignore
            .split(",")
            .map((pkg) => pkg.trim())
            .filter(Boolean)
        : undefined;

      const options = {
        target: flags.target || flags.package || flags.pkg,
        w: flags.w,
        scope,
        ignore: ignoreList,
        includePeer: flags.includePeer ?? false,
        cwd: flags.cwd || undefined,
        verbose: flags.verbose ?? false,
      };

      await findUnusedDependencies(options);
    } catch (error) {
      logger.error("\n❌ Failed to find unused dependencies:");

      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(String(error));
      }

      logger.log("");
      logger.log("💡 Tips:");
      logger.log("  • Ensure you're in a valid project directory with package.json");
      logger.log("  • Use --verbose flag for more detailed output");
      logger.log("  • Use --ignore flag to exclude specific packages from analysis");

      process.exit(1);
    }
  },
});
