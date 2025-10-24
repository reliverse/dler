#!/usr/bin/env bun

import type { BumpType } from "@reliverse/dler-bump";
import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import {
  type PublishOptions,
  publishAllPackages,
} from "@reliverse/dler-publish";

const publishCmd = async (args: any): Promise<void> => {
  try {
    // Check if running in Bun
    if (typeof process.versions.bun === "undefined") {
      logger.error("❌ This command requires Bun runtime. Sorry.");
      process.exit(1);
    }

    const options: PublishOptions = {
      dryRun: args.dryRun,
      tag: args.tag,
      access: args.access as "public" | "restricted",
      otp: args.otp,
      authType: args.authType as "web" | "legacy",
      verbose: args.verbose,
      bump: args.bump as BumpType,
      concurrency: args.concurrency,
    };

    const results = await publishAllPackages(args.cwd, args.ignore, options);

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

    logger.success(
      `\n✅ All packages published successfully! (${results.successCount} packages)`,
    );

    if (args.verbose) {
      for (const result of results.results) {
        if (result.success) {
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
};

const publishCmdArgs = defineCmdArgs({
  ignore: {
    type: "string",
    description: "Package(s) to ignore (supports wildcards like @reliverse/*)",
  },
  cwd: {
    type: "string",
    description: "Working directory (monorepo root)",
  },
  bump: {
    type: "string",
    description:
      "Version bump type: major, minor, patch, premajor, preminor, prepatch, prerelease",
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
    description: "Authentication method: web or legacy (default: web)",
  },
  concurrency: {
    type: "number",
    description: "Number of packages to publish concurrently (default: 1)",
  },
  verbose: {
    type: "boolean",
    description: "Verbose mode (default: false)",
  },
});

const publishCmdCfg = defineCmdCfg({
  name: "publish",
  description:
    "Publish workspace packages to npm registry using Bun's native publish command. Automatically handles version bumping, package.json modification, and dist folder validation. Supports dler.ts configuration for per-package settings.",
  examples: [
    "dler publish",
    'dler publish --ignore "@reliverse/*"',
    'dler publish --ignore "@reliverse/dler-colors" --ignore "@reliverse/dler-v1"',
    'dler publish --ignore "@reliverse/dler-colors @reliverse/dler-v1"',
    "dler publish --cwd /path/to/monorepo",
    "dler publish --cwd /path/to/monorepo --ignore @reliverse/*",
    "dler publish --bump patch",
    "dler publish --bump minor --tag next",
    "dler publish --bump major --access public",
    "dler publish --dry-run",
    "dler publish --dry-run --verbose",
    "dler publish --tag alpha",
    "dler publish --access restricted",
    "dler publish --otp 123456",
    "dler publish --auth-type legacy",
    "dler publish --concurrency 3",
    "dler publish --verbose",
    "dler publish --bump patch --tag next --dry-run --verbose",
    "dler publish --ignore @reliverse/* --bump minor --concurrency 2",
    "",
    "# Configuration Examples:",
    "# Create dler.ts in your monorepo root:",
    "# export default {",
    "#   publish: {",
    "#     global: { access: 'public', tag: 'latest' },",
    "#     packages: { 'my-package': { tag: 'next', bump: 'minor' } },",
    "#     patterns: [{ pattern: '*example*', config: { dryRun: true } }]",
    "#   }",
    "# }",
    "",
    "# Note: Make sure to run 'dler build' first to generate dist folders",
    "# The command will automatically modify package.json files for publishing",
    "# and ensure packages are published from their dist/ directories",
    "# CLI flags override dler.ts configuration settings",
  ],
});

export default defineCmd(publishCmd, publishCmdArgs, publishCmdCfg);
