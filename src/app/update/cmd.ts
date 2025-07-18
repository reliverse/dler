// usage example: bun src/cli.ts update --dry-run

import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import { $ } from "bun";
import pMap from "p-map";
import { readPackageJSON } from "pkg-types";
import semver from "semver";

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
      default: false,
    },
    "prod-only": {
      type: "boolean",
      description: "Update only dependencies (production)",
      default: false,
    },
    "peer-only": {
      type: "boolean",
      description: "Update only peerDependencies",
      default: false,
    },
    "optional-only": {
      type: "boolean",
      description: "Update only optionalDependencies",
      default: false,
    },
    "catalogs-only": {
      type: "boolean",
      description: "Update only catalog dependencies",
      default: false,
    },
    "dry-run": {
      type: "boolean",
      description: "Show what would be updated without making changes",
      default: false,
    },
    concurrency: {
      type: "number",
      description: "Number of concurrent version checks",
      default: 5,
    },
    "with-check-script": {
      type: "boolean",
      description: "Run `bun check` after updating (exclusive for bun environment at the moment)",
      default: false,
    },
  }),
  async run({ args }) {
    try {
      const packageJsonPath = path.resolve(process.cwd(), "package.json");

      if (!(await fs.pathExists(packageJsonPath))) {
        relinka("error", "No package.json found in current directory");
        return process.exit(1);
      }

      relinka("info", "Reading package.json...");
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
        // Include all types
        targetDeps = {
          ...dependencies,
          ...devDependencies,
          ...peerDependencies,
          ...optionalDependencies,
        };
        Object.keys(dependencies).forEach((dep) => {
          depSources[dep] = "dependencies";
        });
        Object.keys(devDependencies).forEach((dep) => {
          depSources[dep] = "devDependencies";
        });
        Object.keys(peerDependencies).forEach((dep) => {
          depSources[dep] = "peerDependencies";
        });
        Object.keys(optionalDependencies).forEach((dep) => {
          depSources[dep] = "optionalDependencies";
        });

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

      relinka("info", `Checking ${semverDeps.length} dependencies for updates...`);

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
      const toUpdate = results.filter((r) => r.updated && !r.error);
      const errors = results.filter((r) => r.error);
      const upToDate = results.filter((r) => !r.updated && !r.error && r.semverCompatible);

      if (errors.length > 0) {
        relinka("warn", `Failed to check ${errors.length} dependencies:`);
        for (const error of errors) {
          relinka("warn", `  ${error.package} (${error.location}): ${error.error}`);
        }
      }

      if (upToDate.length > 0) {
        relinka("success", `${upToDate.length} dependencies are up to date`);
      }

      if (toUpdate.length === 0) {
        relinka("info", "All dependencies are up to date");
        return;
      }

      relinka("info", `${toUpdate.length} dependencies can be updated:`);
      for (const update of toUpdate) {
        relinka(
          "log",
          `  ${update.package} (${update.location}): ${update.currentVersion} → ${update.latestVersion}`,
        );
      }

      if (args["dry-run"]) {
        relinka("info", "Dry run mode - no changes were made");
        return;
      }

      // Update package.json
      relinka("info", "Updating package.json...");

      const updatedPackageJson = { ...packageJson };

      for (const update of toUpdate) {
        const dep = update.package;
        const newVersion = `^${update.latestVersion}`;
        const location = update.location;

        if (location === "dependencies" && dependencies[dep]) {
          if (!updatedPackageJson.dependencies) updatedPackageJson.dependencies = {};
          updatedPackageJson.dependencies[dep] = newVersion;
        } else if (location === "devDependencies" && devDependencies[dep]) {
          if (!updatedPackageJson.devDependencies) updatedPackageJson.devDependencies = {};
          updatedPackageJson.devDependencies[dep] = newVersion;
        } else if (location === "peerDependencies" && peerDependencies[dep]) {
          if (!updatedPackageJson.peerDependencies) updatedPackageJson.peerDependencies = {};
          updatedPackageJson.peerDependencies[dep] = newVersion;
        } else if (location === "optionalDependencies" && optionalDependencies[dep]) {
          if (!updatedPackageJson.optionalDependencies)
            updatedPackageJson.optionalDependencies = {};
          updatedPackageJson.optionalDependencies[dep] = newVersion;
        } else if (location === "catalog" && catalog[dep]) {
          // Update catalog
          if (!(updatedPackageJson as any).workspaces) (updatedPackageJson as any).workspaces = {};
          if (!(updatedPackageJson as any).workspaces.catalog)
            (updatedPackageJson as any).workspaces.catalog = {};
          (updatedPackageJson as any).workspaces.catalog[dep] = newVersion;

          // Also update top-level catalog if it exists
          if ((updatedPackageJson as any).catalog) {
            (updatedPackageJson as any).catalog[dep] = newVersion;
          }
        } else if (location?.startsWith("catalogs.")) {
          // Update named catalog
          const catalogName = location.split(".")[1];
          if (catalogName) {
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
        }
      }

      // Write updated package.json
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(updatedPackageJson, null, 2) + "\n",
        "utf8",
      );

      relinka("success", `Updated ${toUpdate.length} dependencies in package.json`);

      if (typeof Bun !== "undefined") {
        await $`bun install`;
        if (packageJson.scripts?.check && args["with-check-script"]) {
          await $`bun check`;
        }
      } else {
        relinka("info", "Run your package manager's install command to apply the changes");
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
