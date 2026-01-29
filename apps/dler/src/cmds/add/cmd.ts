// apps/dler/src/cmds/add/cmd.ts

import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { addDependency } from "./impl";

export default defineCommand({
  description: "Add dependencies to package.json files with catalog support",
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
      description: "Add dependency to root package.json",
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
      description: "Add as devDependency (shorthand for --scope dev)",
    }),
    prod: option(type("boolean | undefined"), {
      short: "P",
      description: "Add as dependency (shorthand for --scope prod)",
    }),
    peer: option(type("boolean | undefined"), {
      short: "R",
      description: "Add as peerDependency (shorthand for --scope peer)",
    }),
    optional: option(type("boolean | undefined"), {
      short: "O",
      description: "Add as optionalDependency (shorthand for --scope optional)",
    }),

    // Version prefix
    prefix: option(type("string | undefined"), {
      short: "p",
      description: "Version prefix (default: '^')",
    }),

    // Other options
    install: option(type("boolean | undefined"), {
      description: "Run install after adding dependencies (default: true)",
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
        logger.error("Please run this command using Bun: bun dler add <package>");
        process.exit(1);
      }

      // Validate arguments
      if (positional.length === 0) {
        logger.error("❌ No package names provided.");
        logger.log("Usage: dler add <package> [package2...] [options]");
        logger.log("");
        logger.log("Examples:");
        logger.log("  dler add lodash");
        logger.log("  dler add typescript --dev");
        logger.log("  dler add react react-dom --target @scope/ui");
        process.exit(1);
      }

      // Show command start
      const packageList = positional.join(", ");
      logger.log(`📦 Adding dependencies: ${packageList}`);
      if (flags.dryRun) {
        logger.log("🔍 Running in dry-run mode (no changes will be made)");
      }

      // Parse package names and versions
      const packageSpecs: Array<{ name: string; versionSpec?: string }> = [];

      for (const packageArg of positional) {
        // Parse package name and version (e.g., "@scope/package@next" -> "@scope/package", "next")
        // Split on the last @ to handle scoped packages correctly
        const lastAtIndex = packageArg.lastIndexOf("@");
        let packageName: string;
        let versionSpec: string | undefined;

        if (lastAtIndex > 0) {
          // Has version specifier (not just a scoped package starting with @)
          packageName = packageArg.substring(0, lastAtIndex);
          versionSpec = packageArg.substring(lastAtIndex + 1);
        } else {
          // No version specifier
          packageName = packageArg;
          versionSpec = undefined;
        }

        packageSpecs.push({ name: packageName, versionSpec });
      }

      const packageNames = packageSpecs.map((spec) => spec.name);
      const packageVersionSpecs = packageSpecs.map((spec) => spec.versionSpec);

      // Resolve dependency scope
      let scope: "dev" | "prod" | "peer" | "optional" = "prod"; // Default to prod

      if (flags.scope) {
        scope = flags.scope;
      } else if (flags.dev) {
        scope = "dev";
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
        prefix: flags.prefix || "^",
        install: flags.install ?? true,
        cwd: flags.cwd || undefined,
        dryRun: flags.dryRun ?? false,
        verbose: flags.verbose ?? false,
        versionSpec: packageVersionSpecs.some((spec) => spec !== undefined)
          ? packageVersionSpecs.filter((spec): spec is string => spec !== undefined)
          : undefined,
      };

      await addDependency(packageNames, options);

      // Success message is handled by the implementation function
    } catch (error) {
      logger.error("\n❌ Failed to add dependencies:");

      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(String(error));
      }

      logger.log("");
      logger.log("💡 Tips:");
      logger.log("  • Check if the package names are spelled correctly");
      logger.log("  • Ensure you're in a valid project directory with package.json");
      logger.log("  • Use --verbose flag for more detailed output");
      logger.log("  • Use --dry-run flag to see what would be changed without making changes");

      process.exit(1);
    }
  },
});
