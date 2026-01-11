import zeptomatch from "@reliverse/matcha";
import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { logger } from "@reliverse/relinka";
import type { PackageJson } from "@reliverse/typerso";
import { $ } from "bun";
import semver from "semver";
import { loadCache, saveCache } from "../../utils/cache";

// Global cache for package versions to avoid repeated API calls
const versionCache = new Map<string, { version: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PERSISTENT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for persistent cache

interface PersistentCache {
  packages: Record<string, { version: string; timestamp: number }>;
  lastUpdated: number;
}

/**
 * Load persistent cache from disk
 */
async function loadPersistentCache(verbose = false): Promise<void> {
  try {
    const cacheData = await loadCache<PersistentCache>("update");

    if (cacheData) {
      // Only load cache if it's not older than 24 hours
      if (Date.now() - cacheData.lastUpdated < PERSISTENT_CACHE_TTL) {
        for (const [pkg, data] of Object.entries(cacheData.packages)) {
          versionCache.set(pkg, data as { version: string; timestamp: number });
        }
        if (verbose) {
          logger.debug(`Loaded ${Object.keys(cacheData.packages).length} cached package versions`);
        }
      } else {
        logger.debug("Persistent cache expired, ignoring");
      }
    }
  } catch (error) {
    // Silently ignore cache loading errors
    logger.debug(
      `Failed to load persistent cache: ${error instanceof Error ? error.message : String(error)}, continuing without it`
    );
  }
}

/**
 * Save persistent cache to disk
 */
async function savePersistentCache(): Promise<void> {
  try {
    const cacheData: PersistentCache = {
      packages: Object.fromEntries(versionCache.entries()),
      lastUpdated: Date.now(),
    };

    await saveCache("update", cacheData);
  } catch (error) {
    // Silently ignore cache saving errors
    logger.debug("Failed to save persistent cache");
  }
}

interface PackageJsonWithCatalogs extends PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: {
    packages?: string[];
    catalog?: Record<string, string>;
    catalogs?: Record<string, Record<string, string>>;
  };
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
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
 * Early filters out non-updateable dependencies to reduce processing.
 */
export function collectTargetDependencies(pkg: PackageJsonWithCatalogs): {
  map: Record<string, DependencyInfo>;
} {
  const map: Record<string, DependencyInfo> = {};

  const dependencies = pkg.dependencies || {};
  const devDependencies = pkg.devDependencies || {};
  const peerDependencies = pkg.peerDependencies || {};
  const optionalDependencies = pkg.optionalDependencies || {};

  // Helper function to add dependency with early filtering
  const addDependency = (dep: string, version: string, location: string) => {
    if (!version) return;

    // Early filter: skip non-semver specifiers
    if (isNonSemverSpecifier(version)) return;

    if (!map[dep]) {
      map[dep] = { versionSpec: version, locations: new Set() };
    }
    map[dep].versionSpec = version;
    map[dep].locations.add(location);
  };

  // Production dependencies
  for (const dep of Object.keys(dependencies)) {
    const version = dependencies[dep];
    if (version) {
      addDependency(dep, version, "dependencies");
    }
  }

  // Development dependencies
  for (const dep of Object.keys(devDependencies)) {
    const version = devDependencies[dep];
    if (version) {
      addDependency(dep, version, "devDependencies");
    }
  }

  // Peer dependencies
  for (const dep of Object.keys(peerDependencies)) {
    const version = peerDependencies[dep];
    if (version) {
      addDependency(dep, version, "peerDependencies");
    }
  }

  // Optional dependencies
  for (const dep of Object.keys(optionalDependencies)) {
    const version = optionalDependencies[dep];
    if (version) {
      addDependency(dep, version, "optionalDependencies");
    }
  }

  // Catalog dependencies

  // Check for workspaces.catalog
  const workspacesCatalog = pkg.workspaces?.catalog || {};
  for (const dep of Object.keys(workspacesCatalog)) {
    const version = workspacesCatalog[dep];
    if (version) {
      addDependency(dep, version, "catalog");
    }
  }

  // Check for workspaces.catalogs (named catalogs)
  const workspacesCatalogs = pkg.workspaces?.catalogs || {};
  for (const catalogName of Object.keys(workspacesCatalogs)) {
    const catalog = workspacesCatalogs[catalogName] || {};
    for (const dep of Object.keys(catalog)) {
      const version = catalog[dep];
      if (version) {
        addDependency(dep, version, `catalogs.${catalogName}`);
      }
    }
  }

  // Check for top-level catalog (legacy)
  const topLevelCatalog = pkg.catalog || {};
  for (const dep of Object.keys(topLevelCatalog)) {
    const version = topLevelCatalog[dep];
    if (!version) {
      continue;
    }
    if (!map[dep]) {
      map[dep] = { versionSpec: version, locations: new Set() };
    }
    map[dep].versionSpec = version;
    map[dep].locations.add("catalog");
  }

  // Check for top-level catalogs (legacy)
  const topLevelCatalogs = pkg.catalogs || {};
  for (const catalogName of Object.keys(topLevelCatalogs)) {
    const catalog = topLevelCatalogs[catalogName] || {};
    for (const dep of Object.keys(catalog)) {
      const version = catalog[dep];
      if (!version) {
        continue;
      }
      if (!map[dep]) {
        map[dep] = { versionSpec: version, locations: new Set() };
      }
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
  pkg: PackageJsonWithCatalogs,
  depName: string,
  newVersion: string,
  locations: Set<string>
): void {
  if (locations.has("dependencies")) {
    if (!pkg.dependencies) {
      pkg.dependencies = {};
    }
    pkg.dependencies[depName] = newVersion;
  }
  if (locations.has("devDependencies")) {
    if (!pkg.devDependencies) {
      pkg.devDependencies = {};
    }
    pkg.devDependencies[depName] = newVersion;
  }
  if (locations.has("peerDependencies")) {
    if (!pkg.peerDependencies) {
      pkg.peerDependencies = {};
    }
    pkg.peerDependencies[depName] = newVersion;
  }
  if (locations.has("optionalDependencies")) {
    if (!pkg.optionalDependencies) {
      pkg.optionalDependencies = {};
    }
    pkg.optionalDependencies[depName] = newVersion;
  }

  // For catalogs, update both workspaces.* and top-level if present
  const ensureWorkspaces = () => {
    if (!pkg.workspaces) {
      pkg.workspaces = {};
    }
  };

  if (locations.has("catalog")) {
    ensureWorkspaces();
    const workspaces = pkg.workspaces;
    if (workspaces) {
      if (!workspaces.catalog) {
        workspaces.catalog = {};
      }
      workspaces.catalog[depName] = newVersion;
    }
    if (pkg.catalog) {
      pkg.catalog[depName] = newVersion;
    }
  }

  for (const loc of locations) {
    const match = /^catalogs\.(.+)$/.exec(loc);
    if (match) {
      const catalogName = (match[1] ?? "") as string;
      if (!catalogName) {
        continue;
      }
      ensureWorkspaces();
      const workspaces = pkg.workspaces;
      if (workspaces) {
        if (!workspaces.catalogs) {
          workspaces.catalogs = {};
        }
        if (!workspaces.catalogs[catalogName]) {
          workspaces.catalogs[catalogName] = {};
        }
        workspaces.catalogs[catalogName][depName] = newVersion;
      }
      if (pkg.catalogs?.[catalogName]) {
        pkg.catalogs[catalogName][depName] = newVersion;
      }
    }
  }
}

/**
 * Fallback function to fetch package version directly from npm registry
 */
export async function fetchVersionFromRegistry(packageName: string): Promise<string> {
  // Normalize package name to lowercase (npm registry is case-insensitive but some tools expect this)
  const normalizedName = packageName.toLowerCase();

  const response = await fetch(`https://registry.npmjs.org/${normalizedName}/latest`, {
    headers: {
      // Use npm install headers for better compatibility and potentially faster responses
      accept: "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Package '${packageName}' not found in npm registry`);
    }
    throw new Error(
      `Failed to fetch version for '${packageName}': HTTP ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as { version: string };
  if (!data.version) {
    throw new Error(`No version found for package '${packageName}'`);
  }

  return data.version;
}

/**
 * Get latest version of a package with caching
 */
export async function getLatestVersion(packageName: string): Promise<string> {
  // Check cache first (includes both memory and persistent cache)
  const cached = versionCache.get(packageName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.version;
  }

  try {
    // Use Bun's built-in fetch to get the latest version from npm registry
    const version = await fetchVersionFromRegistry(packageName);

    // Cache the result
    versionCache.set(packageName, { version, timestamp: Date.now() });

    // Save persistent cache in background (don't await)
    savePersistentCache().catch(() => {
      // Ignore save errors
    });

    return version;
  } catch (error) {
    throw new Error(`Failed to get latest version for ${packageName}: ${error}`);
  }
}

/**
 * Initialize persistent cache (call this at the start of update operations)
 */
export async function initializeCache(verbose = false): Promise<void> {
  await loadPersistentCache(verbose);
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
  options: PackageCheckOptions
): Promise<UpdateResult> {
  try {
    const latest = await getLatestVersion(packageName);
    const cleanCurrent = versionSpec.replace(/^[\^~>=<]+/, ""); // Also remove >=, >, <, = prefixes
    let isCompatible = isSemverCompatible(versionSpec, latest);
    const isExact = !(
      versionSpec.startsWith("^") ||
      versionSpec.startsWith("~") ||
      versionSpec.startsWith(">=") ||
      versionSpec.startsWith(">") ||
      versionSpec.startsWith("<=") ||
      versionSpec.startsWith("<") ||
      versionSpec.startsWith("=")
    );

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
 * Filter and prepare dependencies for updating with glob pattern support (optimized for Map input)
 */
export function prepareDependenciesForUpdateFromMap(
  allDepsMap: Map<string, { versionSpec: string; locations: Set<string>; files: Set<string> }>,
  args: {
    name?: string[];
    ignore?: string[];
    ignoreFields?: string[];
  }
): string[] {
  // Filter dependencies based on name and ignore parameters
  const depsToUpdate = Array.from(allDepsMap.keys());
  let filteredDeps: string[] = [];

  if (args.name && args.name.length > 0) {
    // Update only specified dependencies (supports glob patterns)
    const namePatterns = args.name as string[];
    filteredDeps = depsToUpdate.filter((dep) => {
      return namePatterns.some((pattern) => {
        // If pattern contains glob chars, use zeptomatch; otherwise exact match
        if (
          pattern.includes("*") ||
          pattern.includes("?") ||
          pattern.includes("[") ||
          pattern.includes("{")
        ) {
          return zeptomatch.isMatch(pattern, dep);
        }
        return dep === pattern;
      });
    });

    // Show helpful info about pattern matching
    const exactMatches = filteredDeps.filter((dep) => namePatterns.includes(dep));
    const patternMatches = filteredDeps.length - exactMatches.length;

    if (patternMatches > 0) {
      logger.debug(
        `Found ${exactMatches.length} exact matches and ${patternMatches} pattern matches`
      );
    }

    if (filteredDeps.length === 0) {
      logger.warn(`No dependencies found matching patterns: ${namePatterns.join(", ")}`);
    }
  } else {
    // Update all dependencies, respecting ignore list (supports glob patterns)
    const ignoreList = args.ignore || [];
    filteredDeps = depsToUpdate.filter((dep) => {
      return !ignoreList.some((ignorePattern: string) => {
        // If pattern contains glob chars, use zeptomatch; otherwise exact match
        if (
          ignorePattern.includes("*") ||
          ignorePattern.includes("?") ||
          ignorePattern.includes("[") ||
          ignorePattern.includes("{")
        ) {
          return zeptomatch.isMatch(ignorePattern, dep);
        }
        return dep === ignorePattern;
      });
    });

    // Show info about ignored packages
    const ignoredCount = depsToUpdate.length - filteredDeps.length;
    if (ignoredCount > 0 && ignoreList.length > 0) {
      logger.debug(`Ignored ${ignoredCount} dependencies matching ignore patterns`);
    }
  }

  // Filter out dependencies in ignored fields
  const ignoreFields = args.ignoreFields || [];
  if (ignoreFields.length > 0) {
    filteredDeps = filteredDeps.filter((dep) => {
      const depInfo = allDepsMap.get(dep);
      if (!depInfo) return false;

      // Check if any of the dependency's locations should be ignored
      return !Array.from(depInfo.locations).some((location) => ignoreFields.includes(location));
    });

    const ignoredFieldsCount = depsToUpdate.length - filteredDeps.length;
    if (ignoredFieldsCount > 0) {
      logger.debug(
        `Ignored ${ignoredFieldsCount} dependencies in ignored fields: ${ignoreFields.join(", ")}`
      );
    }
  }

  // All dependencies are already filtered during collection, just return filteredDeps
  return filteredDeps;
}

/**
 * Filter and prepare dependencies for updating with glob pattern support
 */
export function prepareDependenciesForUpdate(
  allDepsMap: Record<string, DependencyInfo>,
  args: {
    name?: string[];
    ignore?: string[];
    ignoreFields?: string[];
  }
): string[] {
  // Filter dependencies based on name and ignore parameters
  const depsToUpdate = Object.keys(allDepsMap);
  let filteredDeps: string[] = [];

  if (args.name && args.name.length > 0) {
    // Update only specified dependencies (supports glob patterns)
    const namePatterns = args.name as string[];
    filteredDeps = depsToUpdate.filter((dep) => {
      return namePatterns.some((pattern) => {
        // If pattern contains glob chars, use zeptomatch; otherwise exact match
        if (
          pattern.includes("*") ||
          pattern.includes("?") ||
          pattern.includes("[") ||
          pattern.includes("{")
        ) {
          return zeptomatch.isMatch(pattern, dep);
        }
        return dep === pattern;
      });
    });

    // Show helpful info about pattern matching
    const exactMatches = filteredDeps.filter((dep) => namePatterns.includes(dep));
    const patternMatches = filteredDeps.length - exactMatches.length;

    if (patternMatches > 0) {
      logger.debug(
        `Found ${exactMatches.length} exact matches and ${patternMatches} pattern matches`
      );
    }

    if (filteredDeps.length === 0) {
      logger.warn(`No dependencies found matching patterns: ${namePatterns.join(", ")}`);
    }
  } else {
    // Update all dependencies, respecting ignore list (supports glob patterns)
    const ignoreList = args.ignore || [];
    filteredDeps = depsToUpdate.filter((dep) => {
      return !ignoreList.some((ignorePattern: string) => {
        // If pattern contains glob chars, use zeptomatch; otherwise exact match
        if (
          ignorePattern.includes("*") ||
          ignorePattern.includes("?") ||
          ignorePattern.includes("[") ||
          ignorePattern.includes("{")
        ) {
          return zeptomatch.isMatch(ignorePattern, dep);
        }
        return dep === ignorePattern;
      });
    });

    // Show info about ignored packages
    const ignoredCount = depsToUpdate.length - filteredDeps.length;
    if (ignoredCount > 0 && ignoreList.length > 0) {
      logger.debug(`Ignored ${ignoredCount} dependencies matching ignore patterns`);
    }
  }

  // Filter out dependencies in ignored fields
  const ignoreFields = args.ignoreFields || [];
  if (ignoreFields.length > 0) {
    filteredDeps = filteredDeps.filter((dep) => {
      const locations = allDepsMap[dep]?.locations || new Set<string>();
      // Check if any of the dependency's locations should be ignored
      return !Array.from(locations).some((location) => ignoreFields.includes(location));
    });

    const ignoredFieldsCount = depsToUpdate.length - filteredDeps.length;
    if (ignoredFieldsCount > 0) {
      logger.debug(
        `Ignored ${ignoredFieldsCount} dependencies in ignored fields: ${ignoreFields.join(", ")}`
      );
    }
  }

  // Filter out aliases, workspace, catalog and other non-semver specs
  // By default, include all semver-compatible dependencies (both prefixed and exact)
  return filteredDeps.filter((dep) => {
    const versionSpec = allDepsMap[dep]?.versionSpec ?? "";
    if (!versionSpec) {
      return false;
    }
    if (isNonSemverSpecifier(versionSpec)) {
      return false;
    }
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
  fieldsToIgnore: string[] = []
): Promise<number> {
  if (updatesToApply.length === 0) {
    return 0;
  }

  try {
    const packageJson = JSON.parse(
      await fs.readFile(packageJsonPath, { encoding: "utf8" })
    ) as PackageJsonWithCatalogs;
    const updatedPackageJson = { ...packageJson };

    for (const update of updatesToApply) {
      const depInfo = dependencies[update.package];
      if (!depInfo) {
        continue;
      }

      const locations = depInfo.locations || new Set<string>();

      // Check if any of the dependency's locations should be ignored
      const shouldIgnore = Array.from(locations).some((location) =>
        fieldsToIgnore.includes(location)
      );

      if (shouldIgnore) {
        continue; // Skip this update
      }

      // Determine the version prefix based on dependency type
      let newVersion: string;
      if (locations.has("peerDependencies")) {
        // For peerDependencies, preserve the >= prefix if it exists
        const currentVersion = dependencies[update.package]?.versionSpec || "";
        if (currentVersion.startsWith(">=")) {
          newVersion = `>=${update.latestVersion}`;
        } else {
          newVersion =
            savePrefix === "none" ? update.latestVersion : `${savePrefix}${update.latestVersion}`;
        }
      } else {
        // For other dependency types, use the standard prefix
        newVersion =
          savePrefix === "none" ? update.latestVersion : `${savePrefix}${update.latestVersion}`;
      }

      applyVersionUpdate(updatedPackageJson, update.package, newVersion, locations);
    }

    await fs.writeFile(packageJsonPath, `${JSON.stringify(updatedPackageJson, null, 2)}\n`, {
      encoding: "utf8",
    });

    return updatesToApply.length;
  } catch (error) {
    logger.warn(
      `Failed to update ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return 0;
  }
}

/**
 * Display update results in a structured, file-by-file format
 */
export function displayStructuredUpdateResults(
  results: UpdateResult[],
  packageJsonFiles: string[],
  fileDepsMap: Map<string, Record<string, DependencyInfo>>,
  showDetails = false
): void {
  const toUpdate = results.filter((r) => r.updated && !r.error);
  const errors = results.filter((r) => r.error);
  const upToDate = results.filter((r) => !(r.updated || r.error) && r.semverCompatible);

  // Show errors first
  if (errors.length > 0) {
    logger.warn(`Failed to check ${errors.length} dependencies:`);
    for (const error of errors) {
      logger.warn(`  ${error.package} (${error.location}): ${error.error}`);
    }
    logger.log(""); // Empty line for spacing
  }

  // If not showing details, don't show the summary (it's shown by the command handler)
  if (!showDetails) {
    return;
  }

  // Group results by package.json file
  const resultsByFile = new Map<string, UpdateResult[]>();
  for (const result of results) {
    // Find which package.json file this dependency belongs to
    let filePath = "unknown";
    for (const [pkgPath, deps] of fileDepsMap.entries()) {
      if (deps[result.package]) {
        filePath = pkgPath;
        break;
      }
    }

    if (!resultsByFile.has(filePath)) {
      resultsByFile.set(filePath, []);
    }
    const fileResults = resultsByFile.get(filePath);
    if (fileResults) {
      fileResults.push(result);
    }
  }

  // Display results organized by file
  for (const [filePath, fileResults] of resultsByFile.entries()) {
    // Show relative path from user's cwd
    const relativePath =
      filePath !== "unknown" ? path.relative(process.cwd(), filePath) : "unknown";
    logger.info(`${relativePath}`);

    // Group by dependency category
    const byCategory = new Map<string, UpdateResult[]>();
    for (const result of fileResults) {
      const category = result.location || "unknown";
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)?.push(result);
    }

    // Show up-to-date dependencies
    const upToDateInFile = fileResults.filter((r) => !(r.updated || r.error) && r.semverCompatible);
    if (upToDateInFile.length > 0) {
      logger.log(`  * ${upToDateInFile.length} deps are already up to date`);
    }

    // Show available updates
    const toUpdateInFile = fileResults.filter((r) => r.updated && !r.error);
    if (toUpdateInFile.length > 0) {
      logger.log(`  * ${toUpdateInFile.length} deps can be updated:`);

      // Sort categories for consistent display
      const sortedCategories = Array.from(byCategory.entries()).sort(([a], [b]) => {
        // Order: catalog, dependencies, devDependencies, peerDependencies, optionalDependencies
        const order = {
          catalog: 0,
          dependencies: 1,
          devDependencies: 2,
          peerDependencies: 3,
          optionalDependencies: 4,
        };
        const aOrder = order[a as keyof typeof order] ?? 999;
        const bOrder = order[b as keyof typeof order] ?? 999;
        return aOrder - bOrder;
      });

      for (const [category, updates] of sortedCategories) {
        const categoryUpdates = updates.filter((r) => r.updated && !r.error);
        if (categoryUpdates.length > 0) {
          // Format category name for display
          let displayCategory = category;
          if (category.startsWith("catalogs.")) {
            displayCategory = `workspaces.${category}`;
          } else if (category === "catalog") {
            displayCategory = "workspaces.catalog";
          }

          logger.log(`    - ${displayCategory}:`);
          for (const update of categoryUpdates) {
            logger.log(
              `      ${update.package}: ${update.currentVersion} → ${update.latestVersion}`
            );
          }
        }
      }
    }

    // Show errors for this file
    const errorsInFile = fileResults.filter((r) => r.error);
    if (errorsInFile.length > 0) {
      logger.warn(`  * ${errorsInFile.length} deps failed to check:`);
      for (const error of errorsInFile) {
        logger.warn(`    ${error.package}: ${error.error}`);
      }
    }

    logger.log(""); // Empty line between files
  }

  // Summary
  if (toUpdate.length === 0) {
    logger.log(`All ${upToDate.length} dependencies are already up to date`);
  } else {
    logger.success(
      `Summary: ${toUpdate.length} dependencies can be updated across ${packageJsonFiles.length} package.json files`
    );
  }
}

/**
 * Run Bun install command
 */
export async function runInstallCommand(verbose: boolean = false): Promise<void> {
  try {
    const cmd = $`bun install`;
    await cmd;
  } catch (error) {
    // Show the actual error from bun install instead of generic message
    logger.warn("Failed to run install command:");
    if (error instanceof Error) {
      logger.warn(error.message);
    } else {
      logger.warn(String(error));
    }
    throw error;
  }
}
