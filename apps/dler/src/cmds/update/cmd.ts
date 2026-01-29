// The command philosophy is: "Find all package.json files, update everything you find, skip only non-updateable specifiers (workspace:, catalog:, npm:, etc.)"

import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { msgs } from "../../const";
import {
  checkPackageUpdatesForAllFiles,
  handleInstallation,
  prepareAllUpdateCandidates,
  updatePackageJsonFileDirectly,
  validatePackageJson,
} from "./impl";
import {
  displayStructuredUpdateResults,
  initializeCache,
  prepareDependenciesForUpdate,
  type UpdateResult,
} from "./utils";

export default defineCommand({
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
    dryRun: option(type("boolean | undefined"), {
      short: "n",
      description: "Preview updates without making changes",
    }),
    install: option(type("boolean | undefined"), {
      description: "Run install after updating (default: true)",
      short: "i",
      default: true,
    }),
    allowMajor: option(type("boolean | undefined"), {
      description: "Allow major version updates (default: true)",
    }),
    details: option(type("boolean | undefined"), {
      description: "Show detailed dependency information (default: false)",
      short: "d",
    }),
    ignoreFields: option(type("string | undefined"), {
      description: "Dependency fields to ignore (e.g., 'peerDependencies,catalog')",
    }),
    verbose: option(type("boolean | undefined"), {
      description: "Verbose output (shows install command output)",
      short: "v",
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
      const cwd = flags.cwd;
      const dryRun = flags.dryRun ?? false;
      const install = flags.install;
      // allowMajor defaults to true as per the flag description
      const allowMajor = true;
      const details = flags.details ?? false;
      const verbose = flags.verbose ?? false;

      const isDryRun = dryRun;
      const shouldInstall = install;
      const showDetails = details;
      const isVerbose = verbose;
      const fieldsToIgnore = flags.ignoreFields
        ? typeof flags.ignoreFields === "string"
          ? flags.ignoreFields.split(",").map((s: string) => s.trim())
          : []
        : [];

      // Validate package.json exists
      await validatePackageJson();

      // Initialize persistent cache
      await initializeCache(isVerbose);

      // Prepare package.json files
      // If cwd flag is provided, use it; otherwise limit to current directory if it has package.json
      let effectiveCwd = cwd;
      if (!effectiveCwd) {
        // Check if current directory has a package.json
        const currentDir = process.cwd();
        const hasLocalPackageJson = await fs.pathExists(path.join(currentDir, "package.json"));

        if (hasLocalPackageJson) {
          // We're in a directory with package.json, limit scope to current directory only
          effectiveCwd = ".";
        }
      }
      const { packageJsonFiles, fileDepsMap } = await prepareAllUpdateCandidates(effectiveCwd);
      if (packageJsonFiles.length === 0) {
        logger.log("No package.json files found");
        return;
      }

      // Check updates for each file individually to handle different version specs
      const allUpdateResults: UpdateResult[] = [];
      const updateArgs: {
        ci?: boolean;
        name?: string[];
        ignore?: string[];
        allowMajor?: boolean;
        dryRun?: boolean;
        install?: boolean;
        ignoreFields?: string[];
        concurrency?: number;
      } = {
        ci,
        ...(flags.name && {
          name: typeof flags.name === "string" ? [flags.name] : flags.name,
        }),
        ...(flags.ignore && {
          ignore: typeof flags.ignore === "string" ? [flags.ignore] : flags.ignore,
        }),
        allowMajor,
        dryRun: isDryRun,
        install: shouldInstall,
        ignoreFields: fieldsToIgnore,
        concurrency: 50,
      };

      // Process each file individually
      for (const packageJsonPath of packageJsonFiles) {
        const fileDeps = fileDepsMap.get(packageJsonPath);
        if (!fileDeps) continue;

        // Apply filtering to this file's dependencies
        const filteredDeps = prepareDependenciesForUpdate(fileDeps, {
          name: updateArgs.name,
          ignore: updateArgs.ignore,
          ignoreFields: updateArgs.ignoreFields,
        });

        if (filteredDeps.length === 0) continue;

        // Convert filtered deps to the format expected by checkPackageUpdatesForAllFiles
        const fileDepsMapForCheck = new Map<
          string,
          { versionSpec: string; locations: Set<string>; files: Set<string> }
        >();

        for (const depName of filteredDeps) {
          const depInfo = fileDeps[depName];
          if (depInfo) {
            fileDepsMapForCheck.set(depName, {
              versionSpec: depInfo.versionSpec,
              locations: new Set(depInfo.locations),
              files: new Set([packageJsonPath]),
            });
          }
        }

        // Create args without name/ignore filters since we already filtered
        const filteredUpdateArgs = { ...updateArgs };
        filteredUpdateArgs.name = undefined;
        filteredUpdateArgs.ignore = undefined;

        const fileResults = await checkPackageUpdatesForAllFiles(
          fileDepsMapForCheck,
          filteredUpdateArgs
        );
        allUpdateResults.push(...fileResults);
      }

      // Process results per file in parallel with optimized batching
      const fileUpdatePromises = packageJsonFiles.map(async (packageJsonPath) => {
        const fileDeps = fileDepsMap.get(packageJsonPath);
        if (!fileDeps) return { results: [], updated: 0 };

        // Filter results for this specific file
        const fileResults = allUpdateResults.filter((result) => {
          // Find which file this result belongs to by checking if the package exists in this file's deps
          return fileDeps[result.package] !== undefined;
        });

        const toUpdate = fileResults.filter((r: UpdateResult) => r.updated && !r.error);

        if (toUpdate.length > 0) {
          // Exit early for dry run
          if (isDryRun) {
            const relativePath = path.relative(process.cwd(), packageJsonPath);
            const updateDetails = toUpdate
              .map((update) => `${update.package}→${update.latestVersion}`)
              .join(", ");
            logger.log(
              `Would update ${toUpdate.length} dependencies in ${relativePath}: ${updateDetails}`
            );
            return { results: fileResults, updated: toUpdate.length };
          }

          // Update this specific file with optimized batch processing
          const updated = await updatePackageJsonFileDirectly(
            packageJsonPath,
            fileDeps,
            toUpdate,
            "^",
            fieldsToIgnore
          );

          if (updated > 0) {
            const relativePath = path.relative(process.cwd(), packageJsonPath);
            const updateDetails = toUpdate
              .map((update) => `${update.package}→${update.latestVersion}`)
              .join(", ");
            logger.log(`Updated ${updated} dependencies in ${relativePath}: ${updateDetails}`);
          }

          return { results: fileResults, updated };
        }

        return { results: fileResults, updated: 0 };
      });

      // Execute all file updates in parallel with higher concurrency
      const fileResults = await Promise.allSettled(fileUpdatePromises);

      // Convert results and handle any failures gracefully
      const processedFileResults = fileResults.map((result, index) => {
        if (result.status === "fulfilled") {
          return result.value;
        } else {
          const packageJsonPath = packageJsonFiles[index];
          logger.warn(
            `Failed to process ${packageJsonPath ? path.relative(process.cwd(), packageJsonPath) : `file at index ${index}`}: ${result.reason}`
          );
          return { results: [], updated: 0 };
        }
      });

      // Aggregate results
      let totalUpdated = 0;

      for (const result of processedFileResults) {
        totalUpdated += result.updated;
      }

      // Display results in structured format
      displayStructuredUpdateResults(allUpdateResults, packageJsonFiles, fileDepsMap, showDetails);

      if (totalUpdated === 0) {
        if (isDryRun) {
          logger.log("Dry run mode - no changes would be made");
        } else {
          logger.log("No dependencies to update");
        }
        return;
      }

      // Display simple summary
      const action = isDryRun ? "Would update" : "Updated";
      if (packageJsonFiles.length > 1) {
        logger.log(
          `${action} ${totalUpdated} dependencies across ${packageJsonFiles.length} package.json files`
        );
      } else {
        logger.log(`${action} ${totalUpdated} dependencies`);
      }

      // Handle installation
      if (shouldInstall && totalUpdated > 0 && !isDryRun) {
        await handleInstallation(isVerbose);
      } else if (shouldInstall && totalUpdated === 0) {
        logger.log("No dependencies were updated, skipping install");
      } else if (shouldInstall && totalUpdated > 0 && isDryRun) {
        logger.log("Dry run mode - no changes were made, skipping install");
      } else if (!shouldInstall && totalUpdated > 0) {
        logger.log(
          "Run 'bun install' to apply the changes (use --no-install to skip automatic installation)"
        );
      }
    } catch (error) {
      logger.error(
        `Failed to update dependencies: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  },
});
