// The command philosophy is: "Find all package.json files, update everything you find, skip only non-updateable specifiers (workspace:, catalog:, npm:, etc.)"

import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import path from "path";
import {
  checkPackageUpdatesForFile,
  handleInstallation,
  prepareAllUpdateCandidates,
  updatePackageJsonFileDirectly,
  validatePackageJson,
} from "./impl";
import {
  displayStructuredUpdateResults,
  type UpdateResult,
} from "./utils";
import { msgs } from "../const";
import { getCurrentWorkingDirectory } from "@reliverse/dler-helpers";

const updateCmd = async (args: any): Promise<void> => {
  try {
    // Check if running in Bun
    if (typeof process.versions.bun === "undefined") {
      logger.error("This command requires Bun runtime. Sorry.");
      process.exit(1);
    }

    const { dryRun, install, details, ignoreFields } = args;
    const isDryRun = Boolean(dryRun);
    const showDetails = Boolean(details);
    const fieldsToIgnore = Array.isArray(ignoreFields) ? ignoreFields : [];

    // Validate package.json exists
    await validatePackageJson();

    // Prepare package.json files
    const { packageJsonFiles, fileDepsMap } =
      await prepareAllUpdateCandidates();
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
      const results = await checkPackageUpdatesForFile(fileDeps, args);
      allResults.push(...results);

      const toUpdate = results.filter(
        (r: UpdateResult) => r.updated && !r.error,
      );

      if (toUpdate.length > 0) {
        // Exit early for dry run
        if (isDryRun) {
          const relativePath = path.relative(process.cwd(), packageJsonPath);
          logger.debug(
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
          logger.debug(
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
        "Run 'bun install' to apply the changes (use --install to do this automatically)",
      );
    }
  } catch (error) {
    logger.error(
      `Failed to update dependencies: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
};

const updateCmdArgs = defineCmdArgs({
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
  name: {
    type: "string",
    description:
      "Specific dependencies to update, supports glob patterns (e.g. '@types/*', 'react*')",
  },
  ignore: {
    type: "string",
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
    aliases: ["i"],
  },
  allowMajor: {
    type: "boolean",
    description: "Allow major version updates (default: true)",
    default: true,
  },
  details: {
    type: "boolean",
    description: "Show detailed dependency information (default: false)",
    aliases: ["d"],
  },
  ignoreFields: {
    type: "string",
    description:
      "Dependency fields to ignore (e.g., 'peerDependencies,catalog')",
  },
});

const updateCmdCfg = defineCmdCfg({
  name: "update",
  description: "Update all dependencies to their latest versions across all package.json files. Supports selective updates with glob patterns and comprehensive filtering options.",
  examples: [
    "dler update",
    "dler update --install",
    "dler update --dryRun",
    "dler update --name @types/* --name react*",
    'dler update --ignore "eslint-*" --ignore "@babel/*"',
    "dler update --no-allowMajor",
    "dler update --details",
    "dler update --ignoreFields peerDependencies",
    "dler update --dryRun --install",
    "dler update --name react --name react-dom --install",
    "dler update --ignore @types/* --allowMajor",
  ],
});

export default defineCmd(updateCmd, updateCmdArgs, updateCmdCfg);
