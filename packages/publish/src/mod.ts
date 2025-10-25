import { resolve } from "node:path";
import { type BumpType, bumpVersion } from "@reliverse/dler-bump";
import {
  type BaseConfig,
  filterPackages as filterPackagesFromConfig,
  getPackagePublishConfig,
  getWorkspacePackages as getWorkspacePackagesFromConfig,
  loadDlerConfig,
  mergePublishOptions,
  type PackageKind,
  type RegistryType,
} from "@reliverse/dler-config";
import { logger } from "@reliverse/dler-logger";
import { readPackageJSON, writePackageJSON } from "@reliverse/dler-pkg-tsc";
import { $ } from "bun";

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
  bin?: string;
}

export type { PackageKind, RegistryType } from "@reliverse/dler-config";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract package name from scoped package name
 * @param packageName - The full package name (e.g., "@reliverse/dler")
 * @returns The package name without scope (e.g., "dler")
 */
function extractPackageName(packageName: string): string {
  const parts = packageName.split("/");
  return parts[parts.length - 1] || packageName;
}

/**
 * Parse bin argument string into a record of binary definitions
 * @param binArg - The bin argument string (e.g., "dler=dist/cli.js,login=dist/foo/bar/login.js")
 * @returns Record mapping binary names to their file paths
 */
function parseBinArgument(binArg: string): Record<string, string> {
  const binMap: Record<string, string> = {};

  if (!binArg) {
    return binMap;
  }

  const entries = binArg.split(",");
  for (const entry of entries) {
    const [name, path] = entry.split("=");
    if (name && path) {
      binMap[name.trim()] = path.trim();
    }
  }

  return binMap;
}

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

// Configuration functions moved to @reliverse/dler-config

// Discovery functions moved to @reliverse/dler-config

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
 * Update exports field to point to built files instead of source files
 */
function updateExportsForPublishing(exports: any): any {
  if (typeof exports === "string") {
    // Simple string export - convert .ts to .js and src/ to dist/
    return exports.replace(/\.ts$/, ".js").replace(/^\.\/src\//, "./");
  }

  if (Array.isArray(exports)) {
    // Array of exports - recursively update each
    return exports.map(updateExportsForPublishing);
  }

  if (typeof exports === "object" && exports !== null) {
    const updated: any = {};
    
    for (const [key, value] of Object.entries(exports)) {
      if (typeof value === "object" && value !== null) {
        // Nested object (like { "types": "./src/mod.ts", "default": "./src/mod.ts" })
        const updatedValue: any = {};
        for (const [subKey, subValue] of Object.entries(value)) {
          if (typeof subValue === "string") {
            // Convert source paths to built paths
            if (subKey === "types") {
              // TypeScript declarations: .ts -> .d.ts and src/ -> dist/
              updatedValue[subKey] = subValue.replace(/\.ts$/, ".d.ts").replace(/^\.\/src\//, "./");
            } else {
              // JavaScript files: .ts -> .js and src/ -> dist/
              updatedValue[subKey] = subValue.replace(/\.ts$/, ".js").replace(/^\.\/src\//, "./");
            }
          } else {
            updatedValue[subKey] = subValue;
          }
        }
        updated[key] = updatedValue;
      } else if (typeof value === "string") {
        // Direct string value - convert .ts to .js and src/ to dist/
        updated[key] = value.replace(/\.ts$/, ".js").replace(/^\.\/src\//, "./");
      } else {
        updated[key] = value;
      }
    }
    
    return updated;
  }

  return exports;
}

/**
 * Modify package.json for publishing
 */
async function preparePackageForPublishing(
  packagePath: string,
  options: PublishOptions,
): Promise<{ success: boolean; version?: string; error?: string; originalPkg?: any }> {
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

    // Add bin field for CLI packages
    if (options.kind === "cli") {
      const binMap = parseBinArgument(options.bin || "");

      // If no custom bin definitions provided, use default
      if (Object.keys(binMap).length === 0) {
        const packageName = extractPackageName(pkg.name || "cli");
        binMap[packageName] = "dist/cli.js";
      }

      pkg.bin = binMap;
    }

    // Update exports field to point to built files
    if (pkg.exports) {
      pkg.exports = updateExportsForPublishing(pkg.exports);
    }

    // Resolve workspace and catalog dependencies to actual versions
    if (pkg.dependencies) {
      for (const [depName, version] of Object.entries(pkg.dependencies)) {
        if (typeof version === "string") {
          if (version.startsWith("workspace:")) {
            // For workspace dependencies, we need to resolve to actual versions
            // For now, we'll remove workspace deps that can't be resolved
            delete pkg.dependencies[depName];
          } else if (version === "catalog:") {
            // For catalog dependencies, we need to resolve to actual versions
            // For now, we'll remove catalog deps that can't be resolved
            delete pkg.dependencies[depName];
          }
        }
      }
    }

    // Also resolve devDependencies
    if (pkg.devDependencies) {
      for (const [depName, version] of Object.entries(pkg.devDependencies)) {
        if (typeof version === "string") {
          if (version.startsWith("workspace:") || version === "catalog:") {
            delete pkg.devDependencies[depName];
          }
        }
      }
    }

    // Write modified package.json back to root
    await writePackageJSON(resolve(packagePath, "package.json"), pkg);

    return { success: true, version: pkg.version, originalPkg };
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

    // Store original package for potential restoration
    originalPkg = prepResult.originalPkg;

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

    const packages = await getWorkspacePackagesFromConfig(cwd);
    const filteredPackages = filterPackagesFromConfig(packages, ignore);

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
