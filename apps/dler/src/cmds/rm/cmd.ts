// apps/dler/src/cmds/rm/cmd.ts

import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { removeDependency } from "./impl";

export default defineCommand({
  description: "Remove dependencies from package.json files with catalog support",
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
      description: "Remove dependency from root package.json",
    }),

    // Catalog options
    catalog: option(type("string | boolean | undefined"), {
      short: "c",
      description: "Use catalog mode. Can be 'true', 'false', or a catalog name (e.g., 'testing')",
      default: true,
    }),

    // Dependency scope/type
    scope: option(type("'dev'|'prod'|'peer'|'optional' | undefined"), {
      short: "s",
      description: "Dependency scope: dev, prod, peer, optional",
    }),
    dev: option(type("boolean | undefined"), {
      short: "D",
      description: "Remove from devDependencies (shorthand for --scope dev)",
    }),
    prod: option(type("boolean | undefined"), {
      short: "P",
      description: "Remove from dependencies (shorthand for --scope prod)",
    }),
    peer: option(type("boolean | undefined"), {
      short: "R",
      description: "Remove from peerDependencies (shorthand for --scope peer)",
    }),
    optional: option(type("boolean | undefined"), {
      short: "O",
      description: "Remove from optionalDependencies (shorthand for --scope optional)",
    }),

    // Other options
    install: option(type("boolean | undefined"), {
      description: "Run install after removing dependencies (default: true)",
      short: "i",
      default: true,
    }),
    cwd: option(type("string | undefined"), {
      description: "Working directory (monorepo root)",
    }),
    dryRun: option(type("boolean | undefined"), {
      short: "n",
      description: "Show what would be done without making changes",
    }),
    verbose: option(type("boolean | undefined"), {
      short: "v",
      description: "Verbose output",
    }),
  },
  handler: async ({ flags, positional }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime.");
        logger.error("Please run this command using Bun: bun dler rm <package>");
        process.exit(1);
      }

      // Validate arguments
      if (positional.length === 0) {
        logger.error("❌ No package names provided.");
        logger.log("Usage: dler rm <package> [package2...] [options]");
        logger.log("");
        logger.log("Examples:");
        logger.log("  dler rm lodash");
        logger.log("  dler rm typescript --dev");
        logger.log("  dler rm react react-dom --target @scope/ui");
        process.exit(1);
      }

      // Show command start
      const packageList = positional.join(", ");
      logger.log(`🗑️  Removing dependencies: ${packageList}`);
      if (flags.dryRun) {
        logger.log("🔍 Running in dry-run mode (no changes will be made)");
      }

      const packageNames = positional;

      // Resolve dependency scope
      // If no scope flags provided, scope will be undefined (remove from all scopes)
      let scope: "dev" | "prod" | "peer" | "optional" | undefined;

      if (flags.scope) {
        scope = flags.scope;
      } else if (flags.dev) {
        scope = "dev";
      } else if (flags.prod) {
        scope = "prod";
      } else if (flags.peer) {
        scope = "peer";
      } else if (flags.optional) {
        scope = "optional";
      }

      // Resolve catalog mode
      let catalogMode: boolean | string = flags.catalog ?? true;

      if (typeof flags.catalog === "string") {
        catalogMode = flags.catalog;
      }

      const options = {
        target: flags.target || flags.package || flags.pkg,
        w: flags.w,
        catalog: catalogMode,
        scope,
        install: flags.install ?? true,
        cwd: flags.cwd || undefined,
        dryRun: flags.dryRun ?? false,
        verbose: flags.verbose ?? false,
      };

      await removeDependency(packageNames, options);

      // Success message is handled by the implementation function
    } catch (error) {
      logger.error("\n❌ Failed to remove dependencies:");

      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(String(error));
      }

      logger.log("");
      logger.log("💡 Tips:");
      logger.log("  • Check if the package names are spelled correctly");
      logger.log("  • Ensure the packages are actually installed");
      logger.log("  • Use --verbose flag for more detailed output");
      logger.log("  • Use --dry-run flag to see what would be changed without making changes");

      process.exit(1);
    }
  },
});
