// apps/dler/src/cmds/add/impl.ts

import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createIncludeFilter } from "@reliverse/matcha";
import path from "@reliverse/pathkit";
import { logger } from "@reliverse/relinka";
import { hasWorkspaces, readPackageJSON, writePackageJSON } from "@reliverse/typerso";
import { getLatestVersion, runInstallCommand } from "../update/utils";

export interface AddOptions {
  target?: string;
  w?: boolean;
  catalog: boolean | string;
  scope: "dev" | "prod" | "peer" | "optional";
  prefix: string;
  install: boolean;
  cwd?: string;
  dryRun: boolean;
  verbose: boolean;
  versionSpec?: string | string[]; // Single version spec or array of version specs per package
}

export interface MonorepoInfo {
  isMonorepo: boolean;
  rootPath: string;
  rootPackageJson: any;
  workspacePackages?: string[];
}

// ============================================================================
// Monorepo Detection with Caching
// ============================================================================

// Cache for monorepo detection results
const monorepoCache = new Map<string, MonorepoInfo>();

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

interface CatalogInfo {
  catalogName: string | null;
  catalogPath: string | null;
}

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

async function resolveTargetPackage(
  monorepoInfo: MonorepoInfo,
  options: AddOptions
): Promise<TargetPackageInfo | MultipleTargetsInfo> {
  const { target, w } = options;

  // --w flag takes precedence: add to root package.json
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
        isMultiple: true as const,
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
        isMultiple: true as const,
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

  // Default behavior: if in monorepo, add to root; if single package, add to current
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
// Dependency Addition Logic
// ============================================================================

async function addDependencyToPackage(
  packagePath: string,
  packageJson: any,
  packageName: string,
  versionSpec: string,
  scope: "dev" | "prod" | "peer" | "optional",
  dryRun: boolean,
  verbose: boolean
): Promise<boolean> {
  const packageJsonPath = path.join(packagePath, "package.json");
  const fieldName = getDependencyFieldName(scope);
  const relativePath = relative(process.cwd(), packageJsonPath) || "package.json";

  // Check if dependency already exists
  if (packageJson[fieldName]?.[packageName]) {
    if (verbose) {
      logger.info(`ℹ️  ${packageName} already exists in ${fieldName} of ${relativePath}`);
    }
    return false;
  }

  // Initialize the dependency field if it doesn't exist
  if (!packageJson[fieldName]) {
    packageJson[fieldName] = {};
  }

  // Add the dependency
  packageJson[fieldName][packageName] = versionSpec;

  if (dryRun) {
    if (verbose) {
      logger.log(`📝 Would add ${packageName}@${versionSpec} to ${fieldName} in ${relativePath}`);
    }
  } else {
    await writePackageJSON(packageJsonPath, packageJson);
    // Individual logging removed - will be shown in summary
  }

  return true;
}

async function addDependencyToCatalog(
  monorepoInfo: MonorepoInfo,
  catalogInfo: CatalogInfo,
  packageName: string,
  versionSpec: string,
  dryRun: boolean,
  verbose: boolean
): Promise<boolean> {
  const workspaces = monorepoInfo.rootPackageJson.workspaces;
  const catalogExists = workspaces[catalogInfo.catalogName!];

  if (!catalogExists) {
    throw new Error(`Catalog '${catalogInfo.catalogName}' not found`);
  }

  // Check if dependency already exists in catalog
  if (catalogExists[packageName]) {
    if (verbose) {
      logger.info(`ℹ️  ${packageName} already exists in catalog '${catalogInfo.catalogName}'`);
    }
    return false;
  }

  if (dryRun) {
    if (verbose) {
      logger.log(
        `📝 Would add ${packageName}@${versionSpec} to catalog '${catalogInfo.catalogName}'`
      );
    }
  } else {
    // Add to catalog
    catalogExists[packageName] = versionSpec;
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

async function resolveVersionSpec(
  packageName: string,
  versionSpec: string | undefined,
  prefix: string
): Promise<string> {
  if (versionSpec) {
    // Apply prefix to specified version
    if (prefix === "none") {
      return versionSpec;
    }
    return `${prefix}${versionSpec}`;
  }

  // Fetch actual latest version from registry
  try {
    const latestVersion = await getLatestVersion(packageName);
    if (prefix === "none") {
      return latestVersion;
    }
    return `${prefix}${latestVersion}`;
  } catch (error) {
    // Fallback to "latest" if registry fetch fails
    logger.warn(`Failed to fetch latest version for ${packageName}, using 'latest': ${error}`);
    return "latest";
  }
}

async function resolvePackageVersionSpec(
  packageName: string,
  packageIndex: number,
  versionSpecs: string | string[] | undefined,
  prefix: string
): Promise<string> {
  let versionSpec: string | undefined;

  if (Array.isArray(versionSpecs)) {
    // Use version spec for this specific package
    versionSpec = versionSpecs[packageIndex];
  } else {
    // Use single version spec for all packages (backward compatibility)
    versionSpec = versionSpecs;
  }

  return await resolveVersionSpec(packageName, versionSpec, prefix);
}

// ============================================================================
// Main Function
// ============================================================================

export async function addDependency(
  packageNames: string | string[],
  options: AddOptions
): Promise<boolean> {
  const packageNameArray = Array.isArray(packageNames) ? packageNames : [packageNames];
  let totalChangesMade = false;
  const addedPackages: string[] = [];

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

      // Resolve version specification for this package
      const packageIndex = packageNameArray.indexOf(packageName);
      const versionSpec = await resolvePackageVersionSpec(
        packageName,
        packageIndex,
        options.versionSpec,
        options.prefix
      );

      // Add dependency to all targets
      if (catalogInfo.catalogName && monorepoInfo.isMonorepo) {
        // Catalog mode: add to catalog first, then add catalog reference to each target package
        const catalogChanged = await addDependencyToCatalog(
          monorepoInfo,
          catalogInfo,
          packageName,
          versionSpec,
          options.dryRun,
          options.verbose
        );
        changesMade = changesMade || catalogChanged;

        const catalogRef = `catalog:${catalogInfo.catalogName === "catalog" ? "" : catalogInfo.catalogName}`;
        for (const target of targetResult.targets) {
          const packageChanged = await addDependencyToPackage(
            target.packagePath,
            target.packageJson,
            packageName,
            catalogRef,
            options.scope,
            options.dryRun,
            options.verbose
          );
          changesMade = changesMade || packageChanged;
        }
      } else {
        // Direct mode: add directly to each target package
        for (const target of targetResult.targets) {
          const packageChanged = await addDependencyToPackage(
            target.packagePath,
            target.packageJson,
            packageName,
            versionSpec,
            options.scope,
            options.dryRun,
            options.verbose
          );
          changesMade = changesMade || packageChanged;
        }
      }

      if (changesMade) {
        addedPackages.push(packageName);
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

      // Resolve version specification for this package
      const packageIndex = packageNameArray.indexOf(packageName);
      const versionSpec = await resolvePackageVersionSpec(
        packageName,
        packageIndex,
        options.versionSpec,
        options.prefix
      );

      // Add dependency
      if (catalogInfo.catalogName && monorepoInfo.isMonorepo) {
        // Catalog mode: add to catalog first, then add catalog reference to target package
        const catalogChanged = await addDependencyToCatalog(
          monorepoInfo,
          catalogInfo,
          packageName,
          versionSpec,
          options.dryRun,
          options.verbose
        );
        changesMade = changesMade || catalogChanged;

        // Add catalog reference to target package
        const catalogRef = `catalog:${catalogInfo.catalogName === "catalog" ? "" : catalogInfo.catalogName}`;
        const packageChanged = await addDependencyToPackage(
          targetInfo.packagePath,
          targetInfo.packageJson,
          packageName,
          catalogRef,
          options.scope,
          options.dryRun,
          options.verbose
        );
        changesMade = changesMade || packageChanged;
      } else {
        // Direct mode: add directly to target package
        const packageChanged = await addDependencyToPackage(
          targetInfo.packagePath,
          targetInfo.packageJson,
          packageName,
          versionSpec,
          options.scope,
          options.dryRun,
          options.verbose
        );
        changesMade = changesMade || packageChanged;
      }

      if (changesMade) {
        addedPackages.push(packageName);
      }
      totalChangesMade = totalChangesMade || changesMade;
    }
  }

  // Show summary of all added packages
  if (addedPackages.length > 0) {
    if (options.dryRun) {
      logger.log(`📝 Would add dependencies: ${addedPackages.join(", ")}`);
    } else {
      logger.success(`✅ Added dependencies: ${addedPackages.join(", ")}`);
    }
  } else {
    logger.log("ℹ️  No dependencies to add");
  }

  // Handle installation once for all packages
  if (totalChangesMade && options.install && !options.dryRun) {
    try {
      logger.log("Applying changes (bun install)...");
      await runInstallCommand(options.verbose);
      logger.log("Installation completed successfully");
    } catch (error) {
      logger.warn(`Install failed: ${error instanceof Error ? error.message : String(error)}`);
      logger.log("Run 'bun install' manually to apply the changes");
    }
  } else if (!(options.dryRun || options.install)) {
    // Only show manual install message when automatic install is disabled
    logger.log("Run 'bun install' to install the new dependencies");
  }

  return totalChangesMade;
}
