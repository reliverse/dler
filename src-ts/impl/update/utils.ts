import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import rematch from "@reliverse/rematch";
import { $ } from "bun";
import semver from "semver";
import {
  getAllPkgManagers,
  type PackageManager,
} from "~/impl/utils/dependencies/getUserPkgManager";
import { latestVersion } from "~/impl/utils/pm/pm-meta";
import { getCurrentWorkingDirectory } from "~/impl/utils/terminalHelpers";

export interface UpdateResult {
  package: string;
  currentVersion: string;
  latestVersion: string;
  updated: boolean;
  error?: string;
  semverCompatible?: boolean;
  location?: string; // Track where the dependency comes from (dependencies, devDependencies, catalog, etc.)
}

export interface DependencyInfo {
  versionSpec: string;
  locations: Set<string>;
}

export interface PackageCheckOptions {
  allowMajor: boolean;
  savePrefix: string;
  concurrency: number;
}

/**
 * Check if a dependency is an npm alias (e.g., "npm:package-name@version")
 */
export function isNpmAlias(versionSpec: string): boolean {
  return versionSpec.startsWith("npm:");
}

/**
 * Check if a dependency is a workspace dependency (e.g., "workspace:*")
 */
export function isWorkspaceDependency(versionSpec: string): boolean {
  return versionSpec.startsWith("workspace:");
}

// Detect catalog reference like `catalog:foo`
export function isCatalogReference(versionSpec: string): boolean {
  return versionSpec.startsWith("catalog:");
}

// Detect other non-semver specs we should skip updating
export function isNonSemverSpecifier(versionSpec: string): boolean {
  return (
    isNpmAlias(versionSpec) ||
    isWorkspaceDependency(versionSpec) ||
    isCatalogReference(versionSpec) ||
    versionSpec.startsWith("git+") ||
    versionSpec.startsWith("file:") ||
    versionSpec.startsWith("link:") ||
    versionSpec.startsWith("http:") ||
    versionSpec.startsWith("https:")
  );
}

/**
 * Check if a version update is semver-compatible with the current version range
 * Note: Returns false for exact versions (handled separately in checkPackageUpdate)
 */
