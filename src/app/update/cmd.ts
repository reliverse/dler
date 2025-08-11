// usage example: bun src/cli.ts update --dry-run --with-install

// TODO: fix: when package.json has both workspaces.catalog section and dependencies/devDependencies in root package.json then only catalog's deps are updated.
// TODO: OR: maybe dependencies/devDependencies themselves are just ignored when catalog is present...

import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand, multiselectPrompt } from "@reliverse/rempts";
import { $ } from "bun";
import { lookpath } from "lookpath";
import pMap from "p-map";
import { readPackageJSON } from "pkg-types";
import semver from "semver";

import { getConfigBunfig } from "~/libs/sdk/sdk-impl/config/load";
import { updateCatalogs, isCatalogSupported } from "~/libs/sdk/sdk-impl/utils/pm/pm-catalog";
import { detectPackageManager } from "~/libs/sdk/sdk-impl/utils/pm/pm-detect";
import { latestVersion } from "~/libs/sdk/sdk-impl/utils/pm/pm-meta";

interface UpdateResult {
  package: string;
  currentVersion: string;
  latestVersion: string;
  updated: boolean;
  error?: string;
  semverCompatible?: boolean;
  location?: string; // Track where the dependency comes from (dependencies, devDependencies, catalog, etc.)
}

/**
 * Check if a dependency is an npm alias (e.g., "npm:package-name@version")
 */
function isNpmAlias(versionSpec: string): boolean {
  return versionSpec.startsWith("npm:");
}

/**
 * Check if a dependency is a workspace dependency (e.g., "workspace:*")
 */
function isWorkspaceDependency(versionSpec: string): boolean {
  return versionSpec.startsWith("workspace:");
}

/**
 * Check if a version update is semver-compatible with the current version range
 */
function isSemverCompatible(currentVersionRange: string, latestVersion: string): boolean {
  try {
    // Skip npm aliases entirely
    if (isNpmAlias(currentVersionRange)) {
      return false;
    }

    // Skip workspace dependencies
    if (isWorkspaceDependency(currentVersionRange)) {
      return false;
    }

    // If the current version range is exact (no prefix), be conservative
    if (!currentVersionRange.startsWith("^") && !currentVersionRange.startsWith("~")) {
      return false;
    }

    // Check if the latest version satisfies the current range
    return semver.satisfies(latestVersion, currentVersionRange);
  } catch {
    // If we can't parse the version, skip it
    return false;
  }
}

/**
 * Fallback function to fetch package version directly from npm registry
 */
async function fetchVersionFromRegistry(packageName: string): Promise<string> {
  const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = (await response.json()) as { version: string };
  return data.version;
}

/**
 * Get latest version with fallback mechanism
 */
