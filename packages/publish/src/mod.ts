import { resolve } from "node:path";
import { type BumpType, bumpVersion } from "@reliverse/dler-bump";
import {
  getPackagePublishConfig,
  mergePublishOptions,
  type PackageKind,
  type RegistryType, 
} from "@reliverse/dler-config/impl/publish";
import { logger } from "@reliverse/dler-logger";
import { readPackageJSON, writePackageJSON } from "@reliverse/dler-pkg-tsc";
// Note: We'll implement declaration generation directly here to avoid circular dependencies
import { $ } from "bun";
import type { BaseConfig } from "@reliverse/dler-config/impl/core";
import { filterPackages, getWorkspacePackages, loadDlerConfig } from "@reliverse/dler-config/impl/discovery";

export interface PackagePublishConfig {
  enable?: boolean;
  dryRun?: boolean;
  tag?: string;
  access?: "public" | "restricted";
  otp?: string;
  authType?: "web" | "legacy";
  concurrency?: number;
  verbose?: boolean;
  bump?:
    | "major"
    | "minor"
    | "patch"
    | "premajor"
    | "preminor"
    | "prepatch"
    | "prerelease";
  bumpDisable?: boolean;
  registry?: RegistryType;
  kind?: PackageKind;
}

export interface PublishConfig extends BaseConfig {
  // Global publish configuration
  global?: PackagePublishConfig;
  // Per-package publish configurations
  packages?: Record<string, PackagePublishConfig>;
  // Package patterns for applying configs
  patterns?: Array<{
    pattern: string;
    config: PackagePublishConfig;
  }>;
}

export interface DlerConfig {
  publish?: PublishConfig;
}

export interface PublishOptions {
  dryRun?: boolean;
  tag?: string;
  access?: "public" | "restricted";
  otp?: string;
  authType?: "web" | "legacy";
  verbose?: boolean;
  bump?: BumpType;
  bumpDisable?: boolean;
  concurrency?: number;
  registry?: RegistryType;
  kind?: PackageKind;
}

export type { PackageKind, RegistryType } from "@reliverse/dler-config/impl/publish";

// ============================================================================
// Utility Functions
// ============================================================================


// ============================================================================
// Kind-Registry Validation
// ============================================================================

/**
 * Validate that the kind-registry combination is allowed
 */
function validateKindRegistryCombination(
  kind: PackageKind | undefined,
  registry: RegistryType | undefined,
): { valid: boolean; error?: string } {
  // If no kind specified, allow any registry
  if (!kind) {
    return { valid: true };
  }

  // If no registry specified, allow any kind
  if (!registry) {
    return { valid: true };
  }

  // Define allowed combinations
  const allowedCombinations: Record<PackageKind, RegistryType[]> = {
    library: ["npm", "jsr", "npm-jsr", "none"],
    "browser-app": ["vercel", "none"],
    "native-app": ["none"],
    cli: ["npm", "none"],
  };

  const allowedRegistries = allowedCombinations[kind];
  if (!allowedRegistries.includes(registry)) {
    return {
      valid: false,
      error: `Package kind "${kind}" is not compatible with registry "${registry}". Allowed registries for "${kind}": ${allowedRegistries.join(", ")}`,
    };
  }

  return { valid: true };
}

export interface PublishResult {
  success: boolean;
  packageName: string;
  packagePath: string;
  version?: string;
  error?: string;
}

export interface PublishAllResult {
  results: PublishResult[];
  hasErrors: boolean;
  successCount: number;
  errorCount: number;
}

/**
 * Check if dist folder exists and has content
 */
async function validateDistFolder(packagePath: string): Promise<boolean> {
  const distPath = resolve(packagePath, "dist");
  try {
    const stat = await Bun.file(distPath).stat();
    return stat.isDirectory();
  } catch {
    return false;
  }
}



/**
 * Restore original dependencies after publishing
 */
