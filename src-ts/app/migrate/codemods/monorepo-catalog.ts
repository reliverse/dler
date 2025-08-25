import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { multiselectPrompt } from "@reliverse/rempts";
import { readPackageJSON } from "pkg-types";
import semver from "semver";
import { glob } from "tinyglobby";

export interface MigrationResult {
  package: string;
  action: "added-to-catalog" | "replaced-with-catalog" | "restored-from-catalog" | "version-bumped";
  oldVersion?: string;
  newVersion?: string;
  location: string;
  packageJsonPath?: string;
}

export interface DependencyEntry {
  name: string;
  version: string;
  locations: Set<string>;
  packageJsonPath: string;
  oldVersion?: string;
}

export interface CatalogMergeResult {
  added: DependencyEntry[];
  bumped: DependencyEntry[];
  skipped: DependencyEntry[];
}

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?:
    | {
        packages?: string[];
        catalog?: Record<string, string>;
        catalogs?: Record<string, Record<string, string>>;
      }
    | string[];
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
  scripts?: Record<string, string>;
}

/**
 * Check if a dependency is a catalog reference (e.g., "catalog:", "catalog:foo")
 */
export function isCatalogReference(versionSpec: string): boolean {
  return versionSpec.startsWith("catalog:");
}

/**
 * Check if a dependency is a workspace dependency (e.g., "workspace:*")
 */
export function isWorkspaceDependency(versionSpec: string): boolean {
  return versionSpec.startsWith("workspace:");
}

/**
 * Check if a dependency is an npm alias (e.g., "npm:package-name@version")
 */
export function isNpmAlias(versionSpec: string): boolean {
  return versionSpec.startsWith("npm:");
}

/**
 * Check if a dependency should be skipped (non-semver or special specifier)
 */
