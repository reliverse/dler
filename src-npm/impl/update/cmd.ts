// usage example: bun npm/dler.ts update --dry-run --with-install

import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand, multiselectPrompt } from "@reliverse/rempts";
import { $ } from "bun";
import { lookpath } from "lookpath";
import pMap from "p-map";
import { readPackageJSON } from "pkg-types";
import semver from "semver";
import { glob } from "tinyglobby";

import { getConfigBunfig } from "~/impl/config/load";
import { isCatalogSupported, updateCatalogs } from "~/impl/utils/pm/pm-catalog";
import { detectPackageManager } from "~/impl/utils/pm/pm-detect";
import { latestVersion } from "~/impl/utils/pm/pm-meta";

interface UpdateResult {
  package: string;
  currentVersion: string;
  latestVersion: string;
  updated: boolean;
  error?: string;
  semverCompatible?: boolean;
  location?: string; // Track where the dependency comes from (dependencies, devDependencies, catalog, etc.)
}

interface DependencyInfo {
  versionSpec: string;
  locations: Set<string>;
}

interface PackageCheckOptions {
  allowMajor: boolean;
  savePrefix: string;
  concurrency: number;
}

// Cache for version lookups to avoid duplicate API calls
const versionCache = new Map<string, { version: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

// Detect catalog reference like `catalog:foo`
function isCatalogReference(versionSpec: string): boolean {
  return versionSpec.startsWith("catalog:");
}

// Detect other non-semver specs we should skip updating
function isNonSemverSpecifier(versionSpec: string): boolean {
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
 * Collect dependencies from package.json according to flags.
 * Returns a map of dependency name to its version and all locations where it appears.
 */
function collectTargetDependencies(pkg: any, args: any): { map: Record<string, DependencyInfo> } {
  const map: Record<string, DependencyInfo> = {};

  const dependencies = pkg.dependencies || {};
  const devDependencies = pkg.devDependencies || {};
  const peerDependencies = pkg.peerDependencies || {};
  const optionalDependencies = pkg.optionalDependencies || {};

  const includeDeps =
    !args["dev-only"] && !args["peer-only"] && !args["optional-only"] && !args["catalogs-only"];
  const includeCatalogs =
    !args["dev-only"] && !args["peer-only"] && !args["optional-only"] && !args["prod-only"];

  if (args["prod-only"] || includeDeps) {
    for (const dep of Object.keys(dependencies)) {
      const version = dependencies[dep];
      if (!version) continue;
      if (!map[dep]) map[dep] = { versionSpec: version, locations: new Set() };
      map[dep].versionSpec = version;
      map[dep].locations.add("dependencies");
    }
  }

  if (args["dev-only"] || includeDeps) {
    for (const dep of Object.keys(devDependencies)) {
      const version = devDependencies[dep];
      if (!version) continue;
      if (!map[dep]) map[dep] = { versionSpec: version, locations: new Set() };
      map[dep].versionSpec = version;
      map[dep].locations.add("devDependencies");
    }
  }

  if (args["peer-only"] || includeDeps) {
    for (const dep of Object.keys(peerDependencies)) {
      const version = peerDependencies[dep];
      if (!version) continue;
      if (!map[dep]) map[dep] = { versionSpec: version, locations: new Set() };
      map[dep].versionSpec = version;
      map[dep].locations.add("peerDependencies");
    }
  }

  if (args["optional-only"] || includeDeps) {
    for (const dep of Object.keys(optionalDependencies)) {
      const version = optionalDependencies[dep];
      if (!version) continue;
      if (!map[dep]) map[dep] = { versionSpec: version, locations: new Set() };
      map[dep].versionSpec = version;
      map[dep].locations.add("optionalDependencies");
    }
  }

  // Include catalog dependencies by default
  if (args["catalogs-only"] || includeCatalogs) {
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
  }

  return { map };
}

/**
 * Apply a version update into all relevant places in package.json for a dependency.
 */
function applyVersionUpdate(
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

// Find all workspace package.json paths from root cwd. Supports workspaces array or { packages: [] }.
async function findWorkspacePackageJsons(cwd: string): Promise<string[]> {
  const root = await readPackageJSON(cwd);
  const ws: any = (root as any).workspaces;
  let patterns: string[] = [];
  if (Array.isArray(ws)) {
    patterns = ws as string[];
  } else if (ws && Array.isArray(ws.packages)) {
    patterns = ws.packages as string[];
  }
  if (!patterns.length) return [];
  const dirs = await glob(patterns, {
    cwd,
    onlyDirectories: true,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  });
  const pkgJsonPaths: string[] = [];
  for (const dir of dirs) {
    const pj = path.join(dir, "package.json");
    if (await fs.pathExists(pj)) pkgJsonPaths.push(pj);
  }
  return pkgJsonPaths;
}

/**
 * Check if we're in a monorepo by detecting workspace configuration
 */
async function isMonorepo(cwd: string): Promise<boolean> {
  try {
    const root = await readPackageJSON(cwd);
    const ws: any = (root as any).workspaces;
    if (Array.isArray(ws) && ws.length > 0) {
      return true;
    }
    if (ws && Array.isArray(ws.packages) && ws.packages.length > 0) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Recursively find ALL package.json files in the directory tree
 */
async function findAllPackageJsons(cwd: string): Promise<string[]> {
  const packageJsonFiles = await glob("**/package.json", {
    cwd,
    absolute: true,
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/coverage/**",
      "**/.next/**",
      "**/.nuxt/**",
      "**/out/**",
    ],
  });

  // Filter out files that don't actually exist (glob can sometimes return stale results)
  const existingFiles: string[] = [];
  for (const file of packageJsonFiles) {
    if (await fs.pathExists(file)) {
      existingFiles.push(file);
    }
  }

  return existingFiles;
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
 * Get latest version with fallback mechanism and caching
 */
async function getLatestVersion(packageName: string): Promise<string> {
  // Check cache first
  const cached = versionCache.get(packageName);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.version;
  }

  try {
    const version = await latestVersion(packageName);
    versionCache.set(packageName, { version, timestamp: now });
    return version;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // For any error, try the registry fallback once
    try {
      const version = await fetchVersionFromRegistry(packageName);
      versionCache.set(packageName, { version, timestamp: now });
      return version;
    } catch (fallbackError) {
      throw new Error(
        `Latest version main check and npm registry fallback failed. Main check error: ${errorMessage}. Registry error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
      );
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
async function checkPackageUpdate(
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
 * Filter and prepare dependencies for updating
 */
function prepareDependenciesForUpdate(
  allDepsMap: Record<string, DependencyInfo>,
  args: any,
): string[] {
  // Filter dependencies based on name and ignore parameters
  const depsToUpdate = Object.keys(allDepsMap);
  let filteredDeps: string[] = [];

  if (args.name && args.name.length > 0) {
    // Update only specified dependencies
    filteredDeps = args.name.filter((dep: string) => dep in allDepsMap);
    const notFound = args.name.filter((dep: string) => !(dep in allDepsMap));
    if (notFound.length > 0) {
      relinka("warn", `Dependencies not found: ${notFound.join(", ")}`);
    }
  } else {
    // Update all dependencies, respecting ignore list
    const ignoreList = args.ignore || [];
    filteredDeps = depsToUpdate.filter((dep) => !ignoreList.includes(dep));
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
async function updatePackageJsonFile(
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
 * Update dependencies across all workspace packages
 */
async function updateWorkspacePackages(
  workspacePaths: string[],
  args: any,
  options: PackageCheckOptions,
): Promise<number> {
  if (workspacePaths.length === 0) return 0;

  relinka("log", `Scanning ${workspacePaths.length} workspace packages...`);
  let totalWorkspaceUpdated = 0;

  for (const packageJsonPath of workspacePaths) {
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as Record<
        string,
        any
      >;

      // Use same args for workspace packages (catalogs are included by default)
      const { map } = collectTargetDependencies(packageJson, args);
      const candidates = prepareDependenciesForUpdate(map, args);

      if (candidates.length === 0) continue;

      const results = await pMap(
        candidates,
        (dep) => {
          const depInfo = map[dep];
          if (!depInfo?.versionSpec) {
            return Promise.resolve({
              package: dep,
              currentVersion: "unknown",
              latestVersion: "unknown",
              updated: false,
              error: "Current version not found",
              semverCompatible: false,
              location: Array.from(depInfo?.locations || ["unknown"]).join(", "),
            } as UpdateResult);
          }
          return checkPackageUpdate(dep, depInfo.versionSpec, depInfo.locations, options);
        },
        { concurrency: options.concurrency },
      );

      const toUpdate = results.filter((r) => r.updated && !r.error);
      const updated = await updatePackageJsonFile(
        packageJsonPath,
        map,
        toUpdate,
        options.savePrefix,
      );

      if (updated > 0) {
        totalWorkspaceUpdated += updated;
        relinka("log", `Updated ${updated} deps in ${packageJsonPath}`);
      }
    } catch (error) {
      relinka(
        "warn",
        `Skipping ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return totalWorkspaceUpdated;
}

/**
 * Display update results in a formatted way
 */
function displayUpdateResults(results: UpdateResult[]): void {
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

  relinka("log", `Found package managers: ${availablePackageManagers.join(", ")}`);

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

  relinka("log", `Checking ${filteredPackages.length} global packages for updates...`);

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
    relinka("log", `${upToDate.length} global packages are up to date`);
  }

  if (toUpdate.length === 0) {
    relinka("log", "All global packages are up to date");
    return;
  }

  relinka("log", `${toUpdate.length} global packages can be updated:`);
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
      relinka("log", "Exiting global update process");
      return;
    }

    // Filter out "exit" and update toUpdate to only include selected packages
    const actualSelectedPackages = selectedPackages.filter((pkg) => pkg !== "exit");
    toUpdate = toUpdate.filter((update) => actualSelectedPackages.includes(update.package));
    relinka("log", `Updating ${actualSelectedPackages.length} selected global packages...`);
  }

  if (args["dry-run"]) {
    relinka("log", "Dry run mode - no changes were made");
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

  relinka("log", `Successfully updated ${successCount}/${toUpdate.length} global packages`);
}

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
  }),
  async run({ args }) {
    try {
      // Early argument validation for exclusive flags
      const exclusiveFlags = [
        args["dev-only"],
        args["prod-only"],
        args["peer-only"],
        args["optional-only"],
        args["catalogs-only"],
      ];

      if (exclusiveFlags.filter(Boolean).length > 1) {
        relinka(
          "error",
          "Cannot specify multiple exclusive flags (--dev-only, --prod-only, --peer-only, --optional-only, --catalogs-only)",
        );
        return process.exit(1);
      }

      // Validate mutually exclusive workspace flags
      if (args["all-workspaces"] && args["root-only"]) {
        relinka("error", "Cannot specify both --all-workspaces and --root-only flags");
        return process.exit(1);
      }

      if (args.recursive && (args["all-workspaces"] || args["root-only"])) {
        relinka(
          "error",
          "Cannot use --recursive with --all-workspaces or --root-only flags. Use --no-recursive to disable recursive mode.",
        );
        return process.exit(1);
      }

      // Handle global package updates
      if (args.global) {
        return await handleGlobalUpdates(args);
      }

      // Handle catalog-only updates (when user explicitly wants only catalogs)
      if (args["catalogs-only"]) {
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

        // Use bunfig linker setting if CLI uses default and bunfig has valid value
        const bunfigLinker = bunfigConfig?.install?.linker;
        if (
          bunfigLinker &&
          ["isolated", "hoisted"].includes(bunfigLinker) &&
          args.linker === "hoisted"
        ) {
          effectiveLinker = bunfigLinker;
          linkerSource =
            bunfigLinker === "hoisted" ? "bunfig.toml (same as default)" : "bunfig.toml";
        }
      }

      // Explicit CLI override always wins
      if (args.linker !== "hoisted") {
        effectiveLinker = args.linker;
        linkerSource = "CLI override";
      }

      relinka("verbose", `Using linker strategy: ${effectiveLinker} (from ${linkerSource})`);

      const packageJson = await readPackageJSON();

      const { map: allDepsMap } = collectTargetDependencies(packageJson, args);

      // Filter and prepare dependencies for updating
      const candidates = prepareDependenciesForUpdate(allDepsMap, args);

      if (candidates.length === 0) {
        relinka("warn", "No dependencies to update based on provided filters");
        return;
      }

      // Check versions concurrently using p-map with extracted function
      const options: PackageCheckOptions = {
        allowMajor: !!args["allow-major"],
        savePrefix: args["save-prefix"] as string,
        concurrency: args.concurrency,
      };

      const results = await pMap(
        candidates,
        async (dep): Promise<UpdateResult> => {
          const depInfo = allDepsMap[dep];
          if (!depInfo?.versionSpec) {
            return {
              package: dep,
              currentVersion: "unknown",
              latestVersion: "unknown",
              updated: false,
              error: "Current version not found",
              semverCompatible: false,
              location: Array.from(depInfo?.locations || ["unknown"]).join(", "),
            };
          }

          return checkPackageUpdate(dep, depInfo.versionSpec, depInfo.locations, options);
        },
        { concurrency: args.concurrency },
      );

      // Display results with improved formatting
      displayUpdateResults(results);

      let toUpdate = results.filter((r) => r.updated && !r.error);

      if (toUpdate.length === 0) {
        return;
      }

      // Interactive selection
      if (args.interactive) {
        const errors = results.filter((r) => r.error);
        const upToDate = results.filter((r) => !r.updated && !r.error && r.semverCompatible);

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
          relinka("log", "Exiting update process");
          return;
        }

        // Filter out "exit" and update toUpdate to only include selected packages
        const actualSelectedPackages = selectedPackages.filter((pkg) => pkg !== "exit");
        toUpdate = toUpdate.filter((update) => actualSelectedPackages.includes(update.package));
        relinka("log", `Updating ${actualSelectedPackages.length} selected dependencies...`);
      }

      if (args["dry-run"]) {
        relinka("log", "Dry run mode - no changes were made");
        return;
      }

      // Update root package.json
      const rootUpdated = await updatePackageJsonFile(
        packageJsonPath,
        allDepsMap,
        toUpdate,
        args["save-prefix"] as string,
      );

      let totalUpdated = rootUpdated;

      // Handle recursive updates (finds ALL package.json files)
      if (args.recursive) {
        const allPackageJsons = await findAllPackageJsons(process.cwd());
        // Exclude the root package.json since it's already updated
        const rootPackageJsonPath = path.resolve(process.cwd(), "package.json");
        const otherPackageJsons = allPackageJsons.filter((p) => p !== rootPackageJsonPath);

        if (otherPackageJsons.length > 0) {
          relinka(
            "verbose",
            `Found ${otherPackageJsons.length} additional package.json files to update recursively`,
          );
          const recursiveUpdated = await updateWorkspacePackages(otherPackageJsons, args, options);
          totalUpdated += recursiveUpdated;
        }
        // else {
        //   relinka("log", "No additional package.json files found for recursive update");
        // }
      } else {
        // Non-recursive mode: use workspace-based logic
        const isMonorepoProject = await isMonorepo(process.cwd());

        // Determine if we should update workspaces
        const shouldUpdateWorkspaces =
          args["all-workspaces"] || (!args["root-only"] && isMonorepoProject);

        if (shouldUpdateWorkspaces) {
          const workspacePkgJsons = await findWorkspacePackageJsons(process.cwd());
          if (workspacePkgJsons.length > 0) {
            const workspaceUpdated = await updateWorkspacePackages(
              workspacePkgJsons,
              args,
              options,
            );
            totalUpdated += workspaceUpdated;
          } else if (args["all-workspaces"]) {
            relinka("warn", "No workspace packages found but --all-workspaces flag was provided");
          }
        } else if (isMonorepoProject) {
          relinka("log", "Skipping workspace packages due to --root-only flag");
        }
      }

      // Success message based on what was actually updated
      if (args.recursive) {
        const allPackageJsonCount = (await findAllPackageJsons(process.cwd())).length;
        relinka(
          "log",
          `Updated ${totalUpdated} dependencies across ${allPackageJsonCount} package.json files`,
        );
      } else {
        const isMonorepoProject = await isMonorepo(process.cwd());
        const shouldUpdateWorkspaces =
          args["all-workspaces"] || (!args["root-only"] && isMonorepoProject);

        if (isMonorepoProject && shouldUpdateWorkspaces) {
          relinka(
            "log",
            `Updated ${totalUpdated} dependencies across workspace (root + workspaces)`,
          );
        } else if (isMonorepoProject) {
          relinka("log", `Updated ${totalUpdated} dependencies in root package.json only`);
        } else {
          relinka("log", `Updated ${totalUpdated} dependencies`);
        }
      }

      // Handle installation
      const packageManager = await detectPackageManager(process.cwd());

      if (!args["with-install"]) {
        const installCommand = packageManager?.command || "your package manager";
        relinka(
          "log",
          `Install step is skipped by default. Run '${installCommand} install' manually to apply the changes.`,
        );
        relinka(
          "log",
          `(experimental) Next time you can try --with-install flag to run it automatically.`,
        );
        return;
      }

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
          relinka("log", `Run '${packageManager.command} install' manually to apply the changes`);
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