async function restoreOriginalDependencies(
  packagePath: string,
  originalDependencies: any,
  originalDevDependencies: any
): Promise<void> {
  try {
    const pkg = await readPackageJSON(packagePath);
    if (pkg) {
      // Restore original dependencies
      pkg.dependencies = originalDependencies;
      pkg.devDependencies = originalDevDependencies;
      
      // Write back the restored package.json
      await writePackageJSON(resolve(packagePath, "package.json"), pkg);
    }
  } catch (error) {
    logger.warn(
      `⚠️  Failed to restore original dependencies: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Resolve workspace dependency to actual version
 */
async function resolveWorkspaceVersion(packagePath: string, depName: string): Promise<string | null> {
  try {
    // Look for the workspace package in common locations
    const possiblePaths = [
      resolve(packagePath, "..", depName),
      resolve(packagePath, "..", "..", depName),
      resolve(packagePath, "..", "..", "..", depName),
      resolve(packagePath, "..", "packages", depName),
      resolve(packagePath, "..", "..", "packages", depName),
      resolve(packagePath, "..", "..", "..", "packages", depName),
    ];

    for (const possiblePath of possiblePaths) {
      try {
        const workspacePkg = await readPackageJSON(possiblePath);
        if (workspacePkg && workspacePkg.name === depName && workspacePkg.version) {
          return workspacePkg.version;
        }
      } catch {
        // Continue to next path
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve catalog dependency to actual version
 */
async function resolveCatalogVersion(packagePath: string, depName: string): Promise<string | null> {
  try {
    // Go up to 3 levels to find monorepo root
    const possibleRoots = [
      resolve(packagePath, ".."),
      resolve(packagePath, "..", ".."),
      resolve(packagePath, "..", "..", ".."),
    ];

    for (const possibleRoot of possibleRoots) {
      try {
        const rootPkg = await readPackageJSON(possibleRoot);
        if (rootPkg && rootPkg.workspaces) {
          // Handle both array format and object format for workspaces
          const workspaces = rootPkg.workspaces;
          if (typeof workspaces === 'object' && workspaces !== null && 'catalog' in workspaces) {
            const catalog = (workspaces as any).catalog;
            if (catalog && typeof catalog === 'object') {
              const catalogVersion = catalog[depName];
              if (catalogVersion) {
                return catalogVersion;
              }
            }
          }
        }
      } catch {
        // Continue to next path
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Modify package.json for publishing
 */
async function preparePackageForPublishing(
  packagePath: string,
  options: PublishOptions,
): Promise<{ 
  success: boolean; 
  version?: string; 
  error?: string; 
  originalPkg?: any;
  originalDependencies?: any;
  originalDevDependencies?: any;
}> {
  try {
    const pkg = await readPackageJSON(packagePath);
    if (!pkg) {
      return { success: false, error: "Could not read package.json" };
    }

    // Create a backup of the original package.json
    const originalPkg = { ...pkg };

    // Handle version bumping (skip if bumpDisable is true or dry-run is true)
    if (options.bump && !options.bumpDisable && !options.dryRun && pkg.version) {
      const bumpResult = bumpVersion(pkg.version, options.bump);
      if (!bumpResult) {
        return {
          success: false,
          error: `Invalid version bump: ${options.bump}`,
        };
      }
      pkg.version = bumpResult.bumped;
    }

    // Ensure package is marked as public for publishing
    // Set private to false (required for publishing)
    pkg.private = false;

    // Add publishConfig with access level
    if (!pkg.publishConfig) {
      pkg.publishConfig = {};
    }
    pkg.publishConfig.access = options.access || "public";

    // Note: bin field should be added during build process with --prepareForPublish
    // This function now assumes it's already present if needed

    // Note: Declaration files should be generated during build process
    // This function now assumes they are already present

    // Note: exports field should be updated during build process with --prepareForPublish
    // This function now assumes it's already transformed

    // Store original dependencies for restoration
    const originalDependencies = { ...pkg.dependencies };
    const originalDevDependencies = { ...pkg.devDependencies };

    // Remove devDependencies for publishing (they shouldn't go to npm)
    delete pkg.devDependencies;

    // Resolve workspace and catalog dependencies to actual versions
    if (pkg.dependencies) {
      for (const [depName, version] of Object.entries(pkg.dependencies)) {
        if (typeof version === "string") {
          if (version.startsWith("workspace:")) {
            // Resolve workspace dependency to actual version
            const workspaceVersion = await resolveWorkspaceVersion(packagePath, depName);
            if (workspaceVersion) {
              pkg.dependencies[depName] = workspaceVersion;
            } else {
              // If can't resolve, remove the dependency
              delete pkg.dependencies[depName];
            }
          } else if (version === "catalog:") {
            // Resolve catalog dependency to actual version
            const catalogVersion = await resolveCatalogVersion(packagePath, depName);
            if (catalogVersion) {
              pkg.dependencies[depName] = catalogVersion;
            } else {
              // If can't resolve, remove the dependency
              delete pkg.dependencies[depName];
            }
          }
        }
      }
    }

    // Write modified package.json back to root
    await writePackageJSON(resolve(packagePath, "package.json"), pkg);

    return { 
      success: true, 
      version: pkg.version, 
      originalPkg,
      originalDependencies,
      originalDevDependencies
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Publish a single package
 */
export async function publishPackage(
  packagePath: string,
  options: PublishOptions = {},
): Promise<PublishResult> {
  // Read package name from root for initial validation
  const rootPackageName =
    (await readPackageJSON(packagePath))?.name || "unknown";

  let originalPkg: any = null;
  let originalDependencies: any = null;
  let originalDevDependencies: any = null;

  try {
    // Validate kind-registry combination
    const validation = validateKindRegistryCombination(
      options.kind,
      options.registry,
    );
    if (!validation.valid) {
      return {
        success: false,
        packageName: rootPackageName,
        packagePath,
        error: validation.error,
      };
    }

    // Handle "none" registry - silently skip
    if (options.registry === "none") {
      return {
        success: true,
        packageName: rootPackageName,
        packagePath,
        version: (await readPackageJSON(packagePath))?.version,
      };
    }

    // Validate dist folder exists
    const hasDist = await validateDistFolder(packagePath);
    if (!hasDist) {
      return {
        success: false,
        packageName: rootPackageName,
        packagePath,
        error: "dist folder not found. Run 'dler build' first.",
      };
    }

    // Prepare package for publishing (modifies root package.json)
    const prepResult = await preparePackageForPublishing(packagePath, options);
    if (!prepResult.success) {
      return {
        success: false,
        packageName: rootPackageName,
        packagePath,
        error: prepResult.error,
      };
    }

    // Store original package and dependencies for potential restoration
    originalPkg = prepResult.originalPkg;
    originalDependencies = prepResult.originalDependencies;
    originalDevDependencies = prepResult.originalDevDependencies;

    // Read package metadata from root after preparation
    const rootPackage = await readPackageJSON(packagePath);
    const packageName = rootPackage?.name || rootPackageName;

    // Handle different registries
    const registry = options.registry || "npm";

    if (registry === "npm" || registry === "npm-jsr") {
      // Execute bun publish for npm from package root
      // The package.json is now in the root and will be used for publishing
      // The dist folder contains the built artifacts that will be included
      
      // Build command arguments properly
      const args: string[] = ["publish"];
      
      if (options.dryRun) {
        args.push("--dry-run");
      }
      if (options.tag) {
        args.push("--tag", options.tag);
      }
      if (options.access) {
        args.push("--access", options.access);
      }
      if (options.otp) {
        args.push("--otp", options.otp);
      }
      if (options.authType) {
        args.push("--auth-type", options.authType);
      }
      
      try {
        const result = await $`bun ${args}`.cwd(packagePath).text();
        if (options.verbose) {
          logger.log(`Published ${packageName}: ${result}`);
        }
      } catch (error) {
        // Try to get more detailed error information by running with stderr capture
        let errorDetails = "";
        if (error instanceof Error) {
          errorDetails = error.message;
        } else {
          errorDetails = String(error);
        }

        // Try to run the command again to get stderr
        try {
          const { stderr } = await $`bun ${args}`.cwd(packagePath).nothrow();
          if (stderr) {
            errorDetails += `\nStderr: ${stderr}`;
          }
        } catch {
          // Ignore secondary error
        }

        throw new Error(`Failed to publish ${packageName}: ${errorDetails}`);
      }
    }

    if (registry === "jsr" || registry === "npm-jsr") {
      // JSR publishing not yet implemented
      logger.warn(
        `⚠️  JSR publishing not yet implemented for ${packageName}. Skipping JSR publish.`,
      );
    }

    if (registry === "vercel") {
      // Vercel publishing not yet implemented
      logger.warn(
        `⚠️  Vercel publishing not yet implemented for ${packageName}. Skipping Vercel publish.`,
      );
      return {
        success: true,
        packageName,
        packagePath,
        version: rootPackage?.version,
      };
    }

    // Restore original dependencies after successful publishing
    if (originalDependencies || originalDevDependencies) {
      await restoreOriginalDependencies(packagePath, originalDependencies, originalDevDependencies);
    }

    return {
      success: true,
      packageName,
      packagePath,
      version: rootPackage?.version,
    };
  } catch (error) {
    // Restore original package.json if it was modified and an error occurred
    if (originalPkg) {
      try {
        await writePackageJSON(resolve(packagePath, "package.json"), originalPkg);
      } catch (restoreError) {
        logger.warn(
          `⚠️  Failed to restore original package.json: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
        );
      }
    }
    
    // Also restore dependencies if they were modified
    if (originalDependencies || originalDevDependencies) {
      await restoreOriginalDependencies(packagePath, originalDependencies, originalDevDependencies);
    }

    return {
      success: false,
      packageName: rootPackageName,
      packagePath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Publish all workspace packages
 */
export async function publishAllPackages(
  cwd?: string,
  ignore?: string | string[],
  options: PublishOptions = {},
): Promise<PublishAllResult> {
  try {
    // Load dler.ts configuration
    const dlerConfig = await loadDlerConfig(cwd);

    const packages = await getWorkspacePackages(cwd);
    const filteredPackages = filterPackages(packages, ignore);

    if (filteredPackages.length === 0) {
      logger.warn("No packages found to publish");
      return {
        results: [],
        hasErrors: false,
        successCount: 0,
        errorCount: 0,
      };
    }

    logger.info(`Found ${filteredPackages.length} package(s) to publish`);

    const results: PublishResult[] = [];
    const concurrency = options.concurrency || 1;

    // Filter out packages with enable: false before processing
    const packagesToPublish = filteredPackages.filter((pkg) => {
      const packageConfig = getPackagePublishConfig(pkg.name, dlerConfig);
      // If packageConfig is undefined, it means enable: false was set
      // If packageConfig exists but enable is explicitly false, skip it
      if (packageConfig === undefined || packageConfig.enable === false) {
        if (options.verbose) {
          logger.info(`Skipping ${pkg.name} (disabled in config)`);
        }
        return false;
      }
      return true;
    });

    if (packagesToPublish.length === 0) {
      logger.warn("No packages enabled for publishing");
      return {
        results: [],
        hasErrors: false,
        successCount: 0,
        errorCount: 0,
      };
    }

    logger.info(`Publishing ${packagesToPublish.length} enabled package(s)`);

    // Process packages with controlled concurrency
    for (let i = 0; i < packagesToPublish.length; i += concurrency) {
      const batch = packagesToPublish.slice(i, i + concurrency);

      const batchPromises = batch.map(async (pkg) => {
        // Merge CLI options with dler.ts configuration for this package
        const mergedOptions = mergePublishOptions(
          options,
          pkg.name,
          dlerConfig,
        );

        if (mergedOptions.verbose) {
          logger.info(`Publishing ${pkg.name}...`);
        }
        return await publishPackage(pkg.path, mergedOptions);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;
    const hasErrors = errorCount > 0;

    return {
      results,
      hasErrors,
      successCount,
      errorCount,
    };
  } catch (error) {
    logger.error(
      "Failed to publish packages:",
      error instanceof Error ? error.message : String(error),
    );
    return {
      results: [],
      hasErrors: true,
      successCount: 0,
      errorCount: 1,
    };
  }
}
