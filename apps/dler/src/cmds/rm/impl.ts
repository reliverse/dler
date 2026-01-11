// apps/dler/src/cmds/rm/impl.ts

import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createIncludeFilter } from "@reliverse/matcha";
import path from "@reliverse/pathkit";
import { logger } from "@reliverse/relinka";
import { hasWorkspaces, readPackageJSON, writePackageJSON } from "@reliverse/typerso";
import { runInstallCommand } from "../update/utils";

export interface RemoveOptions {
  target?: string;
  w?: boolean;
  catalog: boolean | string;
  scope?: "dev" | "prod" | "peer" | "optional";
  install: boolean;
  cwd?: string;
  dryRun: boolean;
  verbose: boolean;
}

export interface MonorepoInfo {
  isMonorepo: boolean;
  rootPath: string;
  rootPackageJson: any;
  workspacePackages?: string[];
}

interface CatalogInfo {
  catalogName: string | null;
  catalogPath: string | null;
}

interface TargetPackageInfo {
  packagePath: string;
  packageJson: any;
}

interface MultipleTargetsInfo {
  targets: TargetPackageInfo[];
  isMultiple: true;
}

interface PackageInfo {
  name: string;
  path: string;
  json: any;
}

// Cache for package info
const packageInfoCache = new Map<string, PackageInfo[]>();

async function getWorkspacePackageInfos(monorepoInfo: MonorepoInfo): Promise<PackageInfo[]> {
  // Check cache first
  if (packageInfoCache.has(monorepoInfo.rootPath)) {
    return packageInfoCache.get(monorepoInfo.rootPath)!;
  }

  if (!monorepoInfo.workspacePackages) {
    const empty: PackageInfo[] = [];
    packageInfoCache.set(monorepoInfo.rootPath, empty);
    return empty;
  }

  // Batch read all package.json files
  const packageInfos: PackageInfo[] = [];
  const readPromises = monorepoInfo.workspacePackages.map(async (pkgPath) => {
    const packageJson = await readPackageJSON(pkgPath);
    if (packageJson?.name) {
      return {
        name: packageJson.name,
        path: pkgPath,
        json: packageJson,
      };
    }
    return null;
  });

  const results = await Promise.all(readPromises);
  for (const result of results) {
    if (result) {
      packageInfos.push(result);
    }
  }

  // Cache the result
  packageInfoCache.set(monorepoInfo.rootPath, packageInfos);
  return packageInfos;
}

// ============================================================================
// Monorepo Detection with Caching
// ============================================================================

// ============================================================================
// Monorepo Detection with Caching
// ============================================================================

// Cache for monorepo detection results
const monorepoCache = new Map<string, MonorepoInfo>();

// ============================================================================
// Monorepo Detection with Caching
// ============================================================================