export function shouldSkipDependency(versionSpec: string): boolean {
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
 * Find all workspace package.json paths from root cwd. Supports workspaces array or { packages: [] }.
 */
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
 * Extract dependencies from package.json (dependencies and devDependencies)
 */
export function extractDependencies(
  packageJson: PackageJson,
  packageJsonPath: string,
): DependencyEntry[] {
  const dependencies: DependencyEntry[] = [];

  // Extract from dependencies
  const deps = packageJson.dependencies || {};
  for (const [name, version] of Object.entries(deps)) {
    if (typeof version === "string" && !shouldSkipDependency(version)) {
      dependencies.push({
        name,
        version,
        locations: new Set(["dependencies"]),
        packageJsonPath,
      });
    }
  }

  // Extract from devDependencies
  const devDeps = packageJson.devDependencies || {};
  for (const [name, version] of Object.entries(devDeps)) {
    if (typeof version === "string" && !shouldSkipDependency(version)) {
      const existing = dependencies.find((d) => d.name === name);
      if (existing) {
        existing.locations.add("devDependencies");
        // Use the version from dependencies if they differ (prioritize production deps)
        if (existing.locations.has("dependencies")) {
          existing.version = deps[name] || existing.version;
        }
      } else {
        dependencies.push({
          name,
          version,
          locations: new Set(["devDependencies"]),
          packageJsonPath,
        });
      }
    }
  }

  return dependencies;
}

/**
 * Merge dependencies into catalog, handling version conflicts intelligently
 */
export function mergeToCatalog(
  existingCatalog: Record<string, string>,
  newDependencies: DependencyEntry[],
): CatalogMergeResult {
  const result: CatalogMergeResult = {
    added: [],
    bumped: [],
    skipped: [],
  };

  for (const dep of newDependencies) {
    const existingVersion = existingCatalog[dep.name];

    if (!existingVersion) {
      // New dependency - add to catalog
      existingCatalog[dep.name] = dep.version;
      result.added.push(dep);
    } else {
      try {
        // Compare versions
        const cleanExisting = existingVersion.replace(/^[\^~]/, "");
        const cleanNew = dep.version.replace(/^[\^~]/, "");

        if (semver.valid(cleanExisting) && semver.valid(cleanNew)) {
          if (semver.gt(cleanNew, cleanExisting)) {
            // New version is newer - bump catalog version
            existingCatalog[dep.name] = dep.version;
            result.bumped.push({ ...dep, oldVersion: existingVersion });
          } else {
            // Existing version is same or newer - skip
            result.skipped.push(dep);
          }
        } else {
          // Can't compare versions - skip to be safe
          result.skipped.push(dep);
        }
      } catch {
        // Error comparing versions - skip to be safe
        result.skipped.push(dep);
      }
    }
  }

  return result;
}

/**
 * Replace dependencies with catalog references in package.json
 */
export async function replaceDependenciesWithCatalogRefs(
  packageJsonPath: string,
  dependenciesToReplace: DependencyEntry[],
): Promise<number> {
  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent) as PackageJson;
    let replacedCount = 0;

    for (const dep of dependenciesToReplace) {
      for (const location of dep.locations) {
        if (location === "dependencies" && packageJson.dependencies?.[dep.name]) {
          packageJson.dependencies[dep.name] = "catalog:";
          replacedCount++;
        } else if (location === "devDependencies" && packageJson.devDependencies?.[dep.name]) {
          packageJson.devDependencies[dep.name] = "catalog:";
          replacedCount++;
        }
      }
    }

    if (replacedCount > 0) {
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n", "utf8");
    }

    return replacedCount;
  } catch (error) {
    relinka(
      "warn",
      `Failed to update ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 0;
  }
}

/**
 * Restore catalog references to actual versions
 */
export async function restoreCatalogReferences(
  packageJsonPath: string,
  catalog: Record<string, string>,
): Promise<number> {
  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent) as PackageJson;
    let restoredCount = 0;

    // Restore dependencies
    const deps = packageJson.dependencies || {};
    for (const [name, version] of Object.entries(deps)) {
      if (typeof version === "string" && isCatalogReference(version)) {
        const catalogVersion = catalog[name];
        if (catalogVersion && packageJson.dependencies) {
          packageJson.dependencies[name] = catalogVersion;
          restoredCount++;
        } else {
          relinka("warn", `No catalog entry found for dependency: ${name} in ${packageJsonPath}`);
        }
      }
    }

    // Restore devDependencies
    const devDeps = packageJson.devDependencies || {};
    for (const [name, version] of Object.entries(devDeps)) {
      if (typeof version === "string" && isCatalogReference(version)) {
        const catalogVersion = catalog[name];
        if (catalogVersion && packageJson.devDependencies) {
          packageJson.devDependencies[name] = catalogVersion;
          restoredCount++;
        } else {
          relinka(
            "warn",
            `No catalog entry found for devDependency: ${name} in ${packageJsonPath}`,
          );
        }
      }
    }

    if (restoredCount > 0) {
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n", "utf8");
    }

    return restoredCount;
  } catch (error) {
    relinka(
      "warn",
      `Failed to restore ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 0;
  }
}

/**
 * Update root package.json with catalog
 */
