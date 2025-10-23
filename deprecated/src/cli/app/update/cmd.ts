// The command philosophy is: "Find all package.json files, update everything you find, skip only non-updateable specifiers (workspace:, catalog:, npm:, etc.)"

// usage examples (rse=examples/cli/src/app/update/cmd.ts):
// - bun rse update --dryRun --withInstall
// - bun rse update --name "@types/*" --name "react*"     # glob patterns for selective updates
// - bun rse update --ignore "eslint-*" --ignore "@babel/*"  # ignore patterns
// - bun rse update --no-allowMajor                       # conservative updates only

import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import path from "path";
import {
  checkPackageUpdatesForFile,
  commonEndActions,
  commonStartActions,
  displayStructuredUpdateResults,
  getCurrentWorkingDirectory,
  handleInstallation,
  prepareAllUpdateCandidates,
  type UpdateResult,
  updatePackageJsonFileDirectly,
  validatePackageJson,
} from "../../../mod";
import { type CmdName, msgs } from "../../const";

// Updates ALL dependencies (prod/dev/peer/optional/catalog) to their latest versions across ALL package.json files found in the project
export default defineCommand({
  meta: {
    name: "update" as CmdName,
    description: msgs.cmds.update,
  },
  args: defineArgs({
    // Common args
    ci: {
      type: "boolean",
      description: msgs.args.ci,
      default: !process.stdout.isTTY || !!process.env["CI"],
    },
    cwd: {
      type: "string",
      description: msgs.args.cwd,
      default: getCurrentWorkingDirectory(),
    },
    // Command specific args
    name: {
      type: "array",
      description:
        "Specific dependencies to update, supports glob patterns (e.g. '@types/*', 'react*')",
    },
    ignore: {
      type: "array",
      description:
        "Dependencies to exclude from updates, supports glob patterns (e.g. 'eslint-*', '@types/*')",
    },
    dryRun: {
      type: "boolean",
      description: "Preview updates without making changes",
    },
    install: {
      type: "boolean",
      description: "Run install after updating",
      alias: "i",
    },
    allowMajor: {
      type: "boolean",
      description: "Allow major version updates (default: true)",
      default: true,
    },
    details: {
      type: "boolean",
      description: "Show detailed dependency information (default: false)",
      alias: "d",
    },
    ignoreFields: {
      type: "array",
      description:
        "Dependency fields to ignore (e.g., 'peerDependencies,catalog')",
    },
  }),
  run: async ({ args }) => {
    const { ci, cwd, dryRun, install, details, ignoreFields } = args;
    const isCI = Boolean(ci);
    const cwdStr = String(cwd);
    const isDryRun = Boolean(dryRun);
    const showDetails = Boolean(details);
    const fieldsToIgnore = Array.isArray(ignoreFields) ? ignoreFields : [];

    await commonStartActions({
      isCI,
      isDev: false,
      cwdStr,
      showRuntimeInfo: false,
      clearConsole: false,
      withStartPrompt: false,
    });

    try {
      // Validate package.json exists
      await validatePackageJson();

      // Prepare package.json files
      const { packageJsonFiles, fileDepsMap } =
        await prepareAllUpdateCandidates();
      if (packageJsonFiles.length === 0) {
        relinka("log", "No package.json files found");
        return;
      }

      // Process each package.json file independently
      let totalUpdated = 0;
      const allResults: UpdateResult[] = [];

      for (const packageJsonPath of packageJsonFiles) {
        const fileDeps = fileDepsMap.get(packageJsonPath);
        if (!fileDeps) continue;

        // Check updates for this specific file
        const results = await checkPackageUpdatesForFile(fileDeps, args);
        allResults.push(...results);

        const toUpdate = results.filter(
          (r: UpdateResult) => r.updated && !r.error,
        );

        if (toUpdate.length > 0) {
          // Exit early for dry run
          if (isDryRun) {
            const relativePath = path.relative(process.cwd(), packageJsonPath);
            relinka(
              "verbose",
              `Would update ${toUpdate.length} dependencies in ${relativePath}`,
            );
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
            relinka(
              "verbose",
              `Updated ${updated} dependencies in ${relativePath}`,
            );
          }
        }
      }

      // Display results in structured format
      displayStructuredUpdateResults(
        allResults,
        packageJsonFiles,
        fileDepsMap,
        showDetails,
      );

      if (totalUpdated === 0) {
        if (isDryRun) {
          relinka("log", "Dry run mode - no changes would be made");
        } else {
          relinka("log", "No dependencies to update");
        }
        return;
      }

      // Display simple summary
      if (packageJsonFiles.length > 1) {
        relinka(
          "log",
          `Updated ${totalUpdated} dependencies across ${packageJsonFiles.length} package.json files`,
        );
      } else {
        relinka("log", `Updated ${totalUpdated} dependencies`);
      }

      // Handle installation
      if (install) {
        await handleInstallation();
      } else {
        relinka(
          "log",
          "Run 'bun install' to apply the changes (use --install to do this automatically)",
        );
      }
    } catch (error) {
      relinka(
        "error",
        `Failed to update dependencies: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }

    await commonEndActions({ withEndPrompt: false });
  },
});
