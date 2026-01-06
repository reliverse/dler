// The command philosophy is: "Find all package.json files, update everything you find, skip only non-updateable specifiers (workspace:, catalog:, npm:, etc.)"

import { getCurrentWorkingDirectory } from "@reliverse/helpers";
import path from "@reliverse/pathkit";
import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { z } from "zod";
import { msgs } from "../../const";
import {
  checkPackageUpdatesForFile,
  handleInstallation,
  prepareAllUpdateCandidates,
  updatePackageJsonFileDirectly,
  validatePackageJson,
} from "./impl";
import { displayStructuredUpdateResults, type UpdateResult } from "./utils";

export default defineCommand({
  name: "update",
  description:
    "Update all dependencies to their latest versions across all package.json files. Supports selective updates with glob patterns and comprehensive filtering options.",
  options: {
    ci: option(
      z.boolean().default(!process.stdout.isTTY || !!process.env.CI),
      {
        description: msgs.args.ci,
      },
    ),
    cwd: option(
      z.string().default(getCurrentWorkingDirectory()),
      {
        description: msgs.args.cwd,
      },
    ),
    name: option(
      z.string().optional(),
      {
        description:
          "Specific dependencies to update, supports glob patterns (e.g. '@types/*', 'react*'). Can be specified multiple times or comma-separated.",
      },
    ),
    ignore: option(
      z.string().optional(),
      {
        description:
          "Dependencies to exclude from updates, supports glob patterns (e.g. 'eslint-*', '@types/*')",
      },
    ),
    dryRun: option(
      z.boolean().default(false),
      {
        description: "Preview updates without making changes",
      },
    ),
    install: option(
      z.boolean().default(true),
      {
        description: "Run install after updating (default: true)",
        short: "i",
      },
    ),
    allowMajor: option(
      z.boolean().default(true),
      {
        description: "Allow major version updates (default: true)",
      },
    ),
    details: option(
      z.boolean().default(false),
      {
        description: "Show detailed dependency information (default: false)",
        short: "d",
      },
    ),
    ignoreFields: option(
      z.string().optional(),
      {
        description: "Dependency fields to ignore (e.g., 'peerDependencies,catalog')",
      },
    ),
  },
  handler: async ({ flags }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      const { dryRun, install, details, ignoreFields } = flags;
      const isDryRun = Boolean(dryRun);
      const showDetails = Boolean(details);
      const fieldsToIgnore = Array.isArray(ignoreFields) ? ignoreFields : [];

      // Validate package.json exists
      await validatePackageJson();

      // Prepare package.json files
      const { packageJsonFiles, fileDepsMap } = await prepareAllUpdateCandidates();
      if (packageJsonFiles.length === 0) {
        logger.log("No package.json files found");
        return;
      }

      // Process each package.json file independently
      let totalUpdated = 0;
      const allResults: UpdateResult[] = [];

      for (const packageJsonPath of packageJsonFiles) {
        const fileDeps = fileDepsMap.get(packageJsonPath);
        if (!fileDeps) continue;

        // Check updates for this specific file
        const updateArgs = {
          ...args,
          name: flags.name ? (Array.isArray(flags.name) ? flags.name : [flags.name]) : undefined,
          ignore: flags.ignore
            ? Array.isArray(flags.ignore)
              ? flags.ignore
              : [flags.ignore]
            : undefined,
          ignoreFields: flags.ignoreFields
            ? Array.isArray(flags.ignoreFields)
              ? flags.ignoreFields
              : flags.ignoreFields.split(",").map((s) => s.trim())
            : undefined,
        };
        const results = await checkPackageUpdatesForFile(fileDeps, updateArgs);
        allResults.push(...results);

        const toUpdate = results.filter((r: UpdateResult) => r.updated && !r.error);

        if (toUpdate.length > 0) {
          // Exit early for dry run
          if (isDryRun) {
            const relativePath = path.relative(process.cwd(), packageJsonPath);
            logger.debug(`Would update ${toUpdate.length} dependencies in ${relativePath}`);
            continue;
          }

          // Update this specific file
          const updated = await updatePackageJsonFileDirectly(
            packageJsonPath,
            fileDeps,
            toUpdate,
            "^",
            fieldsToIgnore,
          );
          totalUpdated += updated;

          if (updated > 0) {
            const relativePath = path.relative(process.cwd(), packageJsonPath);
            logger.debug(`Updated ${updated} dependencies in ${relativePath}`);
          }
        }
      }

      // Display results in structured format
      displayStructuredUpdateResults(allResults, packageJsonFiles, fileDepsMap, showDetails);

      if (totalUpdated === 0) {
        if (isDryRun) {
          logger.log("Dry run mode - no changes would be made");
        } else {
          logger.log("No dependencies to update");
        }
        return;
      }

      // Display simple summary
      if (packageJsonFiles.length > 1) {
        logger.log(
          `Updated ${totalUpdated} dependencies across ${packageJsonFiles.length} package.json files`,
        );
      } else {
        logger.log(`Updated ${totalUpdated} dependencies`);
      }

      // Handle installation
      if (install) {
        await handleInstallation();
      } else {
        logger.log(
          "Run 'bun install' to apply the changes (use --no-install to skip automatic installation)",
        );
      }
    } catch (error) {
      logger.error(
        `Failed to update dependencies: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  },
});