export async function updateRootWithCatalog(
  rootPackageJsonPath: string,
  catalog: Record<string, string>,
): Promise<void> {
  try {
    const packageJsonContent = await fs.readFile(rootPackageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent) as PackageJson;

    // Ensure workspaces structure exists
    if (!packageJson.workspaces) {
      packageJson.workspaces = {};
    }

    // If workspaces is an array, convert to object
    if (Array.isArray(packageJson.workspaces)) {
      packageJson.workspaces = { packages: packageJson.workspaces };
    }

    // Update workspaces.catalog
    packageJson.workspaces.catalog = catalog;

    await fs.writeFile(rootPackageJsonPath, JSON.stringify(packageJson, null, 2) + "\n", "utf8");
  } catch (error) {
    throw new Error(
      `Failed to update root package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Remove catalog from root package.json
 */
export async function removeCatalogFromRoot(rootPackageJsonPath: string): Promise<void> {
  try {
    const packageJsonContent = await fs.readFile(rootPackageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent) as PackageJson;

    // Remove workspaces.catalog
    if (
      packageJson.workspaces &&
      !Array.isArray(packageJson.workspaces) &&
      packageJson.workspaces.catalog
    ) {
      packageJson.workspaces.catalog = undefined;

      // If workspaces is empty except for packages, clean it up
      if (
        Object.keys(packageJson.workspaces).length === 0 ||
        (Object.keys(packageJson.workspaces).length === 1 && packageJson.workspaces.packages)
      ) {
        if (!packageJson.workspaces.packages) {
          packageJson.workspaces = undefined;
        }
      }
    }

    // Remove legacy catalog fields if they exist
    if (packageJson.catalog) {
      packageJson.catalog = undefined;
    }

    await fs.writeFile(rootPackageJsonPath, JSON.stringify(packageJson, null, 2) + "\n", "utf8");
  } catch (error) {
    throw new Error(
      `Failed to remove catalog from root package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Migrate TO catalog: centralize dependencies to workspaces.catalog
 */
export async function migrateToCatalog(
  rootPath: string,
  dryRun = false,
  interactive = false,
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  // Find all workspace packages
  const workspacePaths = await findWorkspacePackageJsons(rootPath);

  if (workspacePaths.length === 0) {
    throw new Error("No workspace packages found. This command requires a monorepo setup.");
  }

  relinka("log", `Found ${workspacePaths.length} workspace packages`);

  // Collect all dependencies from workspace packages
  const allDependencies: DependencyEntry[] = [];

  for (const workspacePath of workspacePaths) {
    try {
      const packageJsonContent = await fs.readFile(workspacePath, "utf8");
      const packageJson = JSON.parse(packageJsonContent) as PackageJson;
      const deps = extractDependencies(packageJson, workspacePath);
      allDependencies.push(...deps);
    } catch (error) {
      relinka(
        "warn",
        `Failed to read ${workspacePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (allDependencies.length === 0) {
    relinka("log", "No dependencies found to migrate to catalog");
    return results;
  }

  relinka("log", `Found ${allDependencies.length} total dependency entries across workspaces`);

  // Read existing catalog from root
  const rootPackageJsonPath = path.resolve(rootPath, "package.json");
  let existingCatalog: Record<string, string> = {};

  try {
    const rootPackageJson = await readPackageJSON(rootPath);
    existingCatalog = (rootPackageJson as any).workspaces?.catalog || {};
  } catch (error) {
    relinka(
      "warn",
      `Failed to read root package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Merge dependencies into catalog
  const mergeResult = mergeToCatalog(existingCatalog, allDependencies);

  relinka("log", `Catalog merge summary:`);
  relinka("log", `  - ${mergeResult.added.length} new dependencies added`);
  relinka("log", `  - ${mergeResult.bumped.length} dependencies bumped to newer versions`);
  relinka(
    "log",
    `  - ${mergeResult.skipped.length} dependencies skipped (already up-to-date or incompatible)`,
  );

  // Interactive selection if requested
  let dependenciesToMigrate = allDependencies;

  if (interactive && allDependencies.length > 0) {
    const selectedPackages = await multiselectPrompt({
      title: "Select dependencies to migrate to catalog",
      options: [
        { label: "Migrate all dependencies", value: "all" },
        { label: "Cancel migration", value: "cancel" },
        ...Array.from(new Set(allDependencies.map((d) => d.name))).map((name) => ({
          label: name,
          value: name,
        })),
      ],
    });

    if (selectedPackages.includes("cancel")) {
      relinka("log", "Migration cancelled");
      return results;
    }

    if (!selectedPackages.includes("all")) {
      dependenciesToMigrate = allDependencies.filter((dep) => selectedPackages.includes(dep.name));
    }
  }

  if (dryRun) {
    relinka("log", "Dry run mode - no changes were made");
    relinka("log", "Would migrate the following dependencies to catalog:");

    const uniqueDeps = Array.from(new Set(dependenciesToMigrate.map((d) => d.name)));
    for (const depName of uniqueDeps) {
      const catalogVersion = existingCatalog[depName];
      relinka("log", `  ${depName}: ${catalogVersion || "new entry"}`);
    }

    return results;
  }

  // Update root package.json with merged catalog
  await updateRootWithCatalog(rootPackageJsonPath, existingCatalog);

  // Replace dependencies with catalog references in workspace packages
  const workspaceResults = new Map<string, DependencyEntry[]>();

  // Group dependencies by package path
  for (const dep of dependenciesToMigrate) {
    if (!workspaceResults.has(dep.packageJsonPath)) {
      workspaceResults.set(dep.packageJsonPath, []);
    }
    workspaceResults.get(dep.packageJsonPath)!.push(dep);
  }

  // Process each workspace package
  for (const [packagePath, deps] of workspaceResults.entries()) {
    const replacedCount = await replaceDependenciesWithCatalogRefs(packagePath, deps);

    if (replacedCount > 0) {
      relinka("log", `Updated ${replacedCount} dependencies in ${packagePath}`);

      for (const dep of deps) {
        results.push({
          package: dep.name,
          action: "replaced-with-catalog",
          oldVersion: dep.version,
          newVersion: "catalog:",
          location: Array.from(dep.locations).join(", "),
          packageJsonPath: packagePath,
        });
      }
    }
  }

  // Add results for catalog updates
  for (const dep of mergeResult.added) {
    results.push({
      package: dep.name,
      action: "added-to-catalog",
      newVersion: dep.version,
      location: "catalog",
    });
  }

  for (const dep of mergeResult.bumped) {
    results.push({
      package: dep.name,
      action: "version-bumped",
      oldVersion: dep.oldVersion,
      newVersion: dep.version,
      location: "catalog",
    });
  }

  return results;
}

/**
 * Migrate FROM catalog: restore catalog references to actual versions
 */
export async function migrateFromCatalog(
  rootPath: string,
  removeCatalog = false,
  dryRun = false,
  interactive = false,
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  // Read catalog from root
  const rootPackageJson = await readPackageJSON(rootPath);
  const catalog = (rootPackageJson as any).workspaces?.catalog || {};

  if (Object.keys(catalog).length === 0) {
    relinka("warn", "No workspaces.catalog found in root package.json");
    return results;
  }

  relinka("log", `Found catalog with ${Object.keys(catalog).length} entries`);

  // Find all workspace packages
  const workspacePaths = await findWorkspacePackageJsons(rootPath);

  if (workspacePaths.length === 0) {
    relinka("warn", "No workspace packages found");
    return results;
  }

  // Find packages that have catalog references
  const packagesWithCatalogRefs: { path: string; catalogRefs: string[] }[] = [];

  for (const workspacePath of workspacePaths) {
    try {
      const packageJsonContent = await fs.readFile(workspacePath, "utf8");
      const packageJson = JSON.parse(packageJsonContent) as PackageJson;
      const catalogRefs: string[] = [];

      // Check dependencies
      const deps = packageJson.dependencies || {};
      for (const [name, version] of Object.entries(deps)) {
        if (typeof version === "string" && isCatalogReference(version)) {
          catalogRefs.push(name);
        }
      }

      // Check devDependencies
      const devDeps = packageJson.devDependencies || {};
      for (const [name, version] of Object.entries(devDeps)) {
        if (typeof version === "string" && isCatalogReference(version)) {
          catalogRefs.push(name);
        }
      }

      if (catalogRefs.length > 0) {
        packagesWithCatalogRefs.push({
          path: workspacePath,
          catalogRefs: [...new Set(catalogRefs)], // Remove duplicates
        });
      }
    } catch (error) {
      relinka(
        "warn",
        `Failed to read ${workspacePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (packagesWithCatalogRefs.length === 0) {
    relinka("log", "No catalog references found in workspace packages");

    if (removeCatalog && !dryRun) {
      const rootPackageJsonPath = path.resolve(rootPath, "package.json");
      await removeCatalogFromRoot(rootPackageJsonPath);
      relinka("log", "Removed catalog from root package.json");
    }

    return results;
  }

  const totalCatalogRefs = packagesWithCatalogRefs.reduce(
    (sum, pkg) => sum + pkg.catalogRefs.length,
    0,
  );
  relinka(
    "log",
    `Found ${totalCatalogRefs} catalog references across ${packagesWithCatalogRefs.length} packages`,
  );

  // Interactive selection if requested
  let packagesToProcess = packagesWithCatalogRefs;

  if (interactive && packagesWithCatalogRefs.length > 0) {
    const allCatalogRefs = Array.from(
      new Set(packagesWithCatalogRefs.flatMap((p) => p.catalogRefs)),
    );

    const selectedPackages = await multiselectPrompt({
      title: "Select dependencies to restore from catalog",
      options: [
        { label: "Restore all catalog references", value: "all" },
        { label: "Cancel restoration", value: "cancel" },
        ...allCatalogRefs.map((name) => ({
          label: `${name} (${catalog[name] || "missing in catalog"})`,
          value: name,
          disabled: !catalog[name],
        })),
      ],
    });

    if (selectedPackages.includes("cancel")) {
      relinka("log", "Restoration cancelled");
      return results;
    }

    if (!selectedPackages.includes("all")) {
      // Filter packages to only include selected dependencies
      packagesToProcess = packagesWithCatalogRefs
        .map((pkg) => ({
          ...pkg,
          catalogRefs: pkg.catalogRefs.filter((ref) => selectedPackages.includes(ref)),
        }))
        .filter((pkg) => pkg.catalogRefs.length > 0);
    }
  }

  if (dryRun) {
    relinka("log", "Dry run mode - no changes were made");
    relinka("log", "Would restore the following catalog references:");

    for (const pkg of packagesToProcess) {
      relinka("log", `  ${pkg.path}:`);
      for (const ref of pkg.catalogRefs) {
        const catalogVersion = catalog[ref];
        relinka("log", `    ${ref}: catalog: → ${catalogVersion || "MISSING"}`);
      }
    }

    if (removeCatalog) {
      relinka("log", "Would also remove workspaces.catalog from root package.json");
    }

    return results;
  }

  // Restore catalog references in workspace packages
  for (const pkg of packagesToProcess) {
    const restoredCount = await restoreCatalogReferences(pkg.path, catalog);

    if (restoredCount > 0) {
      relinka("log", `Restored ${restoredCount} catalog references in ${pkg.path}`);

      for (const ref of pkg.catalogRefs) {
        if (catalog[ref]) {
          results.push({
            package: ref,
            action: "restored-from-catalog",
            oldVersion: "catalog:",
            newVersion: catalog[ref],
            location: "dependencies/devDependencies",
            packageJsonPath: pkg.path,
          });
        }
      }
    }
  }

  // Remove catalog if requested
  if (removeCatalog) {
    const rootPackageJsonPath = path.resolve(rootPath, "package.json");
    await removeCatalogFromRoot(rootPackageJsonPath);
    relinka("log", "Removed workspaces.catalog from root package.json");
  }

  return results;
}

/**
 * Display migration results
 */
export function displayMigrationResults(results: MigrationResult[]): void {
  if (results.length === 0) {
    relinka("log", "No changes were made");
    return;
  }

  const byAction = results.reduce(
    (acc, result) => {
      if (!acc[result.action]) acc[result.action] = [];
      acc[result.action]!.push(result);
      return acc;
    },
    {} as Record<string, MigrationResult[]>,
  );

  for (const [action, actionResults] of Object.entries(byAction)) {
    relinka("log", `\n${action.replace(/-/g, " ")} (${actionResults.length}):`);

    for (const result of actionResults) {
      let message = `  ${result.package}`;

      if (result.oldVersion && result.newVersion) {
        message += `: ${result.oldVersion} → ${result.newVersion}`;
      } else if (result.newVersion) {
        message += `: ${result.newVersion}`;
      }

      if (result.packageJsonPath) {
        message += ` (${result.packageJsonPath})`;
      }

      relinka("log", message);
    }
  }

  relinka("success", `Migration completed: ${results.length} changes made`);
  relinka("log", "Run your package manager install command to apply the changes");
}
