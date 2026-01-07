// The command philosophy is: "Find all package.json files, update everything you find, skip only non-updateable specifiers (workspace:, catalog:, npm:, etc.)"

import path from "@reliverse/pathkit";
import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";
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
    ci: option(type("boolean | undefined"), {
      description: msgs.args.ci,
    }),
    cwd: option(type("string | undefined"), {
      description: msgs.args.cwd,
    }),
    name: option(type("string | undefined"), {
      description:
        "Specific dependencies to update, supports glob patterns (e.g. '@types/*', 'react*'). Can be specified multiple times or comma-separated.",
    }),
    ignore: option(type("string | undefined"), {
      description:
        "Dependencies to exclude from updates, supports glob patterns (e.g. 'eslint-*', '@types/*')",
    }),
    dryRun: option(type("boolean"), {
      description: "Preview updates without making changes",
    }),
    install: option(type("boolean"), {
      description: "Run install after updating (default: true)",
      short: "i",
    }),
    allowMajor: option(type("boolean"), {
      description: "Allow major version updates (default: true)",
    }),
    details: option(type("boolean"), {
      description: "Show detailed dependency information (default: false)",
      short: "d",
    }),
    ignoreFields: option(type("string | undefined"), {
      description: "Dependency fields to ignore (e.g., 'peerDependencies,catalog')",
    }),
  },
  handler: async ({ flags }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      // Apply defaults
      const ci = flags.ci ?? (!process.stdout.isTTY || !!process.env.CI);
      const dryRun = flags.dryRun ?? false;
      const install = flags.install ?? true;
      const allowMajor = flags.allowMajor ?? true;
      const details = flags.details ?? false;

      const isDryRun = dryRun;
      const shouldInstall = install;
      const showDetails = details;
      const fieldsToIgnore = flags.ignoreFields
        ? typeof flags.ignoreFields === "string"
          ? flags.ignoreFields.split(",").map((s: string) => s.trim())
          : []
        : [];

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
        const updateArgs: {
          ci?: boolean;
          name?: string[];
          ignore?: string[];
          allowMajor?: boolean;
          dryRun?: boolean;
          install?: boolean;
          ignoreFields?: string[];
        } = {
          ci,
          ...(flags.name && { name: typeof flags.name === "string" ? [flags.name] : flags.name }),
          ...(flags.ignore && {
            ignore: typeof flags.ignore === "string" ? [flags.ignore] : flags.ignore,
          }),
          allowMajor,
          dryRun: isDryRun,
          install: shouldInstall,
          ignoreFields: fieldsToIgnore,
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
      if (shouldInstall) {
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
