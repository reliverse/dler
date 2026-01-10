// Note on `bun publish` and `bun tsc`: we don't display npm/tsc raw output, because both are not reliable for concurrent display, so we display them on our own.

// release workflow: test → build → version bump → publish → git tag → GitHub release

import type { BumpType } from "@reliverse/bump";
import { loadConfig } from "@reliverse/config";
import {
  type PackageKind,
  type PublishOptions,
  publishAllPackages,
  type RegistryType,
} from "@reliverse/publish";
import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";

// Valid bump types
const BumpType = type(
  "'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease'"
);

// Valid access levels
const AccessType = type("'public' | 'restricted'");

// Valid auth types
const AuthType = type("'web' | 'legacy'");

export default defineCommand({
  description:
    "Publish packages to NPM, JSR (soon), GitHub Releases, Vercel (soon), or multiple registries. Supports version bumping, dist-tags, access control, and concurrent publishing. Automatically loads .env files for authentication. Works with dler.ts configuration for per-package settings.",
  options: {
    ignore: option(type("string | undefined"), {
      description: "Package(s) to ignore (supports wildcards like @reliverse/*)",
    }),
    filter: option(type("string | undefined"), {
      description:
        "Package(s) to include (supports wildcards and comma-separated values like 'rempts,@reliverse/build'). Takes precedence over --ignore when both are provided.",
    }),
    cwd: option(type("string | undefined"), {
      description: "Working directory (monorepo root)",
    }),
    bump: option(BumpType.or(type.undefined), {
      description:
        "Version bump type: major, minor, patch, premajor, preminor, prepatch, prerelease (default: patch)",
    }),
    tag: option(type("string | undefined"), {
      description: "npm dist-tag (default: latest)",
    }),
    access: option(AccessType.or(type.undefined), {
      description: "Access level: public or restricted (default: public)",
    }),
    dryRun: option(type("boolean | undefined"), {
      description: "Simulate publishing without actually publishing (default: false)",
    }),
    otp: option(type("string | undefined"), {
      description: "One-time password for 2FA authentication",
    }),
    authType: option(AuthType.or(type.undefined), {
      description: "Authentication method: web or legacy (default: legacy)",
    }),
    concurrency: option(type("number | undefined"), {
      description: "Number of packages to publish concurrently (default: 3)",
    }),
    verbose: option(type("boolean | undefined"), {
      description: "Verbose mode (default: false)",
    }),
    registry: option(type("string | undefined"), {
      description: "Registry to publish to: npm, jsr, vercel, npm-jsr, or none (default: npm)",
    }),
    kind: option(type("string | undefined"), {
      description: "Package kind: library, browser-app, native-app, or cli (default: library)",
    }),
    bumpDisable: option(type("boolean | undefined"), {
      description:
        "Disable version bumping for all published packages, overwrites config (default: false)",
    }),
    withNpmLogs: option(type("boolean | undefined"), {
      description:
        "Display bun publish logs directly to terminal instead of hiding them (setting this to false is not recommended) (default: true)",
    }),
    gzipLevel: option(type("string | undefined"), {
      description:
        "Level of gzip compression when packing (0-9, default: 9). Only applies when packing the package.",
    }),
    ca: option(type("string | undefined"), {
      description: "Certificate Authority signing certificate (inline)",
    }),
    cafile: option(type("string | undefined"), {
      description: "Path to Certificate Authority certificate file",
    }),
    ignoreScripts: option(type("boolean | undefined"), {
      description: "Skip lifecycle scripts during packing and publishing (default: false)",
    }),
    silent: option(type("boolean | undefined"), {
      description: "Suppress all output from bun publish (default: false)",
    }),
    noProgress: option(type("boolean | undefined"), {
      description: "Hide progress bar from bun publish (default: false)",
    }),
    noSummary: option(type("boolean | undefined"), {
      description: "Don't print publish summary from bun publish (default: false)",
    }),
    bunRegistry: option(type("string | undefined"), {
      description:
        "Registry URL for bun publish (overrides .npmrc and bunfig.toml). Note: This is different from dler's --registry option which controls which registry type to use.",
    }),
    skipTip2FA: option(type("boolean | undefined"), {
      description:
        "Skip the 2FA tip message and the 3-second wait when using --with-npm-logs (default: false)",
    }),
    stopOnError: option(type("boolean | undefined"), {
      description: "Stop on first error instead of collecting all errors (default: false)",
    }),
    // Release options
    release: option(type("boolean | undefined"), {
      description: "Run full release workflow (test, build, version, tag, publish, GitHub)",
    }),
    version: option(type("'patch'|'minor'|'major' | string | undefined"), {
      short: "v",
      description: "Version to release (patch/minor/major/x.y.z) - only used with --release",
    }),
    github: option(type("boolean | undefined"), {
      description: "Create GitHub release - only used with --release",
    }),
    noTest: option(type("boolean | undefined"), {
      description: "Skip tests during release - only used with --release",
    }),
    noBuild: option(type("boolean | undefined"), {
      description: "Skip build during release - only used with --release",
    }),
  },
  handler: async ({ flags }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      // Apply defaults
      const dryRun = flags.dryRun ?? false;
      const verbose = flags.verbose ?? false;
      const bumpDisable = flags.bumpDisable ?? false;
      const withNpmLogs = flags.withNpmLogs ?? true;
      const ignoreScripts = flags.ignoreScripts ?? false;
      const silent = flags.silent ?? false;
      const noProgress = flags.noProgress ?? false;
      const noSummary = flags.noSummary ?? false;
      const skipTip2FA = flags.skipTip2FA ?? false;
      const _stopOnError = flags.stopOnError ?? false;

      // Reject unsupported auth-type web
      if (flags.authType === "web") {
        logger.error("❌ --auth-type web is not supported. Please use --auth-type legacy instead.");
        process.exit(1);
      }

      // When verbose is false, default to silent, no-progress, and no-summary
      // But allow explicit overrides
      const isVerbose = verbose === true;

      // Load config for release options
      const config = await loadConfig(flags.cwd);

      const options: PublishOptions = {
        dryRun,
        tag: flags.tag || "latest",
        access: (flags.access as "public" | "restricted") || "public",
        otp: flags.otp || "",
        authType: (flags.authType as "web" | "legacy") || "legacy",
        verbose,
        bump: (flags.bump as BumpType) || "patch",
        concurrency: flags.concurrency || 3,
        registry: (flags.registry as RegistryType) || "npm",
        kind: (flags.kind as PackageKind) || "library",
        bumpDisable,
        withNpmLogs,
        gzipLevel: flags.gzipLevel || "",
        ca: flags.ca || "",
        cafile: flags.cafile || "",
        ignoreScripts,
        silent: silent !== undefined ? silent : !isVerbose,
        noProgress: noProgress !== undefined ? noProgress : !isVerbose,
        noSummary: noSummary !== undefined ? noSummary : !isVerbose,
        bunRegistry: flags.bunRegistry || "",
        skipTip2FA,
        // Release workflow options
        release: flags.release ?? false,
        test: flags.release ? !flags.noTest : undefined,
        build: flags.release ? !flags.noBuild : undefined,
        github: flags.release ? (flags.github ?? config?.release?.github ?? false) : undefined,
        gitTag: flags.release ? true : undefined,
        version: flags.release ? flags.version : undefined,
      };

      const results = await publishAllPackages(flags.cwd, flags.ignore, {
        ...options,
        filter: flags.filter || "",
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
          `\n❌ Publishing failed: ${results.errorCount} error(s), ${results.successCount} success(es)`
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