async function detectMonorepo(startDir?: string): Promise<MonorepoInfo> {
  const cwd = resolve(startDir ?? process.cwd());

  // Check cache first
  if (monorepoCache.has(cwd)) {
    return monorepoCache.get(cwd)!;
  }

  let currentDir = cwd;

  // Walk up the directory tree looking for workspaces
  while (true) {
    const packageJsonPath = path.join(currentDir, "package.json");

    if (existsSync(packageJsonPath)) {
      const packageJson = await readPackageJSON(currentDir);

      if (packageJson && hasWorkspaces(packageJson)) {
        // Found monorepo root
        const workspacePackages = await discoverWorkspacePackages(currentDir, packageJson);
        const result = {
          isMonorepo: true,
          rootPath: currentDir,
          rootPackageJson: packageJson,
          workspacePackages,
        };
        // Cache the result
        monorepoCache.set(cwd, result);
        return result;
      }
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }

  // No monorepo found, treat as single package
  const packageJsonPath = path.join(cwd, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error("No package.json found in current directory or any parent directory");
  }

  const packageJson = await readPackageJSON(cwd);
  if (!packageJson) {
    throw new Error("Could not read package.json");
  }

  const result = {
    isMonorepo: false,
    rootPath: cwd,
    rootPackageJson: packageJson,
  };

  // Cache the result
  monorepoCache.set(cwd, result);
  return result;
}

// Cache for workspace packages
const workspaceCache = new Map<string, string[]>();

async function discoverWorkspacePackages(
  monorepoRoot: string,
  rootPackageJson: any
): Promise<string[]> {
  // Check cache first
  if (workspaceCache.has(monorepoRoot)) {
    return workspaceCache.get(monorepoRoot)!;
  }

  const packages: string[] = [];

  if (!rootPackageJson.workspaces?.packages) {
    workspaceCache.set(monorepoRoot, packages);
    return packages;
  }

  const patterns = Array.isArray(rootPackageJson.workspaces.packages)
    ? rootPackageJson.workspaces.packages
    : [];

  // Batch read all package.json files to reduce I/O operations
  const packagePaths: string[] = [];
  const validationPromises: Promise<boolean>[] = [];

  for (const pattern of patterns) {
    if (pattern.includes("*")) {
      // Handle glob patterns
      const glob = new Bun.Glob(pattern);
      const matches = glob.scanSync({ cwd: monorepoRoot, onlyFiles: false });

      for (const match of matches) {
        const packagePath = resolve(monorepoRoot, match);
        packagePaths.push(packagePath);
        validationPromises.push(isValidWorkspacePackage(packagePath));
      }
    } else {
      // Handle direct paths
      const packagePath = resolve(monorepoRoot, pattern);
      packagePaths.push(packagePath);
      validationPromises.push(isValidWorkspacePackage(packagePath));
    }
  }

  // Wait for all validations to complete
  const validationResults = await Promise.all(validationPromises);

  // Collect valid packages
  for (let i = 0; i < packagePaths.length; i++) {
    if (validationResults[i]) {
      packages.push(packagePaths[i]!);
    }
  }

  // Cache the result
  workspaceCache.set(monorepoRoot, packages);
  return packages;
}

async function isValidWorkspacePackage(packagePath: string): Promise<boolean> {
  const packageJsonPath = path.join(packagePath, "package.json");
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  const packageJson = await readPackageJSON(packagePath);
  return !!packageJson?.name;
}

// ============================================================================
// Catalog Resolution
// ============================================================================

function resolveCatalog(monorepoInfo: MonorepoInfo, catalogOption: boolean | string): CatalogInfo {
  if (!monorepoInfo.isMonorepo) {
    return { catalogName: null, catalogPath: null };
  }

  const workspaces = monorepoInfo.rootPackageJson.workspaces;

  if (catalogOption === false) {
    // Explicitly disabled catalog mode
    return { catalogName: null, catalogPath: null };
  }

  let catalogName: string;

  if (typeof catalogOption === "string") {
    // Specific catalog requested
    catalogName = catalogOption;
  } else {
    // Default to main catalog
    catalogName = "catalog"; // Default catalog name in Bun workspaces
  }

  // Check if the catalog exists
  const catalogExists = workspaces[catalogName];

  if (!catalogExists) {
    if (typeof catalogOption === "string") {
      throw new Error(`Catalog '${catalogName}' not found in workspaces configuration`);
    }
    // Default catalog doesn't exist, disable catalog mode
    return { catalogName: null, catalogPath: null };
  }

  return {
    catalogName,
    catalogPath: catalogName,
  };
}

// ============================================================================
// Target Package Resolution
// ============================================================================

function containsGlobPattern(str: string): boolean {
  return str.includes("*") || str.includes("?") || str.includes("[") || str.includes("{");
}

function containsMultipleTargets(str: string): boolean {
  return str.includes(" ") && str.trim().split(/\s+/).length > 1;
}

async function resolveTargetPackage(
  monorepoInfo: MonorepoInfo,
  options: RemoveOptions
): Promise<TargetPackageInfo | MultipleTargetsInfo> {
  const { target, w } = options;

  // --w flag takes precedence: remove from root package.json
  if (w) {
    return {
      packagePath: monorepoInfo.rootPath,
      packageJson: monorepoInfo.rootPackageJson,
    };
  }

  // --target flag specifies a workspace package
  if (target) {
    if (!monorepoInfo.isMonorepo) {
      throw new Error("--target can only be used in monorepo environments");
    }

    if (target === ".") {
      // Special case: --target . means current directory
      const cwd = resolve(options.cwd ?? process.cwd());

      // If cwd contains the root package.json, act like --w
      if (path.relative(monorepoInfo.rootPath, cwd) === "") {
        return {
          packagePath: monorepoInfo.rootPath,
          packageJson: monorepoInfo.rootPackageJson,
        };
      }

      // Check if cwd contains a workspace package
      const workspacePackage = monorepoInfo.workspacePackages?.find(
        (pkgPath) =>
          path.relative(pkgPath, cwd) === "" ||
          cwd === pkgPath ||
          cwd.startsWith(pkgPath + path.sep)
      );

      if (workspacePackage) {
        // Try to get from cache first
        const packageInfos = await getWorkspacePackageInfos(monorepoInfo);
        const cachedInfo = packageInfos.find((info) => info.path === workspacePackage);
        if (cachedInfo) {
          return {
            packagePath: workspacePackage,
            packageJson: cachedInfo.json,
          };
        }

        // Fallback to reading directly
        const packageJson = await readPackageJSON(workspacePackage);
        if (!packageJson) {
          throw new Error(`Could not read package.json from ${workspacePackage}`);
        }
        return {
          packagePath: workspacePackage,
          packageJson,
        };
      }

      throw new Error(`Current directory is not a workspace package and not the monorepo root`);
    }

    // Check if target contains multiple package names (space-separated)
    if (containsMultipleTargets(target)) {
      const targetNames = target.trim().split(/\s+/);
      const packageInfos = await getWorkspacePackageInfos(monorepoInfo);
      const targets: TargetPackageInfo[] = [];

      for (const targetName of targetNames) {
        // Special case: "*" means all packages
        if (targetName === "*") {
          targets.push(
            ...packageInfos.map((pkg: PackageInfo) => ({
              packagePath: pkg.path,
              packageJson: pkg.json,
            }))
          );
        } else if (containsGlobPattern(targetName)) {
          const includeFilter = createIncludeFilter(targetName);
          const matchingPackages = includeFilter(packageInfos);
          if (matchingPackages.length === 0) {
            throw new Error(`No workspace packages match pattern '${targetName}'`);
          }
          targets.push(
            ...matchingPackages.map((pkg: PackageInfo) => ({
              packagePath: pkg.path,
              packageJson: pkg.json,
            }))
          );
        } else {
          // Exact match for single package
          const matchingPackage = packageInfos.find((info) => info.name === targetName);
          if (!matchingPackage) {
            throw new Error(`Workspace package '${targetName}' not found`);
          }
          targets.push({
            packagePath: matchingPackage.path,
            packageJson: matchingPackage.json,
          });
        }
      }

      // Remove duplicates (in case glob patterns overlap)
      const uniqueTargets = targets.filter(
        (target, index, self) =>
          index === self.findIndex((t) => t.packagePath === target.packagePath)
      );

      return {
        targets: uniqueTargets,
        isMultiple: true,
      };
    }

    // Special case: --target "*" means all packages
    if (target === "*") {
      const packageInfos = await getWorkspacePackageInfos(monorepoInfo);
      const targets: TargetPackageInfo[] = packageInfos.map((pkg: PackageInfo) => ({
        packagePath: pkg.path,
        packageJson: pkg.json,
      }));

      return {
        targets,
        isMultiple: true,
      };
    }

    // Exact match for single package
    const packageInfos = await getWorkspacePackageInfos(monorepoInfo);
    const matchingPackage = packageInfos.find((info) => info.name === target);

    if (!matchingPackage) {
      throw new Error(`Workspace package '${target}' not found`);
    }

    return {
      packagePath: matchingPackage.path,
      packageJson: matchingPackage.json,
    };
  }

  // Default behavior: if in monorepo, remove from root; if single package, remove from current
  if (monorepoInfo.isMonorepo) {
    return {
      packagePath: monorepoInfo.rootPath,
      packageJson: monorepoInfo.rootPackageJson,
    };
  } else {
    return {
      packagePath: monorepoInfo.rootPath,
      packageJson: monorepoInfo.rootPackageJson,
    };
  }
}

// ============================================================================
// Dependency Removal Logic
// ============================================================================

async function removeDependencyFromPackage(
  packagePath: string,
  packageJson: any,
  packageName: string,
  scope: "dev" | "prod" | "peer" | "optional" | undefined,
  dryRun: boolean,
  verbose: boolean
): Promise<boolean> {
  const packageJsonPath = path.join(packagePath, "package.json");
  const relativePath = relative(process.cwd(), packageJsonPath) || "package.json";
  const allScopes: Array<"dev" | "prod" | "peer" | "optional"> = [
    "prod",
    "dev",
    "peer",
    "optional",
  ];

  let changesMade = false;

  // If scope is specified, only check that scope
  if (scope) {
    const fieldName = getDependencyFieldName(scope);

    // Check if dependency exists in the specified scope
    if (!packageJson[fieldName]?.[packageName]) {
      // If not found in specified scope, check other scopes and suggest correct one
      const foundInScopes: string[] = [];

      for (const checkScope of allScopes) {
        const checkFieldName = getDependencyFieldName(checkScope);
        if (packageJson[checkFieldName]?.[packageName]) {
          foundInScopes.push(checkScope);
        }
      }

      if (foundInScopes.length > 0) {
        logger.warn(
          `⚠️  ${packageName} not found in ${fieldName} of ${relativePath}, but found in: ${foundInScopes.join(", ")}`
        );
        logger.warn(`💡 Try using --${foundInScopes[0]} flag`);
      } else {
        if (verbose) {
          logger.info(`ℹ️  ${packageName} not found in ${fieldName} of ${relativePath}`);
        }
      }
      return false;
    }

    // Remove the dependency
    delete packageJson[fieldName][packageName];

    // Clean up empty dependency field
    if (Object.keys(packageJson[fieldName]).length === 0) {
      delete packageJson[fieldName];
    }

    if (dryRun) {
      if (verbose) {
        logger.log(`📝 Would remove ${packageName} from ${fieldName} in ${relativePath}`);
      }
    } else {
      await writePackageJSON(packageJsonPath, packageJson);
    }

    return true;
  }

  // If no scope specified, remove from all scopes where the package exists
  for (const checkScope of allScopes) {
    const fieldName = getDependencyFieldName(checkScope);

    if (packageJson[fieldName]?.[packageName]) {
      // Remove the dependency
      delete packageJson[fieldName][packageName];

      // Clean up empty dependency field
      if (Object.keys(packageJson[fieldName]).length === 0) {
        delete packageJson[fieldName];
      }

      changesMade = true;

      if (dryRun) {
        if (verbose) {
          logger.log(`📝 Would remove ${packageName} from ${fieldName} in ${relativePath}`);
        }
      }
    }
  }

  // Save changes if not in dry-run mode
  if (changesMade && !dryRun) {
    await writePackageJSON(packageJsonPath, packageJson);
  }

  // If no changes made and verbose, show info
  if (!changesMade && verbose) {
    logger.info(`ℹ️  ${packageName} not found in any dependency section of ${relativePath}`);
  }

  return changesMade;
}

async function removeDependencyFromCatalog(
  monorepoInfo: MonorepoInfo,
  catalogInfo: CatalogInfo,
  packageName: string,
  dryRun: boolean,
  verbose: boolean
): Promise<boolean> {
  const workspaces = monorepoInfo.rootPackageJson.workspaces;
  const catalogExists = workspaces[catalogInfo.catalogName!];

  if (!catalogExists) {
    throw new Error(`Catalog '${catalogInfo.catalogName}' not found`);
  }

  // Check if dependency exists in catalog
  if (!catalogExists[packageName]) {
    if (verbose) {
      logger.info(`ℹ️  ${packageName} not found in catalog '${catalogInfo.catalogName}'`);
    }
    return false;
  }

  if (dryRun) {
    if (verbose) {
      logger.log(`📝 Would remove ${packageName} from catalog '${catalogInfo.catalogName}'`);
    }
  } else {
    // Remove from catalog
    delete catalogExists[packageName];
    await writePackageJSON(
      path.join(monorepoInfo.rootPath, "package.json"),
      monorepoInfo.rootPackageJson
    );
    // Individual logging removed - will be shown in summary
  }

  return true;
}

function getDependencyFieldName(scope: "dev" | "prod" | "peer" | "optional"): string {
  switch (scope) {
    case "dev":
      return "devDependencies";
    case "prod":
      return "dependencies";
    case "peer":
      return "peerDependencies";
    case "optional":
      return "optionalDependencies";
  }
}

// ============================================================================
// Main Function
// ============================================================================

export async function removeDependency(
  packageNames: string | string[],
  options: RemoveOptions
): Promise<boolean> {
  const packageNameArray = Array.isArray(packageNames) ? packageNames : [packageNames];
  let totalChangesMade = false;
  const removedPackages: string[] = [];

  // Detect monorepo once
  const monorepoInfo = await detectMonorepo(options.cwd);

  logger.log(
    `📦 Detected ${monorepoInfo.isMonorepo ? "monorepo" : "single package"} at ${monorepoInfo.rootPath}`
  );

  // Resolve catalog mode once
  const catalogInfo = resolveCatalog(monorepoInfo, options.catalog);

  if (catalogInfo.catalogName) {
    logger.log(`📚 Using catalog '${catalogInfo.catalogName}'`);
  }

  // Resolve target package(s) once
  const targetResult = await resolveTargetPackage(monorepoInfo, options);

  if ("isMultiple" in targetResult && targetResult.isMultiple) {
    // Multiple targets
    if (options.verbose) {
      logger.log(`🎯 Target packages (${targetResult.targets.length}):`);
      for (const target of targetResult.targets) {
        const relativePath = relative(process.cwd(), target.packagePath) || "package.json";
        logger.log(`   • ${relativePath}`);
      }
    }

    // Process each package
    for (const packageName of packageNameArray) {
      let changesMade = false;

      // Remove dependency from all targets
      if (catalogInfo.catalogName && monorepoInfo.isMonorepo) {
        // Catalog mode: remove from catalog first, then remove catalog references from each target package
        const catalogChanged = await removeDependencyFromCatalog(
          monorepoInfo,
          catalogInfo,
          packageName,
          options.dryRun,
          options.verbose
        );
        changesMade = changesMade || catalogChanged;

        for (const target of targetResult.targets) {
          const packageChanged = await removeDependencyFromPackage(
            target.packagePath,
            target.packageJson,
            packageName,
            options.scope,
            options.dryRun,
            options.verbose
          );
          changesMade = changesMade || packageChanged;
        }
      } else {
        // Direct mode: remove directly from each target package
        for (const target of targetResult.targets) {
          const packageChanged = await removeDependencyFromPackage(
            target.packagePath,
            target.packageJson,
            packageName,
            options.scope,
            options.dryRun,
            options.verbose
          );
          changesMade = changesMade || packageChanged;
        }
      }

      if (changesMade) {
        removedPackages.push(packageName);
      }
      totalChangesMade = totalChangesMade || changesMade;
    }
  } else {
    // Single target
    const targetInfo = targetResult as TargetPackageInfo;

    const relativePath = relative(process.cwd(), targetInfo.packagePath) || "package.json";
    logger.log(`🎯 Target package: ${relativePath}`);

    // Process each package
    for (const packageName of packageNameArray) {
      let changesMade = false;

      // Remove dependency
      if (catalogInfo.catalogName && monorepoInfo.isMonorepo) {
        // Catalog mode: remove from catalog first, then remove catalog reference from target package
        const catalogChanged = await removeDependencyFromCatalog(
          monorepoInfo,
          catalogInfo,
          packageName,
          options.dryRun,
          options.verbose
        );
        changesMade = changesMade || catalogChanged;

        // Remove catalog reference from target package
        const packageChanged = await removeDependencyFromPackage(
          targetInfo.packagePath,
          targetInfo.packageJson,
          packageName,
          options.scope,
          options.dryRun,
          options.verbose
        );
        changesMade = changesMade || packageChanged;
      } else {
        // Direct mode: remove directly from target package
        const packageChanged = await removeDependencyFromPackage(
          targetInfo.packagePath,
          targetInfo.packageJson,
          packageName,
          options.scope,
          options.dryRun,
          options.verbose
        );
        changesMade = changesMade || packageChanged;
      }

      if (changesMade) {
        removedPackages.push(packageName);
      }
      totalChangesMade = totalChangesMade || changesMade;
    }
  }

  // Show summary of all removed packages
  if (removedPackages.length > 0) {
    if (options.dryRun) {
      logger.log(`📝 Would remove dependencies: ${removedPackages.join(", ")}`);
    } else {
      logger.success(`✅ Removed dependencies: ${removedPackages.join(", ")}`);
    }
  } else {
    logger.log("ℹ️  No dependencies to remove");
  }

  // Handle installation once for all packages
  if (totalChangesMade && options.install && !options.dryRun) {
    try {
      logger.log("Applying changes (bun install)...");
      await runInstallCommand(options.verbose);
      logger.log("Package removal completed successfully");
    } catch (error) {
      logger.warn(`bun install failed: ${error instanceof Error ? error.message : String(error)}`);
      logger.log("Run 'bun install' manually to apply the changes");
    }
  } else if (!(options.dryRun || options.install)) {
    // Only show manual install message when automatic install is disabled
    logger.log("Run 'bun install' to apply the changes");
  }

  return totalChangesMade;
}
