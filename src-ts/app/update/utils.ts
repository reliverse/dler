import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { multiselectPrompt } from "@reliverse/rempts";
import { $ } from "bun";
import { lookpath } from "lookpath";
import pMap from "p-map";
import { readPackageJSON } from "pkg-types";
import semver from "semver";
import { glob } from "tinyglobby";
import { getAllPkgManagers, type PackageManager } from "~/app/utils/dependencies/getUserPkgManager";
import { x } from "~/app/utils/exec/exec-mod";
import { detectPackageManager } from "~/app/utils/pm/pm-detect";
import { latestVersion } from "~/app/utils/pm/pm-meta";
import { getCurrentWorkingDirectory } from "~/app/utils/terminalHelpers";

export interface UpgradeResult {
  tool: string;
  status: "upgraded" | "up-to-date" | "not-found" | "error";
  message?: string;
}

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

// Cache for version lookups to avoid duplicate API calls
export const versionCache = new Map<string, { version: string; timestamp: number }>();
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
 * Collect dependencies from package.json according to flags.
 * Returns a map of dependency name to its version and all locations where it appears.
 */
export function collectTargetDependencies(
  pkg: any,
  args: any,
): { map: Record<string, DependencyInfo> } {
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

// Find all workspace package.json paths from root cwd. Supports workspaces array or { packages: [] }.
export async function findWorkspacePackageJsons(cwd: string): Promise<string[]> {
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
export async function isMonorepo(cwd: string): Promise<boolean> {
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
export async function findAllPackageJsons(cwd: string): Promise<string[]> {
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
export async function fetchVersionFromRegistry(packageName: string): Promise<string> {
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
export async function getLatestVersion(packageName: string): Promise<string> {
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
 * Filter and prepare dependencies for updating
 */
export function prepareDependenciesForUpdate(
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
 * Update dependencies across all workspace packages
 */
export async function updateWorkspacePackages(
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
 * Get globally installed packages for different package managers
 */
export async function getGlobalPackages(packageManager: string): Promise<Record<string, string>> {
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
export async function runInstallCommand(packageManager: any, linker?: string): Promise<void> {
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
export async function runInstallCommandWithFilter(
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
export async function updateGlobalPackage(
  packageManager: string,
  packageName: string,
): Promise<boolean> {
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
export async function handleGlobalUpdates(args: any): Promise<void> {
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

export async function upgradeDlerLocal(): Promise<UpgradeResult> {
  try {
    const pkg = await readPackageJSON();
    const hasDler =
      (pkg.dependencies && "@reliverse/dler" in pkg.dependencies) ||
      (pkg.devDependencies && "@reliverse/dler" in pkg.devDependencies);

    if (!hasDler) {
      return { tool: "dler (local)", status: "not-found" };
    }

    const packageManager = await detectPackageManager(process.cwd());
    if (!packageManager) {
      return { tool: "dler (local)", status: "error", message: "No package manager detected" };
    }

    // Use detected package manager to upgrade
    const { exitCode } = await x(packageManager.command, ["update", "@reliverse/dler"], {
      nodeOptions: { stdio: "pipe" },
    });

    return exitCode === 0
      ? { tool: "dler (local)", status: "upgraded", message: `via ${packageManager.command}` }
      : { tool: "dler (local)", status: "error", message: "Upgrade failed" };
  } catch (error) {
    return {
      tool: "dler (local)",
      status: "not-found",
    };
  }
}

export async function upgradeDlerGlobal(): Promise<UpgradeResult> {
  try {
    const dlerPath = await lookpath("dler");
    if (!dlerPath) {
      return { tool: "dler (global)", status: "not-found" };
    }

    // Try to upgrade with different package managers
    const packageManagers = ["bun", "npm", "yarn", "pnpm"];

    for (const pm of packageManagers) {
      const pmPath = await lookpath(pm);
      if (pmPath) {
        try {
          const args =
            pm === "npm"
              ? ["install", "-g", "@reliverse/dler@latest"]
              : pm === "yarn"
                ? ["global", "add", "@reliverse/dler@latest"]
                : ["install", "-g", "@reliverse/dler@latest"];

          const { exitCode } = await x(pm, args, {
            nodeOptions: { stdio: "pipe" },
          });

          if (exitCode === 0) {
            return { tool: "dler (global)", status: "upgraded", message: `via ${pm}` };
          }
        } catch {
          /* empty */
        }
      }
    }

    return { tool: "dler (global)", status: "error", message: "No suitable package manager found" };
  } catch (error) {
    return { tool: "dler (global)", status: "error", message: String(error) };
  }
}

export async function upgradeGit(): Promise<UpgradeResult> {
  try {
    const gitPath = await lookpath("git");
    if (!gitPath) {
      return { tool: "git", status: "not-found" };
    }

    // Git doesn't have a built-in upgrade command, suggest manual upgrade
    const { stdout } = await x("git", ["--version"], {
      nodeOptions: { stdio: "pipe" },
    });

    return {
      tool: "git",
      status: "up-to-date",
      message: `${stdout.trim()} - manual upgrade required`,
    };
  } catch (error) {
    return { tool: "git", status: "error", message: String(error) };
  }
}

export async function upgradeNode(): Promise<UpgradeResult> {
  try {
    const nodePath = await lookpath("node");
    if (!nodePath) {
      return { tool: "node.js", status: "not-found" };
    }

    const { stdout } = await x("node", ["--version"], {
      nodeOptions: { stdio: "pipe" },
    });

    // Node.js doesn't have self-upgrade, suggest manual upgrade
    return {
      tool: "node.js",
      status: "up-to-date",
      message: `${stdout.trim()} - manual upgrade required`,
    };
  } catch (error) {
    return { tool: "node.js", status: "error", message: String(error) };
  }
}

export async function upgradeNpm(): Promise<UpgradeResult> {
  try {
    const npmPath = await lookpath("npm");
    if (!npmPath) {
      return { tool: "npm", status: "not-found" };
    }

    // Try without stdio pipe first, then with inherit as fallback
    try {
      const { exitCode, stdout, stderr } = await x("npm", ["install", "-g", "npm@latest"], {
        nodeOptions: { stdio: "pipe" },
      });

      if (exitCode === 0) {
        // Check if output indicates it was already up-to-date
        const output = (stdout + stderr).toLowerCase();
        if (
          output.includes("unchanged") ||
          output.includes("up-to-date") ||
          output.includes("already")
        ) {
          return { tool: "npm", status: "up-to-date" };
        }
        return { tool: "npm", status: "upgraded" };
      } else {
        return { tool: "npm", status: "error", message: "Upgrade failed" };
      }
    } catch (pipeError) {
      // Fallback to inherit stdio if pipe fails
      const { exitCode } = await x("npm", ["install", "-g", "npm@latest"], {
        nodeOptions: { stdio: "inherit" },
      });

      return exitCode === 0
        ? { tool: "npm", status: "upgraded" }
        : { tool: "npm", status: "error", message: "Upgrade failed" };
    }
  } catch (error) {
    return { tool: "npm", status: "error", message: String(error) };
  }
}

export async function upgradeBun(): Promise<UpgradeResult> {
  try {
    const bunPath = await lookpath("bun");
    if (!bunPath) {
      return { tool: "bun", status: "not-found" };
    }

    const { exitCode, stdout, stderr } = await x("bun", ["upgrade"], {
      nodeOptions: { stdio: "pipe" },
    });

    if (exitCode !== 0) {
      return { tool: "bun", status: "error", message: "Upgrade failed" };
    }

    const output = (stdout + stderr).toLowerCase();

    // Check if bun was already up-to-date
    if (output.includes("already") || output.includes("up-to-date") || output.includes("latest")) {
      return { tool: "bun", status: "up-to-date" };
    }

    // If upgrade command succeeded and didn't say it was up-to-date, assume it upgraded
    return { tool: "bun", status: "upgraded" };
  } catch (error) {
    return { tool: "bun", status: "error", message: String(error) };
  }
}

export async function upgradeYarn(): Promise<UpgradeResult> {
  try {
    const yarnPath = await lookpath("yarn");
    if (!yarnPath) {
      return { tool: "yarn", status: "not-found" };
    }

    // Try yarn self-upgrade first (works for Yarn 1.x)
    try {
      const { exitCode: upgradeResult } = await x("yarn", ["self-update"], {
        nodeOptions: { stdio: "pipe" },
      });

      if (upgradeResult === 0) {
        return { tool: "yarn", status: "upgraded", message: "self-update" };
      }
    } catch {
      // Fall back to npm upgrade for Yarn 2+
    }

    // Fallback: upgrade via npm
    const npmPath = await lookpath("npm");
    if (npmPath) {
      const { exitCode } = await x("npm", ["install", "-g", "yarn@latest"], {
        nodeOptions: { stdio: "pipe" },
      });

      return exitCode === 0
        ? { tool: "yarn", status: "upgraded", message: "via npm" }
        : { tool: "yarn", status: "error", message: "Upgrade failed" };
    }

    return { tool: "yarn", status: "error", message: "No upgrade method available" };
  } catch (error) {
    return { tool: "yarn", status: "error", message: String(error) };
  }
}

export async function upgradePnpm(): Promise<UpgradeResult> {
  try {
    const pnpmPath = await lookpath("pnpm");
    if (!pnpmPath) {
      return { tool: "pnpm", status: "not-found" };
    }

    // Try pnpm self-upgrade
    try {
      const { exitCode } = await x("pnpm", ["add", "-g", "pnpm@latest"], {
        nodeOptions: { stdio: "pipe" },
      });

      return exitCode === 0
        ? { tool: "pnpm", status: "upgraded" }
        : { tool: "pnpm", status: "error", message: "Upgrade failed" };
    } catch {
      // Fallback to npm
      const npmPath = await lookpath("npm");
      if (npmPath) {
        const { exitCode } = await x("npm", ["install", "-g", "pnpm@latest"], {
          nodeOptions: { stdio: "pipe" },
        });

        return exitCode === 0
          ? { tool: "pnpm", status: "upgraded", message: "via npm" }
          : { tool: "pnpm", status: "error", message: "Upgrade failed" };
      }

      return { tool: "pnpm", status: "error", message: "No upgrade method available" };
    }
  } catch (error) {
    return { tool: "pnpm", status: "error", message: String(error) };
  }
}
