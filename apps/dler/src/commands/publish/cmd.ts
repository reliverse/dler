// Note on `bun publish` and `bun tsc`: we don't display npm/tsc raw output, because both are not reliable for concurrent display, so we display them on our own.

import type { BumpType } from "@reliverse/bump";
import {
  type PackageKind,
  type PublishOptions,
  publishAllPackages,
  type RegistryType,
} from "@reliverse/publish";
import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { z } from "zod";

export default defineCommand({
  name: "publish",
  description:
    "Publish packages to npm, JSR, Vercel, or multiple registries. Supports version bumping, dist-tags, access control, and concurrent publishing. Automatically loads .env files for authentication. Works with dler.ts configuration for per-package settings.",
  options: {
    ignore: option(
      z.string().optional(),
      {
        description: "Package(s) to ignore (supports wildcards like @reliverse/*)",
      },
    ),
    filter: option(
      z.string().optional(),
      {
        description:
          "Package(s) to include (supports wildcards and comma-separated values like 'rempts,@reliverse/build'). Takes precedence over --ignore when both are provided.",
      },
    ),
    cwd: option(
      z.string().optional(),
      {
        description: "Working directory (monorepo root)",
      },
    ),
    bump: option(
      z.string().optional(),
      {
        description:
          "Version bump type: major, minor, patch, premajor, preminor, prepatch, prerelease (default: patch)",
      },
    ),
    tag: option(
      z.string().optional(),
      {
        description: "npm dist-tag (default: latest)",
      },
    ),
    access: option(
      z.string().optional(),
      {
        description: "Access level: public or restricted (default: public)",
      },
    ),
    dryRun: option(
      z.boolean().default(false),
      {
        description: "Simulate publishing without actually publishing (default: false)",
      },
    ),
    otp: option(
      z.string().optional(),
      {
        description: "One-time password for 2FA authentication",
      },
    ),
    authType: option(
      z.string().optional(),
      {
        description: "Authentication method: web or legacy (default: legacy)",
      },
    ),
    concurrency: option(
      z.coerce.number().optional(),
      {
        description: "Number of packages to publish concurrently (default: 3)",
      },
    ),
    verbose: option(
      z.boolean().default(false),
      {
        description: "Verbose mode (default: false)",
      },
    ),
    registry: option(
      z.string().optional(),
      {
        description: "Registry to publish to: npm, jsr, vercel, npm-jsr, or none (default: npm)",
      },
    ),
    kind: option(
      z.string().optional(),
      {
        description: "Package kind: library, browser-app, native-app, or cli (default: library)",
      },
    ),
    bumpDisable: option(
      z.boolean().default(false),
      {
        description:
          "Disable version bumping for all published packages, overwrites config (default: false)",
      },
    ),
    withNpmLogs: option(
      z.boolean().default(true),
      {
        description:
          "Display bun publish logs directly to terminal instead of hiding them (setting this to false is not recommended) (default: true)",
      },
    ),
    gzipLevel: option(
      z.string().optional(),
      {
        description:
          "Level of gzip compression when packing (0-9, default: 9). Only applies when packing the package.",
      },
    ),
    ca: option(
      z.string().optional(),
      {
        description: "Certificate Authority signing certificate (inline)",
      },
    ),
    cafile: option(
      z.string().optional(),
      {
        description: "Path to Certificate Authority certificate file",
      },
    ),
    ignoreScripts: option(
      z.boolean().default(false),
      {
        description: "Skip lifecycle scripts during packing and publishing (default: false)",
      },
    ),
    silent: option(
      z.boolean().default(false),
      {
        description: "Suppress all output from bun publish (default: false)",
      },
    ),
    noProgress: option(
      z.boolean().default(false),
      {
        description: "Hide progress bar from bun publish (default: false)",
      },
    ),
    noSummary: option(
      z.boolean().default(false),
      {
        description: "Don't print publish summary from bun publish (default: false)",
      },
    ),
    bunRegistry: option(
      z.string().optional(),
      {
        description:
          "Registry URL for bun publish (overrides .npmrc and bunfig.toml). Note: This is different from dler's --registry option which controls which registry type to use.",
      },
    ),
    skipTip2FA: option(
      z.boolean().default(false),
      {
        description:
          "Skip the 2FA tip message and the 3-second wait when using --with-npm-logs (default: false)",
      },
    ),
    stopOnError: option(
      z.boolean().default(false),
      {
        description: "Stop on first error instead of collecting all errors (default: false)",
      },
    ),
  },
  handler: async ({ flags }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      // Reject unsupported auth-type web
      if (flags.authType === "web") {
        logger.error("❌ --auth-type web is not supported. Please use --auth-type legacy instead.");
        process.exit(1);
      }

      // When verbose is false, default to silent, no-progress, and no-summary
      // But allow explicit overrides
      const isVerbose = flags.verbose === true;

      const options: PublishOptions = {
        dryRun: flags.dryRun,
        tag: flags.tag,
        access: flags.access as "public" | "restricted",
        otp: flags.otp,
        authType: (flags.authType as "web" | "legacy") || "legacy",
        verbose: flags.verbose,
        bump: (flags.bump as BumpType) || "patch",
        concurrency: flags.concurrency,
        registry: flags.registry as RegistryType,
        kind: flags.kind as PackageKind,
        bumpDisable: flags.bumpDisable,
        withNpmLogs: flags.withNpmLogs !== undefined ? flags.withNpmLogs : true,
        gzipLevel: flags.gzipLevel,
        ca: flags.ca,
        cafile: flags.cafile,
        ignoreScripts: flags.ignoreScripts,
        silent: flags.silent !== undefined ? flags.silent : !isVerbose,
        noProgress: flags.noProgress !== undefined ? flags.noProgress : !isVerbose,
        noSummary: flags.noSummary !== undefined ? flags.noSummary : !isVerbose,
        bunRegistry: flags.bunRegistry,
        skipTip2FA: flags.skipTip2FA,
      };

      const results = await publishAllPackages(flags.cwd, flags.ignore, {
        ...options,
        filter: flags.filter,
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

      if (flags.verbose) {
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
