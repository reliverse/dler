import { resolve } from "node:path";
import { type BumpType, bumpVersion, getNextVersion } from "@reliverse/dler-bump";
import {
  getPackagePublishConfig,
  mergePublishOptions,
  type PackageKind,
  type RegistryType, 
} from "@reliverse/dler-config/impl/publish";
import { logger } from "@reliverse/dler-logger";
import { readPackageJSON, writePackageJSON } from "@reliverse/dler-pkg-tsc";
import type { BaseConfig } from "@reliverse/dler-config/impl/core";
import { filterPackages, getWorkspacePackages, loadDlerConfig, findMonorepoRoot } from "@reliverse/dler-config/impl/discovery";

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
// Types
// ============================================================================

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Spawn bun publish command with piped stdout/stderr
 */
async function runBunPublishCommand(
  packagePath: string,
  args: string[],
): Promise<SpawnResult> {
  try {
    const proc = Bun.spawn(args, {
      cwd: packagePath,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exited;

    return { stdout, stderr, exitCode };
  } catch (error) {
    throw new Error(
      `Failed to spawn bun publish: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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
  warning?: string;
}

export interface PublishAllResult {
  results: PublishResult[];
  hasErrors: boolean;
  successCount: number;
  errorCount: number;
  warningCount: number;
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
 * Validate that package.json has all required fields for publishing
 * This checks fields that should be added by the build command
 */
function validatePackageJsonFields(
  pkg: any,
  _packageName: string,
  kind?: PackageKind,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required basic fields
  if (!pkg.name) {
    errors.push("Missing required field: 'name'");
  }

  if (!pkg.version) {
    errors.push("Missing required field: 'version'");
  }

  // Check if package is private (should not be)
  if (pkg.private === true) {
    errors.push("Package has 'private: true' - cannot publish. Run 'dler build' to prepare the package.");
  }

  // Check for files field (added by build command)
  if (!pkg.files || !Array.isArray(pkg.files) || pkg.files.length === 0) {
    errors.push("Missing or empty 'files' field - Run 'dler build' to add it.");
  } else {
    // Verify that dist is included in files
    const hasDist = pkg.files.includes("dist") || pkg.files.includes("dist/*");
    if (!hasDist) {
      errors.push("'files' field must include 'dist' directory");
    }
  }

  // Check for exports field (should exist and be transformed by build)
  // Skip exports requirement for packages with bin field
  const hasBinField = pkg.bin && typeof pkg.bin === "object" && Object.keys(pkg.bin).length > 0;
  
  if (!pkg.exports && !hasBinField) {
    errors.push("Missing 'exports' field - Run 'dler build' to add it.");
  } else if (pkg.exports) {
    // Verify exports point to dist files (not src)
    const exportsStr = JSON.stringify(pkg.exports).toLowerCase();
    if (exportsStr.includes("/src/")) {
      errors.push("'exports' field still contains '/src/' paths - Run 'dler build' to transform them to '/dist/' paths.");
    }
  }

  // Check for publishConfig (added by build command)
  if (!pkg.publishConfig) {
    errors.push("Missing 'publishConfig' field - Run 'dler build' to add it.");
  } else if (!pkg.publishConfig.access) {
    errors.push("Missing 'publishConfig.access' field - Run 'dler build' to add it.");
  }

  // For CLI packages, check for bin field
  if (kind === "cli") {
    if (!pkg.bin) {
      errors.push("CLI package missing 'bin' field - Run 'dler build' to add it.");
    } else if (typeof pkg.bin === "object") {
      const binEntries = Object.keys(pkg.bin);
      if (binEntries.length === 0) {
        errors.push("CLI package has empty 'bin' field");
      } else {
        // Verify bin paths point to dist
        for (const [binName, binPath] of Object.entries(pkg.bin)) {
          if (typeof binPath === "string" && !binPath.startsWith("dist/")) {
            errors.push(`CLI bin entry '${binName}' should point to 'dist/' directory, found: '${binPath}'`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Restore original dependencies after publishing
 */
async function restoreOriginalDependencies(
  packagePath: string,
  originalDependencies: any,
  originalDevDependencies: any,
  originalScripts?: any
): Promise<void> {
  try {
    const pkg = await readPackageJSON(packagePath);
    if (pkg) {
      // Restore original dependencies (only if they existed)
      if (originalDependencies !== undefined) {
        pkg.dependencies = originalDependencies;
      }    
      if (originalDevDependencies !== undefined) {
        pkg.devDependencies = originalDevDependencies;
      }
      // Restore original scripts if they existed
      if (originalScripts !== undefined) {
        pkg.scripts = originalScripts;
      }
      
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
async function resolveWorkspaceVersion(
  packagePath: string,
  depName: string,
  workspacePackages?: Array<{ name: string; path: string; pkg: any }>,
  bumpedVersions?: Map<string, string>,
): Promise<string | null> {
  try {
    // First check bumped versions map (for packages being published in this batch)
    if (bumpedVersions?.has(depName)) {
      return bumpedVersions.get(depName) || null;
    }
    
    // Get workspace packages if not provided
    if (!workspacePackages) {
      const monorepoRoot = await findMonorepoRoot(packagePath);
      if (!monorepoRoot) return null;
      workspacePackages = await getWorkspacePackages(monorepoRoot);
    }
    
    // Find the workspace package by name
    const workspacePkg = workspacePackages.find(pkg => pkg.name === depName);
    if (workspacePkg?.pkg?.version) {
      return workspacePkg.pkg.version;
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
  workspacePackages?: Array<{ name: string; path: string; pkg: any }>,
  bumpedVersions?: Map<string, string>,
  shouldBumpVersion = true,
): Promise<{ 
  success: boolean; 
  version?: string; 
  error?: string; 
  originalPkg?: any;
  originalDependencies?: any;
  originalDevDependencies?: any;
  originalScripts?: any;
}> {
  try {
    const pkg = await readPackageJSON(packagePath);
    if (!pkg) {
      return { success: false, error: "Could not read package.json" };
    }

    // Create a backup of the original package.json
    const originalPkg = { ...pkg };

    // Handle version bumping (skip if bumpDisable is true or dry-run is true or shouldBumpVersion is false)
    if (shouldBumpVersion && options.bump && !options.bumpDisable && !options.dryRun && pkg.version) {
      const bumpResult = bumpVersion(pkg.version, options.bump);
      if (!bumpResult) {
        return {
          success: false,
          error: `Invalid version bump: ${options.bump}`,
        };
      }
      if (options.verbose) {
        logger.log(`  Bumping version from ${pkg.version} to ${bumpResult.bumped} (${options.bump})`);
      }
      pkg.version = bumpResult.bumped;
    }


    // Add publishConfig with access level
    if (!pkg.publishConfig) {
      pkg.publishConfig = {};
    }
    pkg.publishConfig.access = options.access || "public";

    // Store original dependencies for restoration (only if they exist and have content)
    const originalDependencies = pkg.dependencies && Object.keys(pkg.dependencies).length > 0 ? { ...pkg.dependencies } : undefined;
    const originalDevDependencies = pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0 ? { ...pkg.devDependencies } : undefined;
    const originalScripts = pkg.scripts && Object.keys(pkg.scripts).length > 0 ? { ...pkg.scripts } : undefined;

    // Remove devDependencies for publishing (they shouldn't go to npm)
    delete pkg.devDependencies;

    // Remove scripts for publishing (they shouldn't go to npm)
    delete pkg.scripts;

    // Resolve workspace and catalog dependencies to actual versions
    if (pkg.dependencies) {
      for (const [depName, version] of Object.entries(pkg.dependencies)) {
        if (typeof version === "string") {
          if (version.startsWith("workspace:")) {
            // Resolve workspace dependency to actual version
            const workspaceVersion = await resolveWorkspaceVersion(packagePath, depName, workspacePackages, bumpedVersions);
            if (workspaceVersion) {
              if (options.verbose) {
                logger.log(`  Resolving workspace dependency ${depName}: ${version} -> ${workspaceVersion}`);
              }
              pkg.dependencies[depName] = workspaceVersion;
            } else {
              // If can't resolve, remove the dependency
              if (options.verbose) {
                logger.warn(`  ⚠️  Cannot resolve workspace dependency ${depName}, removing it`);
              }
              delete pkg.dependencies[depName];
            }
          } else if (version === "catalog:") {
            // Resolve catalog dependency to actual version
            const catalogVersion = await resolveCatalogVersion(packagePath, depName);
            if (catalogVersion) {
              if (options.verbose) {
                logger.log(`  Resolving catalog dependency ${depName}: ${version} -> ${catalogVersion}`);
              }
              pkg.dependencies[depName] = catalogVersion;
            } else {
              // If can't resolve, remove the dependency
              if (options.verbose) {
                logger.warn(`  ⚠️  Cannot resolve catalog dependency ${depName}, removing it`);
              }
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
      originalDevDependencies,
      originalScripts
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
  bumpedVersions?: Map<string, string>,
): Promise<PublishResult> {
  // Read package name from root for initial validation
  const rootPkg = await readPackageJSON(packagePath);
  const rootPackageName = rootPkg?.name || "unknown";

  let originalPkg: any = null;
  let originalDependencies: any = null;
  let originalDevDependencies: any = null;
  let originalScripts: any = null;

  // Fetch workspace packages once for efficient dependency resolution
  let workspacePackages: Array<{ name: string; path: string; pkg: any }> | undefined;
  let monorepoRoot: string | null = null;
  try {
    monorepoRoot = await findMonorepoRoot(packagePath);
    if (monorepoRoot) {
      workspacePackages = await getWorkspacePackages(monorepoRoot);
      if (options.verbose) {
        logger.log(`  Found ${workspacePackages.length} workspace packages`);
      }
    }
  } catch {
    // If we can't fetch workspace packages, we'll continue 
    // without them and rely on fallback resolution
  }

  // Track files that were copied and need cleanup
  const copiedFiles: string[] = [];

  try {
    // NEVER allow publishing private packages
    if (rootPkg?.private === true) {
      return {
        success: true,
        packageName: rootPackageName,
        packagePath,
        ...(options.verbose && {
          warning: `The package has "private: true", publishing skipped.`,
        }),
      };
    }

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

    // Copy README.md and LICENSE from root if they're missing in package
    if (monorepoRoot) {
      const filesToCopy = ["README.md", "LICENSE"];
      
      for (const fileName of filesToCopy) {
        const sourcePath = resolve(monorepoRoot, fileName);
        const targetPath = resolve(packagePath, fileName);
        
        try {
          // Check if file exists in source (monorepo root)
          const sourceFile = Bun.file(sourcePath);
          const sourceExists = await sourceFile.exists();
          
          if (sourceExists) {
            // Check if file already exists in package
            const targetFile = Bun.file(targetPath);
            const targetExists = await targetFile.exists();
            
            if (!targetExists) {
              // Copy the file
              const content = await sourceFile.text();
              await Bun.write(targetPath, content);
              copiedFiles.push(targetPath);
              
              if (options.verbose) {
                logger.log(`  Copied ${fileName} from monorepo root`);
              }
            }
          }
        } catch {
          // Skip if can't copy (file doesn't exist or permission error)
        }
      }
    }

    // Validate package.json has all required fields
    const pkgValidation = validatePackageJsonFields(rootPkg, rootPackageName, options.kind);
    if (!pkgValidation.valid) {
      return {
        success: false,
        packageName: rootPackageName,
        packagePath,
        error: `Package.json validation failed:\n  ${pkgValidation.errors.join("\n  ")}`,
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
    const prepResult = await preparePackageForPublishing(packagePath, options, workspacePackages, bumpedVersions);
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
    originalScripts = prepResult.originalScripts;

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
        const result = await runBunPublishCommand(packagePath, ["bun", ...args]);
        
        if (result.exitCode !== 0) {
          // Parse output for error information
          const errorOutput = result.stderr || result.stdout;
          throw new Error(`Failed to publish ${packageName} (exit code ${result.exitCode}): ${errorOutput}`);
        }
        
        // Success - parse output for relevant info
        const output = result.stdout || result.stderr;
        
        // Extract published version if available
        const versionMatch = output.match(/published\s+([^\s]+)/i) || 
                           output.match(/@([0-9]+\.[0-9]+\.[0-9]+)/);
        const version = versionMatch ? versionMatch[1] : rootPackage?.version;
        
        // Display custom log message (npm output is captured internally but never displayed)
        if (options.verbose) {
          logger.log(`✓ Published ${packageName}@${version || "unknown"}`);
        } else {
          // Minimal output in normal mode
          logger.log(`✓ Published ${packageName}${version ? `@${version}` : ""}`);
        }
      } catch (error) {
        throw new Error(
          `Failed to publish ${packageName}: ${error instanceof Error ? error.message : String(error)}`,
        );
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
    if (originalDependencies || originalDevDependencies || originalScripts) {
      await restoreOriginalDependencies(packagePath, originalDependencies, originalDevDependencies, originalScripts);
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
    if (originalDependencies || originalDevDependencies || originalScripts) {
      await restoreOriginalDependencies(packagePath, originalDependencies, originalDevDependencies, originalScripts);
    }

    return {
      success: false,
      packageName: rootPackageName,
      packagePath,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Cleanup copied files regardless of success or failure
    for (const copiedFile of copiedFiles) {
      try {
        await Bun.file(copiedFile).unlink();
        if (options.verbose) {
          const fileName = copiedFile.split(/[/\\]/).pop();
          logger.log(`  Removed copied file: ${fileName}`);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
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
        warningCount: 0,
      };
    }

    logger.info(`Found ${filteredPackages.length} package(s) to publish`);

    const results: PublishResult[] = [];
    const concurrency = options.concurrency || 3;

    // Filter out packages with enable: false before processing
    const packagesToPublish = filteredPackages.filter((pkg) => {
      const packageConfig = getPackagePublishConfig(pkg.name, dlerConfig);
      // Only skip if enable is explicitly set to false
      // undefined means no config exists, so enable by default
      if (packageConfig?.enable === false) {
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
        warningCount: 0,
      };
    }

    logger.info(`Publishing ${packagesToPublish.length} enabled package(s)`);

    // Pre-bump all packages to calculate new versions before resolving dependencies
    // This ensures that workspace dependencies resolve to the bumped versions
    const bumpedVersions = new Map<string, string>();
    if (options.verbose) {
      logger.info("Pre-bumping package versions...");
    }
    
    for (const pkg of packagesToPublish) {
      const mergedOptions = mergePublishOptions(options, pkg.name, dlerConfig);
      const bumpType = mergedOptions.bump || (mergedOptions.bumpDisable ? undefined : "patch");
      
      if (bumpType && !mergedOptions.bumpDisable && pkg.pkg.version) {
        try {
          const nextVersion = getNextVersion(pkg.pkg.version, bumpType);
          if (nextVersion) {
            bumpedVersions.set(pkg.name, nextVersion);
            if (options.verbose) {
              logger.log(`  ${pkg.name}: ${pkg.pkg.version} -> ${nextVersion}`);
            }
          }
        } catch {
          // Skip if can't bump
        }
      } else if (pkg.pkg.version) {
        // If not bumping, use current version
        bumpedVersions.set(pkg.name, pkg.pkg.version);
      }
    }

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

        // Ensure default bump value is preserved if not explicitly set
        // Precedence: defaults > config > CLI args
        if (!mergedOptions.bump && !mergedOptions.bumpDisable) {
          mergedOptions.bump = "patch";
        }

        if (mergedOptions.verbose) {
          logger.info(`Publishing ${pkg.name}...`);
        }
        return await publishPackage(pkg.path, mergedOptions, bumpedVersions);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;
    const warningCount = results.filter((r) => r.warning).length;
    const hasErrors = errorCount > 0;

    return {
      results,
      hasErrors,
      successCount,
      errorCount,
      warningCount,
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
      warningCount: 0,
    };
  }
}