export function isSemverCompatible(currentVersionRange: string, latestVersion: string): boolean {
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
 * Collect ALL dependencies from package.json.
 * Returns a map of dependency name to its version and all locations where it appears.
 */
export function collectTargetDependencies(pkg: any): { map: Record<string, DependencyInfo> } {
  const map: Record<string, DependencyInfo> = {};

  const dependencies = pkg.dependencies || {};
  const devDependencies = pkg.devDependencies || {};
  const peerDependencies = pkg.peerDependencies || {};
  const optionalDependencies = pkg.optionalDependencies || {};

  // Production dependencies
  for (const dep of Object.keys(dependencies)) {
    const version = dependencies[dep];
    if (!version) continue;
    if (!map[dep]) map[dep] = { versionSpec: version, locations: new Set() };
    map[dep].versionSpec = version;
    map[dep].locations.add("dependencies");
  }

  // Development dependencies
  for (const dep of Object.keys(devDependencies)) {
    const version = devDependencies[dep];
    if (!version) continue;
    if (!map[dep]) map[dep] = { versionSpec: version, locations: new Set() };
    map[dep].versionSpec = version;
    map[dep].locations.add("devDependencies");
  }

  // Peer dependencies
  for (const dep of Object.keys(peerDependencies)) {
    const version = peerDependencies[dep];
    if (!version) continue;
    if (!map[dep]) map[dep] = { versionSpec: version, locations: new Set() };
    map[dep].versionSpec = version;
    map[dep].locations.add("peerDependencies");
  }

  // Optional dependencies
  for (const dep of Object.keys(optionalDependencies)) {
    const version = optionalDependencies[dep];
    if (!version) continue;
    if (!map[dep]) map[dep] = { versionSpec: version, locations: new Set() };
    map[dep].versionSpec = version;
    map[dep].locations.add("optionalDependencies");
  }

  // Catalog dependencies

  // Check for workspaces.catalog
  const workspacesCatalog = pkg.workspaces?.catalog || {};
  for (const dep of Object.keys(workspacesCatalog)) {
    const version = workspacesCatalog[dep];
    if (!version) continue;
    if (!map[dep]) map[dep] = { versionSpec: version, locations: new Set() };
    map[dep].versionSpec = version;
    map[dep].locations.add("catalog");
  }

  // Check for workspaces.catalogs (named catalogs)
  const workspacesCatalogs = pkg.workspaces?.catalogs || {};
  for (const catalogName of Object.keys(workspacesCatalogs)) {
    const catalog = workspacesCatalogs[catalogName] || {};
    for (const dep of Object.keys(catalog)) {
      const version = catalog[dep];
      if (!version) continue;
      if (!map[dep]) map[dep] = { versionSpec: version, locations: new Set() };
      map[dep].versionSpec = version;
      map[dep].locations.add(`catalogs.${catalogName}`);
    }
  }

  // Check for top-level catalog (legacy)
  const topLevelCatalog = pkg.catalog || {};
  for (const dep of Object.keys(topLevelCatalog)) {
    const version = topLevelCatalog[dep];
    if (!version) continue;
    if (!map[dep]) map[dep] = { versionSpec: version, locations: new Set() };
    map[dep].versionSpec = version;
    map[dep].locations.add("catalog");
  }

  // Check for top-level catalogs (legacy)
  const topLevelCatalogs = pkg.catalogs || {};
  for (const catalogName of Object.keys(topLevelCatalogs)) {
    const catalog = topLevelCatalogs[catalogName] || {};
    for (const dep of Object.keys(catalog)) {
      const version = catalog[dep];
      if (!version) continue;
      if (!map[dep]) map[dep] = { versionSpec: version, locations: new Set() };
      map[dep].versionSpec = version;
      map[dep].locations.add(`catalogs.${catalogName}`);
    }
  }

  return { map };
}

/**
 * Apply a version update into all relevant places in package.json for a dependency.
 */
export function applyVersionUpdate(
  pkg: any,
  depName: string,
  newVersion: string,
  locations: Set<string>,
): void {
  if (locations.has("dependencies")) {
    if (!pkg.dependencies) pkg.dependencies = {};
    pkg.dependencies[depName] = newVersion;
  }
  if (locations.has("devDependencies")) {
    if (!pkg.devDependencies) pkg.devDependencies = {};
    pkg.devDependencies[depName] = newVersion;
  }
  if (locations.has("peerDependencies")) {
    if (!pkg.peerDependencies) pkg.peerDependencies = {};
    pkg.peerDependencies[depName] = newVersion;
  }
  if (locations.has("optionalDependencies")) {
    if (!pkg.optionalDependencies) pkg.optionalDependencies = {};
    pkg.optionalDependencies[depName] = newVersion;
  }

  // For catalogs, update both workspaces.* and top-level if present
  const ensureWorkspaces = () => {
    if (!(pkg as any).workspaces) (pkg as any).workspaces = {};
  };

  if (locations.has("catalog")) {
    ensureWorkspaces();
    if (!(pkg as any).workspaces.catalog) (pkg as any).workspaces.catalog = {};
    (pkg as any).workspaces.catalog[depName] = newVersion;
    if ((pkg as any).catalog) (pkg as any).catalog[depName] = newVersion;
  }

  for (const loc of locations) {
    const match = /^catalogs\.(.+)$/.exec(loc);
    if (match) {
      const catalogName = (match[1] ?? "") as string;
      if (!catalogName) continue;
      ensureWorkspaces();
      if (!(pkg as any).workspaces.catalogs) (pkg as any).workspaces.catalogs = {};
      if (!(pkg as any).workspaces.catalogs[catalogName])
        (pkg as any).workspaces.catalogs[catalogName] = {};
      (pkg as any).workspaces.catalogs[catalogName][depName] = newVersion;
      if ((pkg as any).catalogs && (pkg as any).catalogs[catalogName]) {
        (pkg as any).catalogs[catalogName][depName] = newVersion;
      }
    }
  }
}

/**
 * Fallback function to fetch package version directly from npm registry
 */
export async function fetchVersionFromRegistry(packageName: string): Promise<string> {
  const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = (await response.json()) as { version: string };
  return data.version;
}

/**
 * Get latest version of a package
 */
export async function getLatestVersion(packageName: string): Promise<string> {
  try {
    return await latestVersion(packageName);
  } catch (error) {
    // Simple fallback to npm registry
    try {
      return await fetchVersionFromRegistry(packageName);
    } catch (fallbackError) {
      throw new Error(`Failed to get latest version for ${packageName}: ${error}`);
    }
  }
}

/**
 * Check if a package needs updating and get update information
 *
 * Update behavior:
 * - Gets latest version from registry (not just semver-compatible)
 * - Exact versions (1.0.0): Always allow updates to latest
 * - Prefixed versions (^1.0.0, ~1.0.0): Updates to latest if allowMajor=true (default)
 * - When allowMajor=false: Only allows updates within semver range
 */
export async function checkPackageUpdate(
  packageName: string,
  versionSpec: string,
  locations: Set<string>,
  options: PackageCheckOptions,
): Promise<UpdateResult> {
  try {
    const latest = await getLatestVersion(packageName);
    const cleanCurrent = versionSpec.replace(/^[\^~]/, "");
    let isCompatible = isSemverCompatible(versionSpec, latest);
    const isExact = !versionSpec.startsWith("^") && !versionSpec.startsWith("~");

    // Allow updates to latest version: exact versions always, and major updates when enabled (default)
    if (isExact || (!isCompatible && options.allowMajor)) {
      isCompatible = true;
    }

    return {
      package: packageName,
      currentVersion: cleanCurrent,
      latestVersion: latest,
      updated: latest !== cleanCurrent && isCompatible,
      semverCompatible: isCompatible,
      location: Array.from(locations).join(", "),
    };
  } catch (error) {
    return {
      package: packageName,
      currentVersion: versionSpec,
      latestVersion: versionSpec,
      updated: false,
      error: error instanceof Error ? error.message : String(error),
      semverCompatible: false,
      location: Array.from(locations).join(", "),
    };
  }
}

/**
 * Filter and prepare dependencies for updating with glob pattern support
 */
export function prepareDependenciesForUpdate(
  allDepsMap: Record<string, DependencyInfo>,
  args: any,
): string[] {
  // Filter dependencies based on name and ignore parameters
  const depsToUpdate = Object.keys(allDepsMap);
  let filteredDeps: string[] = [];

  if (args.name && args.name.length > 0) {
    // Update only specified dependencies (supports glob patterns)
    const namePatterns = args.name as string[];
    filteredDeps = depsToUpdate.filter((dep) => {
      return namePatterns.some((pattern) => {
        // If pattern contains glob chars, use rematch; otherwise exact match
        if (
          pattern.includes("*") ||
          pattern.includes("?") ||
          pattern.includes("[") ||
          pattern.includes("{")
        ) {
          return rematch(pattern, dep);
        }
        return dep === pattern;
      });
    });

    // Show helpful info about pattern matching
    const exactMatches = filteredDeps.filter((dep) => namePatterns.includes(dep));
    const patternMatches = filteredDeps.length - exactMatches.length;

    if (patternMatches > 0) {
      relinka(
        "verbose",
        `Found ${exactMatches.length} exact matches and ${patternMatches} pattern matches`,
      );
    }

    if (filteredDeps.length === 0) {
      relinka("warn", `No dependencies found matching patterns: ${namePatterns.join(", ")}`);
    }
  } else {
    // Update all dependencies, respecting ignore list (supports glob patterns)
    const ignoreList = args.ignore || [];
    filteredDeps = depsToUpdate.filter((dep) => {
      return !ignoreList.some((ignorePattern: string) => {
        // If pattern contains glob chars, use rematch; otherwise exact match
        if (
          ignorePattern.includes("*") ||
          ignorePattern.includes("?") ||
          ignorePattern.includes("[") ||
          ignorePattern.includes("{")
        ) {
          return rematch(ignorePattern, dep);
        }
        return dep === ignorePattern;
      });
    });

    // Show info about ignored packages
    const ignoredCount = depsToUpdate.length - filteredDeps.length;
    if (ignoredCount > 0 && ignoreList.length > 0) {
      relinka("verbose", `Ignored ${ignoredCount} dependencies matching ignore patterns`);
    }
  }

  // Filter out aliases, workspace, catalog and other non-semver specs
  // By default, include all semver-compatible dependencies (both prefixed and exact)
  return filteredDeps.filter((dep) => {
    const versionSpec = allDepsMap[dep]?.versionSpec ?? "";
    if (!versionSpec) return false;
    if (isNonSemverSpecifier(versionSpec)) return false;
    // Include all semver-compatible dependencies by default
    return true;
  });
}

/**
 * Update a single package.json file with new dependency versions
 */
export async function updatePackageJsonFile(
  packageJsonPath: string,
  dependencies: Record<string, DependencyInfo>,
  updatesToApply: UpdateResult[],
  savePrefix: string,
): Promise<number> {
  if (updatesToApply.length === 0) return 0;

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as Record<
      string,
      any
    >;
    const updatedPackageJson = { ...packageJson };

    for (const update of updatesToApply) {
      const prefix = savePrefix === "none" ? "" : savePrefix;
      const newVersion = `${prefix}${update.latestVersion}`;
      const locations = dependencies[update.package]?.locations || new Set<string>();
      applyVersionUpdate(updatedPackageJson, update.package, newVersion, locations);
    }

    await fs.writeFile(packageJsonPath, JSON.stringify(updatedPackageJson, null, 2) + "\n", "utf8");

    return updatesToApply.length;
  } catch (error) {
    relinka(
      "warn",
      `Failed to update ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 0;
  }
}

/**
 * Display update results in a formatted way
 */
export function displayUpdateResults(results: UpdateResult[]): void {
  const toUpdate = results.filter((r) => r.updated && !r.error);
  const errors = results.filter((r) => r.error);
  const upToDate = results.filter((r) => !r.updated && !r.error && r.semverCompatible);

  // Show errors
  if (errors.length > 0) {
    relinka("warn", `Failed to check ${errors.length} dependencies:`);
    for (const error of errors) {
      relinka("warn", `  ${error.package} (${error.location}): ${error.error}`);
    }
  }

  // Show up-to-date packages
  if (upToDate.length > 0) {
    relinka("log", `${upToDate.length} deps are already up to date`);
  }

  // Show available updates
  if (toUpdate.length === 0) {
    relinka("verbose", `All ${upToDate.length} deps are already up to date`);
    return;
  }

  relinka("log", `${toUpdate.length} deps can be updated:`);

  // Group by location for better display
  const byLocation = new Map<string, UpdateResult[]>();
  for (const update of toUpdate) {
    const location = update.location || "unknown";
    if (!byLocation.has(location)) {
      byLocation.set(location, []);
    }
    byLocation.get(location)!.push(update);
  }

  for (const [location, updates] of byLocation.entries()) {
    relinka("log", `  ${location}:`);
    for (const update of updates) {
      relinka("log", `    ${update.package}: ${update.currentVersion} → ${update.latestVersion}`);
    }
  }
}

/**
 * Run install command for the detected package manager
 */
export async function runInstallCommand(packageManager: any): Promise<void> {
  try {
    switch (packageManager.name) {
      case "bun":
        await $`bun install`;
        break;
      case "npm":
        await $`npm install`;
        break;
      case "yarn":
        await $`yarn install`;
        break;
      case "pnpm":
        await $`pnpm install`;
        break;
      default:
        throw new Error(`Unsupported package manager: ${packageManager.name}`);
    }
  } catch (error) {
    relinka("warn", `Failed to run install command for ${packageManager.name}: ${error}`);
    throw error;
  }
}

export async function getPmOptions() {
  const projectPath = getCurrentWorkingDirectory();
  const detectedPMs = await getAllPkgManagers(projectPath);
  // Get unique detected package managers with their sources
  const detectedPMMap = new Map(detectedPMs.map((pm) => [pm.packageManager, pm.source]));
  // Create options list
  const pmOptions = ["bun", "pnpm", "npm", "yarn"].map((pm) => {
    const option: { label: string; value: PackageManager; hint?: string } = {
      label: pm,
      value: pm as PackageManager,
    };
    const source = detectedPMMap.get(pm as PackageManager);
    if (source && source !== "default") {
      option.hint = "detected";
    }
    return option;
  });
  // Get default value from detected PMs or fallback to npm
  const defaultValue = [...detectedPMMap.keys()][0] ?? "npm";
  // Return options and default value
  return { pmOptions, defaultValue };
}