async function getLatestVersion(packageName: string): Promise<string> {
  try {
    return await latestVersion(packageName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // For any error, try the registry fallback once
    try {
      return await fetchVersionFromRegistry(packageName);
    } catch (fallbackError) {
      throw new Error(
        `Latest version main check and npm registry fallback failed. Main check error: ${errorMessage}. Registry error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
      );
    }
  }
}

/**
 * Get globally installed packages for different package managers
 */
async function getGlobalPackages(packageManager: string): Promise<Record<string, string>> {
  try {
    let result: any;

    if (packageManager === "npm") {
      result = await $`npm list -g --depth=0 --json`.json();
    } else if (packageManager === "yarn") {
      // Yarn Classic vs Berry have different commands
      try {
        result = await $`yarn global list --json`.json();
      } catch {
        // Try Yarn Berry command
        result = await $`yarn global list`.text();
        // Parse yarn berry output manually since it doesn't have --json
        const packages: Record<string, string> = {};
        const lines = result.split("\n");
        for (const line of lines) {
          const match = line.match(/^(.+)@([^@]+)$/);
          if (match) {
            packages[match[1]] = match[2];
          }
        }
        return packages;
      }
    } else if (packageManager === "pnpm") {
      result = await $`pnpm list -g --depth=0 --json`.json();
    } else if (packageManager === "bun") {
      result = await $`bun pm ls -g --json`.json();
    } else {
      throw new Error(`Unsupported package manager: ${packageManager}`);
    }

    const dependencies = result?.dependencies || {};
    const packages: Record<string, string> = {};

    for (const [name, info] of Object.entries(dependencies)) {
      if (info && typeof info === "object" && "version" in info) {
        packages[name] = (info as any).version;
      }
    }

    return packages;
  } catch (error) {
    relinka("warn", `Failed to get global packages for ${packageManager}: ${error}`);
    return {};
  }
}

/**
 * Run install command for the detected package manager
 */
async function runInstallCommand(packageManager: any, linker?: string): Promise<void> {
  try {
    switch (packageManager.name) {
      case "bun": {
        const linkerArg = linker ? `--linker ${linker}` : "";
        await $`bun install ${linkerArg}`;
        break;
      }
      case "npm":
        await $`npm install`;
        break;
      case "yarn":
        await $`yarn install`;
        break;
      case "pnpm":
        await $`pnpm install`;
        break;
      case "deno":
        // Deno doesn't have a traditional install command, but we can run deno cache
        await $`deno cache --reload import_map.json`;
        break;
      default:
        throw new Error(`Unsupported package manager: ${packageManager.name}`);
    }
  } catch (error) {
    relinka("warn", `Failed to run install command for ${packageManager.name}: ${error}`);
    throw error;
  }
}

/**
 * Run install command with filter arguments for monorepo support
 */
async function runInstallCommandWithFilter(
  packageManager: any,
  linker?: string,
  filterArgs: string[] = [],
): Promise<void> {
  try {
    switch (packageManager.name) {
      case "bun": {
        const linkerArg = linker ? `--linker ${linker}` : "";
        const filterStr = filterArgs.join(" ");
        await $`bun install ${linkerArg} ${filterStr}`;
        break;
      }
      case "npm": {
        const npmFilterStr = filterArgs.join(" ");
        await $`npm install ${npmFilterStr}`;
        break;
      }
      case "yarn": {
        const yarnFilterStr = filterArgs.join(" ");
        await $`yarn install ${yarnFilterStr}`;
        break;
      }
      case "pnpm": {
        const pnpmFilterStr = filterArgs.join(" ");
        await $`pnpm install ${pnpmFilterStr}`;
        break;
      }
      case "deno":
        // Deno doesn't have traditional workspace filtering, but we can run deno cache
        await $`deno cache --reload import_map.json`;
        break;
      default:
        throw new Error(`Unsupported package manager: ${packageManager.name}`);
    }
  } catch (error) {
    relinka("warn", `Failed to run install command for ${packageManager.name}: ${error}`);
    throw error;
  }
}

/**
 * Update global packages for different package managers
 */
async function updateGlobalPackage(packageManager: string, packageName: string): Promise<boolean> {
  try {
    if (packageManager === "npm") {
      await $`npm install -g ${packageName}@latest`;
    } else if (packageManager === "yarn") {
      await $`yarn global add ${packageName}@latest`;
    } else if (packageManager === "pnpm") {
      await $`pnpm add -g ${packageName}@latest`;
    } else if (packageManager === "bun") {
      await $`bun install -g ${packageName}@latest`;
    } else {
      throw new Error(`Unsupported package manager: ${packageManager}`);
    }
    return true;
  } catch (error) {
    relinka(
      "warn",
      `Failed to update global package ${packageName} with ${packageManager}: ${error}`,
    );
    return false;
  }
}

/**
 * Handle global package updates
 */
async function handleGlobalUpdates(args: any): Promise<void> {
  const packageManagers = ["bun", "npm", "yarn", "pnpm"];
  const availablePackageManagers: string[] = [];

  // Check which package managers are available
  for (const pm of packageManagers) {
    if (await lookpath(pm)) {
      availablePackageManagers.push(pm);
    }
  }

  if (availablePackageManagers.length === 0) {
    relinka("error", "No supported package managers found");
    return process.exit(1);
  }

  relinka("info", `Found package managers: ${availablePackageManagers.join(", ")}`);

  // Get global packages from all available package managers
  const allGlobalPackages: Record<string, { version: string; packageManager: string }> = {};

  for (const pm of availablePackageManagers) {
    const packages = await getGlobalPackages(pm);
    for (const [name, version] of Object.entries(packages)) {
      if (!allGlobalPackages[name] || semver.gt(version, allGlobalPackages[name].version)) {
        allGlobalPackages[name] = { version, packageManager: pm };
      }
    }
  }

  const globalPackageNames = Object.keys(allGlobalPackages);

  if (globalPackageNames.length === 0) {
    relinka("warn", "No global packages found");
    return;
  }

  // Filter packages based on name and ignore parameters
  let filteredPackages: string[] = [];

  if (args.name && args.name.length > 0) {
    filteredPackages = args.name.filter((pkg: string) => pkg in allGlobalPackages);
    const notFound = args.name.filter((pkg: string) => !(pkg in allGlobalPackages));
    if (notFound.length > 0) {
      relinka("warn", `Global packages not found: ${notFound.join(", ")}`);
    }
  } else {
    const ignoreList = args.ignore || [];
    filteredPackages = globalPackageNames.filter((pkg) => !ignoreList.includes(pkg));
  }

  if (filteredPackages.length === 0) {
    relinka("warn", "No global packages to update");
    return;
  }

  relinka("info", `Checking ${filteredPackages.length} global packages for updates...`);

  // Check versions concurrently
  const results = await pMap(
    filteredPackages,
    async (packageName): Promise<UpdateResult> => {
      const globalPackage = allGlobalPackages[packageName];
      if (!globalPackage) {
        return {
          package: packageName,
          currentVersion: "unknown",
          latestVersion: "unknown",
          updated: false,
          error: "Package not found in global packages",
          location: "global",
        };
      }

      try {
        const latest = await getLatestVersion(packageName);
        const needsUpdate = semver.gt(latest, globalPackage.version);

        return {
          package: packageName,
          currentVersion: globalPackage.version,
          latestVersion: latest,
          updated: needsUpdate,
          location: `global (${globalPackage.packageManager})`,
        };
      } catch (error) {
        return {
          package: packageName,
          currentVersion: globalPackage.version,
          latestVersion: globalPackage.version,
          updated: false,
          error: error instanceof Error ? error.message : String(error),
          location: `global (${globalPackage.packageManager})`,
        };
      }
    },
    { concurrency: args.concurrency },
  );

  // Show results
  let toUpdate = results.filter((r) => r.updated && !r.error);
  const errors = results.filter((r) => r.error);
  const upToDate = results.filter((r) => !r.updated && !r.error);

  if (errors.length > 0) {
    relinka("warn", `Failed to check ${errors.length} global packages:`);
    for (const error of errors) {
      relinka("warn", `  ${error.package} (${error.location}): ${error.error}`);
    }
  }

  if (upToDate.length > 0) {
    relinka("success", `${upToDate.length} global packages are up to date`);
  }

  if (toUpdate.length === 0) {
    relinka("success", "All global packages are up to date");
    return;
  }

  relinka("info", `${toUpdate.length} global packages can be updated:`);
  for (const update of toUpdate) {
    relinka(
      "log",
      `  ${update.package} (${update.location}): ${update.currentVersion} → ${update.latestVersion}`,
    );
  }

  // Interactive selection for global packages
  if (args.interactive) {
    // Combine all global packages for selection
    const allGlobalPackages = [
      ...toUpdate.map((pkg) => ({ ...pkg, canUpdate: true, isUpToDate: false, hasError: false })),
      ...upToDate.map((pkg) => ({ ...pkg, canUpdate: false, isUpToDate: true, hasError: false })),
      ...errors.map((pkg) => ({ ...pkg, canUpdate: false, isUpToDate: false, hasError: true })),
    ];

    const selectedPackages = await multiselectPrompt({
      title: "Select global packages to update",
      options: [
        { label: "Exit", value: "exit" },
        ...allGlobalPackages.map((pkg) => {
          let label = `${pkg.package} (${pkg.location})`;

          if (pkg.canUpdate) {
            label += `: ${pkg.currentVersion} → ${pkg.latestVersion}`;
          } else if (pkg.isUpToDate) {
            label += `: ${pkg.currentVersion} (up-to-date)`;
          } else if (pkg.hasError) {
            label += `: ${pkg.currentVersion} (has errors)`;
          }

          return {
            label,
            value: pkg.package,
            disabled: !pkg.canUpdate,
            hint: pkg.hasError ? pkg.error : undefined,
          };
        }),
      ],
    });

    if (selectedPackages.length === 0 || selectedPackages.includes("exit")) {
      relinka("info", "Exiting global update process");
      return;
    }

    // Filter out "exit" and update toUpdate to only include selected packages
    const actualSelectedPackages = selectedPackages.filter((pkg) => pkg !== "exit");
    toUpdate = toUpdate.filter((update) => actualSelectedPackages.includes(update.package));
    relinka("info", `Updating ${actualSelectedPackages.length} selected global packages...`);
  }

  if (args["dry-run"]) {
    relinka("info", "Dry run mode - no changes were made");
    return;
  }

  // Update global packages
  let successCount = 0;
  for (const update of toUpdate) {
    const globalPackage = allGlobalPackages[update.package];
    if (
      globalPackage &&
      (await updateGlobalPackage(globalPackage.packageManager, update.package))
    ) {
      successCount++;
    }
  }

  relinka("success", `Successfully updated ${successCount}/${toUpdate.length} global packages`);
}

export default defineCommand({
  meta: {
    name: "update",
    description: "Update dependencies to the latest version",
  },
  args: defineArgs({
    name: {
      type: "array",
      description: "The names of the dependencies to update (leave empty to update all)",
    },
    ignore: {
      type: "array",
      description: "The names of the dependencies to ignore when --name is not provided",
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
      description: "Update only catalog dependencies",
    },
    "dry-run": {
      type: "boolean",
      description: "Show what would be updated without making changes",
    },
    concurrency: {
      type: "number",
      description: "Number of concurrent version checks",
      default: 5,
    },
    "with-check-script": {
      type: "boolean",
      description: "Run `bun check` after updating (exclusive for bun environment at the moment)",
    },
    linker: {
      type: "string",
      description:
        "Linker strategy (pro tip: use 'isolated' in a monorepo project, 'hoisted' (default) in a project where you have only one package.json). When this option is explicitly set, it takes precedence over bunfig.toml install.linker setting.",
      allowed: ["isolated", "hoisted"],
      default: "hoisted",
    },
    "with-install": {
      type: "boolean",
      description: "Run the install step after updating dependencies",
      alias: "with-i",
    },
    global: {
      type: "boolean",
      description: "Update global packages instead of local dependencies",
      alias: "g",
    },
    interactive: {
      type: "boolean",
      description: "Interactively select which dependencies to update",
    },
    filter: {
      type: "array",
      description: "Filter workspaces to operate on (e.g., 'pkg-*', '!pkg-c', './packages/pkg-*')",
    },
    "update-catalogs": {
      type: "boolean",
      description: "Update catalog dependencies to latest versions",
    },
  }),
  async run({ args }) {
    try {
      // Handle global package updates
      if (args.global) {
        return await handleGlobalUpdates(args);
      }

      // Handle catalog updates
      if (args["update-catalogs"]) {
        const packageManager = await detectPackageManager(process.cwd());
        if (!packageManager) {
          relinka("error", "Could not detect package manager");
          return process.exit(1);
        }

        if (!isCatalogSupported(packageManager)) {
          relinka(
            "error",
            `Catalogs are not supported by ${packageManager.name}. Only Bun supports catalogs.`,
          );
          return process.exit(1);
        }

        await updateCatalogs(process.cwd());
        return;
      }

      const packageJsonPath = path.resolve(process.cwd(), "package.json");

      if (!(await fs.pathExists(packageJsonPath))) {
        relinka("error", "No package.json found in current directory");
        return process.exit(1);
      }

      // Load bunfig configuration for linker strategy (only in Bun environment)
      let effectiveLinker = args.linker; // CLI argument takes precedence
      let linkerSource = "CLI default";

      if (typeof Bun !== "undefined") {
        const bunfigConfig = await getConfigBunfig();

        // Check if bunfig has a different linker setting
        if (bunfigConfig?.install?.linker) {
          const bunfigLinker = bunfigConfig.install.linker;
          if (
            (bunfigLinker === "isolated" || bunfigLinker === "hoisted") &&
            args.linker === "hoisted"
          ) {
            // Use bunfig setting only if CLI is using the default "hoisted"
            // This means bunfig takes precedence unless user explicitly overrides
            effectiveLinker = bunfigLinker;
            linkerSource =
              bunfigLinker === "hoisted" ? "bunfig.toml (same as default)" : "bunfig.toml";
          }
        }
      }

      // If user provided non-default CLI value, it always wins
      if (args.linker !== "hoisted") {
        effectiveLinker = args.linker;
        linkerSource = "CLI argument (explicit override)";
      }

      relinka("verbose", `Using linker strategy: ${effectiveLinker} (from ${linkerSource})`);

      // relinka("verbose", "Reading package.json...");
      const packageJson = await readPackageJSON();

      const dependencies = packageJson.dependencies || {};
      const devDependencies = packageJson.devDependencies || {};
      const peerDependencies = packageJson.peerDependencies || {};
      const optionalDependencies = packageJson.optionalDependencies || {};

      // Handle catalogs - both singular and plural
      const workspaces = (packageJson as any).workspaces || {};
      const catalog = (workspaces as any).catalog || (packageJson as any).catalog || {};
      const catalogs = (workspaces as any).catalogs || (packageJson as any).catalogs || {};

      // Determine which dependencies to check
      let targetDeps: Record<string, string> = {};
      const depSources: Record<string, string> = {}; // Track where each dep comes from

      // Check for conflicting flags
      const exclusiveFlags = [
        args["dev-only"],
        args["prod-only"],
        args["peer-only"],
        args["optional-only"],
        args["catalogs-only"],
      ].filter(Boolean);
      if (exclusiveFlags.length > 1) {
        relinka(
          "error",
          "Cannot specify multiple exclusive flags (--dev-only, --prod-only, --peer-only, --optional-only, --catalogs-only)",
        );
        return process.exit(1);
      }

      if (args["dev-only"]) {
        targetDeps = { ...devDependencies };
        Object.keys(devDependencies).forEach((dep) => {
          depSources[dep] = "devDependencies";
        });
      } else if (args["prod-only"]) {
        targetDeps = { ...dependencies };
        Object.keys(dependencies).forEach((dep) => {
          depSources[dep] = "dependencies";
        });
      } else if (args["peer-only"]) {
        targetDeps = { ...peerDependencies };
        Object.keys(peerDependencies).forEach((dep) => {
          depSources[dep] = "peerDependencies";
        });
      } else if (args["optional-only"]) {
        targetDeps = { ...optionalDependencies };
        Object.keys(optionalDependencies).forEach((dep) => {
          depSources[dep] = "optionalDependencies";
        });
      } else if (args["catalogs-only"]) {
        // Add catalog dependencies
        Object.keys(catalog).forEach((dep) => {
          targetDeps[dep] = catalog[dep];
          depSources[dep] = "catalog";
        });

        // Add named catalogs
        Object.keys(catalogs).forEach((catalogName) => {
          Object.keys(catalogs[catalogName]).forEach((dep) => {
            targetDeps[dep] = catalogs[catalogName][dep];
            depSources[dep] = `catalogs.${catalogName}`;
          });
        });
      } else {
        // Include all types - collect all dependencies first
        const allDeps: Record<string, string> = {};
        const allDepSources: Record<string, string> = {};

        // Add regular dependencies first
        Object.keys(dependencies).forEach((dep) => {
          const version = dependencies[dep];
          if (version) {
            allDeps[dep] = version;
            allDepSources[dep] = "dependencies";
          }
        });
        Object.keys(devDependencies).forEach((dep) => {
          const version = devDependencies[dep];
          if (version) {
            allDeps[dep] = version;
            allDepSources[dep] = "devDependencies";
          }
        });
        Object.keys(peerDependencies).forEach((dep) => {
          const version = peerDependencies[dep];
          if (version) {
            allDeps[dep] = version;
            allDepSources[dep] = "peerDependencies";
          }
        });
        Object.keys(optionalDependencies).forEach((dep) => {
          const version = optionalDependencies[dep];
          if (version) {
            allDeps[dep] = version;
            allDepSources[dep] = "optionalDependencies";
          }
        });

        // Add catalog dependencies (these will be checked separately)
        Object.keys(catalog).forEach((dep) => {
          allDeps[dep] = catalog[dep];
          allDepSources[dep] = "catalog";
        });

        // Add named catalogs
        Object.keys(catalogs).forEach((catalogName) => {
          Object.keys(catalogs[catalogName]).forEach((dep) => {
            allDeps[dep] = catalogs[catalogName][dep];
            allDepSources[dep] = `catalogs.${catalogName}`;
          });
        });

        targetDeps = allDeps;
        Object.assign(depSources, allDepSources);
      }

      // Filter dependencies based on name and ignore parameters
      const depsToUpdate = Object.keys(targetDeps);
      let filteredDeps: string[] = [];

      if (args.name && args.name.length > 0) {
        // Update only specified dependencies
        filteredDeps = args.name.filter((dep) => dep in targetDeps);
        const notFound = args.name.filter((dep) => !(dep in targetDeps));
        if (notFound.length > 0) {
          relinka("warn", `Dependencies not found: ${notFound.join(", ")}`);
        }
      } else {
        // Update all dependencies, respecting ignore list
        const ignoreList = args.ignore || [];
        filteredDeps = depsToUpdate.filter((dep) => !ignoreList.includes(dep));
      }

      // Filter out dependencies that don't start with ~ or ^ (npm aliases, workspace deps, etc.)
      const semverDeps = filteredDeps.filter((dep) => {
        const versionSpec = targetDeps[dep];
        return versionSpec && (versionSpec.startsWith("^") || versionSpec.startsWith("~"));
      });

      if (semverDeps.length === 0) {
        relinka(
          "warn",
          "No dependencies to update (only semver-compatible dependencies with ^ or ~ prefixes are supported)",
        );
        return;
      }

      // relinka("verbose", `Checking ${semverDeps.length} dependencies for updates...`);

      // Check versions concurrently using p-map
      const results = await pMap(
        semverDeps,
        async (dep): Promise<UpdateResult> => {
          const currentVersion = targetDeps[dep];

          if (!currentVersion) {
            return {
              package: dep,
              currentVersion: "unknown",
              latestVersion: "unknown",
              updated: false,
              error: "Current version not found",
              semverCompatible: false,
              location: depSources[dep],
            };
          }

          try {
            const latest = await getLatestVersion(dep);
            const cleanCurrent = currentVersion.replace(/^[\^~]/, "");
            const isCompatible = isSemverCompatible(currentVersion, latest);

            return {
              package: dep,
              currentVersion: cleanCurrent,
              latestVersion: latest,
              updated: latest !== cleanCurrent && isCompatible,
              semverCompatible: isCompatible,
              location: depSources[dep],
            };
          } catch (error) {
            return {
              package: dep,
              currentVersion,
              latestVersion: currentVersion,
              updated: false,
              error: error instanceof Error ? error.message : String(error),
              semverCompatible: false,
              location: depSources[dep],
            };
          }
        },
        { concurrency: args.concurrency },
      );

      // Show results - only show compatible updates and errors
      let toUpdate = results.filter((r) => r.updated && !r.error);
      const errors = results.filter((r) => r.error);
      const upToDate = results.filter((r) => !r.updated && !r.error && r.semverCompatible);

      if (errors.length > 0) {
        relinka("warn", `Failed to check ${errors.length} dependencies:`);
        for (const error of errors) {
          relinka("warn", `  ${error.package} (${error.location}): ${error.error}`);
        }
      }

      if (toUpdate.length === 0) {
        relinka("success", `All ${upToDate.length} deps are already up to date`);
        return;
      }

      if (upToDate.length > 0) {
        relinka("success", `${upToDate.length} dependencies are up to date`);
      }

      if (toUpdate.length === 0) {
        relinka("success", `All ${upToDate.length} deps are already up to date`);
        return;
      }

      relinka("info", `${toUpdate.length} dependencies can be updated:`);
      for (const update of toUpdate) {
        relinka(
          "log",
          `  ${update.package} (${update.location}): ${update.currentVersion} → ${update.latestVersion}`,
        );
      }

      // Interactive selection
      if (args.interactive) {
        // Combine all packages for selection
        const allPackages = [
          ...toUpdate.map((pkg) => ({
            ...pkg,
            canUpdate: true,
            isUpToDate: false,
            hasError: false,
          })),
          ...upToDate.map((pkg) => ({
            ...pkg,
            canUpdate: false,
            isUpToDate: true,
            hasError: false,
          })),
          ...errors.map((pkg) => ({ ...pkg, canUpdate: false, isUpToDate: false, hasError: true })),
        ];

        const selectedPackages = await multiselectPrompt({
          title: "Select dependencies to update",
          options: [
            { label: "Exit", value: "exit" },
            ...allPackages.map((pkg) => {
              let label = `${pkg.package} (${pkg.location})`;

              if (pkg.canUpdate) {
                label += `: ${pkg.currentVersion} → ${pkg.latestVersion}`;
              } else if (pkg.isUpToDate) {
                label += `: ${pkg.currentVersion} (up-to-date)`;
              } else if (pkg.hasError) {
                label += `: ${pkg.currentVersion} (has errors)`;
              }

              return {
                label,
                value: pkg.package,
                disabled: !pkg.canUpdate,
                hint: pkg.hasError ? pkg.error : undefined,
              };
            }),
          ],
        });

        if (selectedPackages.length === 0 || selectedPackages.includes("exit")) {
          relinka("info", "Exiting update process");
          return;
        }

        // Filter out "exit" and update toUpdate to only include selected packages
        const actualSelectedPackages = selectedPackages.filter((pkg) => pkg !== "exit");
        toUpdate = toUpdate.filter((update) => actualSelectedPackages.includes(update.package));
        relinka("info", `Updating ${actualSelectedPackages.length} selected dependencies...`);
      }

      if (args["dry-run"]) {
        relinka("info", "Dry run mode - no changes were made");
        return;
      }

      // Update package.json
      // relinka("verbose", "Updating package.json...");

      const updatedPackageJson = { ...packageJson };

      for (const update of toUpdate) {
        const dep = update.package;
        const newVersion = `^${update.latestVersion}`;

        // Instead of relying on location tracking, check all possible locations
        // and update wherever the dependency exists

        if (dependencies[dep]) {
          if (!updatedPackageJson.dependencies) updatedPackageJson.dependencies = {};
          updatedPackageJson.dependencies[dep] = newVersion;
        }

        if (devDependencies[dep]) {
          if (!updatedPackageJson.devDependencies) updatedPackageJson.devDependencies = {};
          updatedPackageJson.devDependencies[dep] = newVersion;
        }

        if (peerDependencies[dep]) {
          if (!updatedPackageJson.peerDependencies) updatedPackageJson.peerDependencies = {};
          updatedPackageJson.peerDependencies[dep] = newVersion;
        }

        if (optionalDependencies[dep]) {
          if (!updatedPackageJson.optionalDependencies)
            updatedPackageJson.optionalDependencies = {};
          updatedPackageJson.optionalDependencies[dep] = newVersion;
        }

        if (catalog[dep]) {
          // Update catalog
          if (!(updatedPackageJson as any).workspaces) (updatedPackageJson as any).workspaces = {};
          if (!(updatedPackageJson as any).workspaces.catalog)
            (updatedPackageJson as any).workspaces.catalog = {};
          (updatedPackageJson as any).workspaces.catalog[dep] = newVersion;

          // Also update top-level catalog if it exists
          if ((updatedPackageJson as any).catalog) {
            (updatedPackageJson as any).catalog[dep] = newVersion;
          }
        }

        // Check named catalogs
        Object.keys(catalogs).forEach((catalogName) => {
          if (catalogs[catalogName][dep]) {
            if (!(updatedPackageJson as any).workspaces)
              (updatedPackageJson as any).workspaces = {};
            if (!(updatedPackageJson as any).workspaces.catalogs)
              (updatedPackageJson as any).workspaces.catalogs = {};
            if (!(updatedPackageJson as any).workspaces.catalogs[catalogName]) {
              (updatedPackageJson as any).workspaces.catalogs[catalogName] = {};
            }
            (updatedPackageJson as any).workspaces.catalogs[catalogName][dep] = newVersion;

            // Also update top-level catalogs if it exists
            if (
              (updatedPackageJson as any).catalogs &&
              (updatedPackageJson as any).catalogs[catalogName]
            ) {
              (updatedPackageJson as any).catalogs[catalogName][dep] = newVersion;
            }
          }
        });
      }

      // Write updated package.json
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(updatedPackageJson, null, 2) + "\n",
        "utf8",
      );

      relinka("success", `Updated ${toUpdate.length} dependencies in package.json`);

      // Check if --with-install is NOT specified to skip the install step
      if (args["with-install"] !== true) {
        // Detect package manager for the message
        const packageManager = await detectPackageManager(process.cwd());
        const installCommand = packageManager
          ? `${packageManager.command} install`
          : "your package manager's install command";

        relinka(
          "info",
          `Skipped install step. Use --with-install flag to run '${installCommand}' after updating.`,
        );
        return; // Exit early to prevent any automatic install
      }

      // Only proceed with install if --with-install is specified
      // Detect package manager
      const packageManager = await detectPackageManager(process.cwd());

      if (packageManager) {
        try {
          // Handle workspace filtering
          if (args.filter && args.filter.length > 0) {
            // For filtered installs, we need to pass the filter arguments
            const filterArgs = args.filter.flatMap((filter) => ["--filter", filter]);
            await runInstallCommandWithFilter(packageManager, effectiveLinker, filterArgs);
          } else {
            await runInstallCommand(packageManager, effectiveLinker);
          }

          // Run check script if available and requested (only for bun)
          if (
            packageManager.name === "bun" &&
            packageJson.scripts?.check &&
            args["with-check-script"]
          ) {
            await $`bun check`;
          }
        } catch (error) {
          relinka(
            "warn",
            `Install failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          relinka("info", `Run '${packageManager.command} install' manually to apply the changes`);
        }
      } else {
        relinka("warn", "Could not detect package manager. Please run install manually.");
      }
    } catch (error) {
      relinka(
        "error",
        `Failed to update dependencies: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  },
});
