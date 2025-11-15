// Note on `bun publish` and `bun tsc`: we don't display npm/tsc raw output, because both are not reliable for concurrent display, so we display them on our own.

import type { BumpType } from "@reliverse/dler-bump";
import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import {
  type PackageKind,
  type PublishOptions,
  publishAllPackages,
  type RegistryType,
} from "@reliverse/dler-publish";

export default defineCommand({
  meta: {
    name: "publish",
    description:
      "Publish packages to npm, JSR, Vercel, or multiple registries. Supports version bumping, dist-tags, access control, and concurrent publishing. Works with dler.ts configuration for per-package settings.",
    examples: [
      "dler publish",
      'dler publish --filter "@reliverse/dler-prompt,@reliverse/dler-build"',
      'dler publish --filter "@reliverse/dler-*"',
      'dler publish --ignore "@reliverse/*"',
      'dler publish --ignore "@reliverse/dler-colors" --ignore "@reliverse/dler-v1"',
      'dler publish --ignore "@reliverse/dler-colors @reliverse/dler-v1"',
      "dler publish --cwd /path/to/monorepo",
      "dler publish --cwd /path/to/monorepo --ignore @reliverse/*",
      "dler publish --bump minor",
      "dler publish --bump major --tag next",
      "dler publish --tag beta --access restricted",
      "dler publish --dry-run",
      "dler publish --dry-run --verbose",
      "dler publish --concurrency 5",
      "dler publish --concurrency 2 --stopOnError",
      "dler publish --ignore @reliverse/* --concurrency 6 --stopOnError",
      "dler publish --verbose",
      "dler publish --verbose --ignore @reliverse/*",
      "dler publish --verbose --concurrency 2 --stopOnError",
      "dler publish --registry jsr",
      "dler publish --registry npm-jsr",
      "dler publish --registry vercel",
      "dler publish --kind browser-app --registry vercel",
      "dler publish --kind native-app --registry none",
      "dler publish --kind cli --registry jsr",
      "dler publish --bumpDisable",
      "dler publish --bumpDisable --dry-run",
      "dler publish --bumpDisable --tag next",
      "",
      "# Configuration Examples:",
      "# Create dler.ts in your monorepo root:",
      "# export default {",
      "#   publish: {",
      "#     global: { access: 'public', tag: 'latest', registry: 'npm', kind: 'library' },",
      "#     packages: { ",
      "#       'my-library': { tag: 'next', bump: 'minor', registry: 'jsr', kind: 'library' },",
      "#       'my-web-app': { registry: 'vercel', kind: 'browser-app' },",
      "#       'my-native-app': { registry: 'none', kind: 'native-app' },",
      "#       'my-cli-tool': { registry: 'npm', kind: 'cli' },",
      "#       'my-library': { bumpDisable: true, tag: 'next' }",
      "#     },",
      "#     patterns: [{ pattern: '*example*', config: { dryRun: true, registry: 'vercel', kind: 'browser-app' } }]",
      "#   }",
      "# }",
      "",
      "# Note: Make sure to run 'dler build' first to:",
      "# - Generate dist folders and declaration files",
      "# - Transform package.json (adds files field, transforms exports, adds bin for CLI)",
      "# The publish command will then handle version bumping and registry publishing",
      "# CLI flags override dler.ts configuration settings",
    ],
  },
  args: defineArgs({
    ignore: {
      type: "string",
      description:
        "Package(s) to ignore (supports wildcards like @reliverse/*)",
    },
    filter: {
      type: "string",
      description:
        "Package(s) to include (supports wildcards and comma-separated values like '@reliverse/dler-prompt,@reliverse/dler-build'). Takes precedence over --ignore when both are provided.",
    },
    cwd: {
      type: "string",
      description: "Working directory (monorepo root)",
    },
    bump: {
      type: "string",
      description:
        "Version bump type: major, minor, patch, premajor, preminor, prepatch, prerelease (default: patch)",
    },
    tag: {
      type: "string",
      description: "npm dist-tag (default: latest)",
    },
    access: {
      type: "string",
      description: "Access level: public or restricted (default: public)",
    },
    dryRun: {
      type: "boolean",
      description:
        "Simulate publishing without actually publishing (default: false)",
    },
    otp: {
      type: "string",
      description: "One-time password for 2FA authentication",
    },
    authType: {
      type: "string",
      description: "Authentication method: web or legacy (default: legacy)",
    },
    concurrency: {
      type: "number",
      description: "Number of packages to publish concurrently (default: 3)",
    },
    verbose: {
      type: "boolean",
      description: "Verbose mode (default: false)",
    },
    registry: {
      type: "string",
      description:
        "Registry to publish to: npm, jsr, vercel, npm-jsr, or none (default: npm)",
    },
    kind: {
      type: "string",
      description:
        "Package kind: library, browser-app, native-app, or cli (default: library)",
    },
    bumpDisable: {
      type: "boolean",
      description:
        "Disable version bumping for all published packages, overwrites config (default: false)",
    },
    withNpmLogs: {
      type: "boolean",
      description:
        "Display bun publish logs directly to terminal instead of hiding them (setting this to false is not recommended) (default: true)",
    },
    gzipLevel: {
      type: "string",
      description:
        "Level of gzip compression when packing (0-9, default: 9). Only applies when packing the package.",
    },
    ca: {
      type: "string",
      description: "Certificate Authority signing certificate (inline)",
    },
    cafile: {
      type: "string",
      description: "Path to Certificate Authority certificate file",
    },
    ignoreScripts: {
      type: "boolean",
      description:
        "Skip lifecycle scripts during packing and publishing (default: false)",
    },
    silent: {
      type: "boolean",
      description: "Suppress all output from bun publish (default: false)",
    },
    noProgress: {
      type: "boolean",
      description: "Hide progress bar from bun publish (default: false)",
    },
    noSummary: {
      type: "boolean",
      description:
        "Don't print publish summary from bun publish (default: false)",
    },
    bunRegistry: {
      type: "string",
      description:
        "Registry URL for bun publish (overrides .npmrc and bunfig.toml). Note: This is different from dler's --registry option which controls which registry type to use.",
    },
    skipTip2FA: {
      type: "boolean",
      description:
        "Skip the 2FA tip message and the 3-second wait when using --with-npm-logs (default: false)",
    },
    stopOnError: {
      type: "boolean",
      description:
        "Stop on first error instead of collecting all errors (default: false)",
    },
  }),
  run: async ({ args }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      // Reject unsupported auth-type web
      if (args.authType === "web") {
        logger.error(
          "❌ --auth-type web is not supported. Please use --auth-type legacy instead.",
        );
        process.exit(1);
      }

      // When verbose is false, default to silent, no-progress, and no-summary
      // But allow explicit overrides
      const isVerbose = args.verbose === true;

      const options: PublishOptions = {
        dryRun: args.dryRun,
        tag: args.tag,
        access: args.access as "public" | "restricted",
        otp: args.otp,
        authType: (args.authType as "web" | "legacy") || "legacy",
        verbose: args.verbose,
        bump: (args.bump as BumpType) || "patch",
        concurrency: args.concurrency,
        registry: args.registry as RegistryType,
        kind: args.kind as PackageKind,
        bumpDisable: args.bumpDisable,
        withNpmLogs: args.withNpmLogs !== undefined ? args.withNpmLogs : true,
        gzipLevel: args.gzipLevel,
        ca: args.ca,
        cafile: args.cafile,
        ignoreScripts: args.ignoreScripts,
        silent: args.silent !== undefined ? args.silent : !isVerbose,
        noProgress:
          args.noProgress !== undefined ? args.noProgress : !isVerbose,
        noSummary: args.noSummary !== undefined ? args.noSummary : !isVerbose,
        bunRegistry: args.bunRegistry,
        skipTip2FA: args.skipTip2FA,
      };

      const results = await publishAllPackages(args.cwd, args.ignore, {
        ...options,
        filter: args.filter,
      });

      // Log warnings (non-fatal)
      if (results.warningCount > 0) {
        for (const result of results.results) {
          if (result.warning) {
            // Use logger.log for private package skips, logger.warn for other warnings
            if (result.warning.includes('"private: true"')) {
              logger.debug(`  ℹ️  ${result.packageName}: ${result.warning}`);
            } else {
              logger.warn(`  ⚠️  ${result.packageName}: ${result.warning}`);
            }
          }
        }
      }

      if (results.hasErrors) {
        logger.error(
          `\n❌ Publishing failed: ${results.errorCount} error(s), ${results.successCount} success(es)`,
        );

        // Log individual errors
        for (const result of results.results) {
          if (!result.success) {
            logger.error(`  ❌ ${result.packageName}: ${result.error}`);
          }
        }

        process.exit(1);
      }

      logger.success("\nAll packages published successfully!");

      if (args.verbose) {
        for (const result of results.results) {
          if (result.success && !result.warning) {
            logger.log(`  ✅ ${result.packageName}@${result.version}`);
          }
        }
      }
    } catch (error) {
      logger.error("\n❌ Publish failed:");

      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(String(error));
      }

      process.exit(1);
    }
  },
});
