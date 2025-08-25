// usage example: bun src-ts/dler.ts update --dry-run --with-install

import { re } from "@reliverse/relico";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand, multiselectPrompt } from "@reliverse/rempts";
import { readPackageJSON } from "pkg-types";

import {
  checkPackageUpdates,
  displayUpdateSummary,
  getEffectiveLinker,
  handleCatalogOnlyUpdate,
  handleInstallation,
  handleInteractiveSelection,
  handleRecursiveUpdates,
  handleWorkspaceUpdates,
  prepareUpdateCandidates,
  updateRootPackageJson,
  validatePackageJson,
  validateUpdateArgs,
} from "./impl";
import {
  displayUpdateResults,
  isMonorepo,
  type UpgradeResult,
  upgradeBun,
  upgradeDlerGlobal,
  upgradeDlerLocal,
  upgradeGit,
  upgradeNode,
  upgradeNpm,
  upgradePnpm,
  upgradeYarn,
} from "./utils";

// By default tool recursively updates all dependencies to their latest available versions including catalogs.
// Finds and updates ALL package.json files in the directory tree by default.
// Use --no-recursive with --all-workspaces or --root-only for workspace-based behavior.
export default defineCommand({
  meta: {
    name: "update",
    description:
      "Update all dependencies and catalogs to their latest available versions (recursively finds all package.json files by default)",
  },
  args: defineArgs({
    name: {
      type: "array",
      description: "Specific dependencies to update (default: all dependencies)",
    },
    ignore: {
      type: "array",
      description: "Dependencies to exclude from updates",
    },
    "dev-only": {
      type: "boolean",
      description: "Update only devDependencies",
    },
    "prod-only": {
      type: "boolean",
      description: "Update only dependencies (production)",
    },
    "peer-only": {
      type: "boolean",
      description: "Update only peerDependencies",
    },
    "optional-only": {
      type: "boolean",
      description: "Update only optionalDependencies",
    },
    "catalogs-only": {
      type: "boolean",
      description: "Update ONLY catalog dependencies (catalogs are included by default)",
    },
    "dry-run": {
      type: "boolean",
      description: "Preview updates without making changes",
    },
    concurrency: {
      type: "number",
      description: "Number of concurrent version checks",
      default: 5,
    },
    "with-check-script": {
      type: "boolean",
      description: "Run `bun check` after updating (Bun only)",
    },
    linker: {
      type: "string",
      description: "Linker strategy: 'isolated' for monorepos, 'hoisted' for single packages",
      allowed: ["isolated", "hoisted"],
      default: "hoisted",
    },
    "with-install": {
      type: "boolean",
      description: "Run install after updating",
      alias: "with-i",
    },
    global: {
      type: "boolean",
      description: "Update global packages",
      alias: "g",
    },
    interactive: {
      type: "boolean",
      description: "Interactively select dependencies to update",
    },
    filter: {
      type: "array",
      description: "Filter workspaces (e.g., 'pkg-*', '!pkg-c')",
    },
    "all-workspaces": {
      type: "boolean",
      description: "Update dependencies across all workspace packages (requires --no-recursive)",
    },
    "root-only": {
      type: "boolean",
      description: "Update only the root package.json (requires --no-recursive)",
    },
    recursive: {
      type: "boolean",
      description:
        "Recursively find and update ALL package.json files in current directory tree (default: true, use --no-recursive to disable)",
      alias: "r",
      default: true,
    },
    "save-prefix": {
      type: "string",
      description: "Version prefix: '^', '~', or 'none' for exact",
      allowed: ["^", "~", "none"],
      default: "^",
    },
    "allow-major": {
      type: "boolean",
      description:
        "Allow major version updates to latest available (disable with --no-allow-major)",
      default: true,
    },
    "upgrade-tools": {
      type: "boolean",
      description: "Upgrade system development tools (dler, git, node.js, npm, bun, yarn, pnpm)",
      alias: "upgrade",
    },
    "upgrade-interactive": {
      type: "boolean",
      description: "Interactively select which tools to upgrade (use with --upgrade-tools)",
      default: true,
    },
  }),
  async run({ args }) {
    try {
      // Handle tool upgrades
      if (args["upgrade-tools"]) {
        await handleToolUpgrades(args);
        return;
      }

      // Validate arguments for dependency updates
      await validateUpdateArgs(args);

      // Handle global package updates
      if (args.global) {
        const { handleGlobalUpdates } = await import("./utils");
        return await handleGlobalUpdates(args);
      }

      // Handle catalog-only updates
      const catalogUpdated = await handleCatalogOnlyUpdate(args);
      if (catalogUpdated) {
        return;
      }

      // Validate package.json exists
      const packageJsonPath = await validatePackageJson();

      // Get effective linker strategy
      const { effectiveLinker } = await getEffectiveLinker(args);

      // Prepare update candidates
      const { candidates, allDepsMap } = await prepareUpdateCandidates(args);
      if (candidates.length === 0) {
        return;
      }

      // Check package updates
      const results = await checkPackageUpdates(candidates, allDepsMap, args);

      // Display results
      displayUpdateResults(results);

      let toUpdate = results.filter((r) => r.updated && !r.error);
      if (toUpdate.length === 0) {
        return;
      }

      // Handle interactive selection
      if (args.interactive) {
        toUpdate = await handleInteractiveSelection(results);
        if (toUpdate.length === 0) {
          return;
        }
      }

      // Exit early for dry run
      if (args["dry-run"]) {
        relinka("log", "Dry run mode - no changes were made");
        return;
      }

      // Update root package.json
      const rootUpdated = await updateRootPackageJson(
        packageJsonPath,
        allDepsMap,
        toUpdate,
        args["save-prefix"] as string,
      );

      let totalUpdated = rootUpdated;

      // Prepare options for recursive/workspace updates
      const options = {
        allowMajor: !!args["allow-major"],
        savePrefix: args["save-prefix"] as string,
        concurrency: args.concurrency || 5,
      };

      // Handle recursive updates
      if (args.recursive) {
        const recursiveUpdated = await handleRecursiveUpdates(args, options);
        totalUpdated += recursiveUpdated;
      } else {
        // Handle workspace updates
        const isMonorepoProject = await isMonorepo(process.cwd());
        const shouldUpdateWorkspaces =
          args["all-workspaces"] || (!args["root-only"] && isMonorepoProject);

        const workspaceUpdated = await handleWorkspaceUpdates(args, options);
        totalUpdated += workspaceUpdated;

        // Display summary
        displayUpdateSummary(totalUpdated, args, isMonorepoProject, shouldUpdateWorkspaces);
      }

      // Handle installation
      const packageJson = await readPackageJSON();
      await handleInstallation(args, effectiveLinker, packageJson);
    } catch (error) {
      relinka(
        "error",
        `Failed to update dependencies: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  },
});

async function handleToolUpgrades(args: any): Promise<void> {
  // Define all tools and their upgrade functions
  const toolUpgradeFunctions = [
    { name: "dler (local)", fn: upgradeDlerLocal },
    { name: "dler (global)", fn: upgradeDlerGlobal },
    { name: "git", fn: upgradeGit },
    { name: "node.js", fn: upgradeNode },
    { name: "npm", fn: upgradeNpm },
    { name: "bun", fn: upgradeBun },
    { name: "yarn", fn: upgradeYarn },
    { name: "pnpm", fn: upgradePnpm },
  ];

  let results: UpgradeResult[] = [];

  if (args["upgrade-interactive"]) {
    // Check all tools first to see what's available
    const preliminaryResults = await Promise.all(
      toolUpgradeFunctions.map(async ({ fn }) => await fn()),
    );

    // Filter out tools that are not found
    const availableTools = toolUpgradeFunctions
      .map((tool, index) => ({
        ...tool,
        result: preliminaryResults[index],
      }))
      .filter(({ result }) => result && result.status !== "not-found");

    if (availableTools.length === 0) {
      relinka("warn", "No tools available for upgrade");
      return;
    }

    // Show interactive selection
    const selectedTools = await multiselectPrompt({
      title: "Select tools to upgrade",
      displayInstructions: true,
      options: [
        { label: "Exit", value: "exit" },
        ...availableTools.map(({ name, result }) => {
          const isUpToDate = result && result.status === "up-to-date";
          const hasErrors = result && result.status === "error";
          const canUpgrade = result && result.status === "upgraded";

          let label = name;
          if (isUpToDate) {
            label += " (up-to-date)";
          } else if (hasErrors) {
            label += " (has errors)";
          } else if (canUpgrade) {
            label += " (can be upgraded)";
          }

          return {
            label: isUpToDate || hasErrors ? re.gray(label) : label,
            value: name,
            disabled: isUpToDate || hasErrors,
            hint: hasErrors ? result.message : undefined,
          };
        }),
      ],
    });

    if (selectedTools.length === 0 || selectedTools.includes("exit")) {
      relinka("info", "Exiting upgrade process");
      return;
    }

    // Filter out "exit" from selected tools
    const actualSelectedTools = selectedTools.filter((tool) => tool !== "exit");

    // Execute upgrades for selected tools
    relinka("info", `Upgrading ${actualSelectedTools.length} selected tools...`);

    for (const toolName of actualSelectedTools) {
      const tool = availableTools.find((t) => t.name === toolName);
      if (tool) {
        const result = await tool.fn();
        results.push(result);
      }
    }
  } else {
    // Non-interactive mode - upgrade all tools
    results = await Promise.all(toolUpgradeFunctions.map(async ({ fn }) => await fn()));
  }

  // Report results
  const upgraded = results.filter((r) => r.status === "upgraded");
  const upToDate = results.filter((r) => r.status === "up-to-date");
  const notFound = results.filter((r) => r.status === "not-found");
  const errors = results.filter((r) => r.status === "error");

  if (upgraded.length > 0) {
    relinka("success", `Upgraded ${upgraded.length} tools:`);
    upgraded.forEach((r) =>
      relinka("verbose", `  ✓ ${r.tool}${r.message ? ` - ${r.message}` : ""}`),
    );
  }

  if (upToDate.length > 0) {
    relinka("info", `${upToDate.length} tools already up-to-date:`);
    upToDate.forEach((r) =>
      relinka("verbose", `  • ${r.tool}${r.message ? ` - ${r.message}` : ""}`),
    );
  }

  if (notFound.length > 0) {
    relinka("warn", `${notFound.length} tools not installed (skipped):`);
    notFound.forEach((r) => relinka("verbose", `  - ${r.tool}`));
  }

  if (errors.length > 0) {
    relinka("error", `${errors.length} tools had errors:`);
    errors.forEach((r) => relinka("verbose", `  ✗ ${r.tool}${r.message ? ` - ${r.message}` : ""}`));
  }

  relinka("success", "Upgrade check completed!");
}
