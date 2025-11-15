import { resolve } from "node:path";
import { transformExportsForBuild } from "@reliverse/dler-build";
import {
  type BumpType,
  bumpVersion,
  getNextVersion,
} from "@reliverse/dler-bump";
import type { BaseConfig } from "@reliverse/dler-config/impl/core";
import {
  filterPackages,
  findMonorepoRoot,
  getWorkspacePackages,
  loadDlerConfig,
} from "@reliverse/dler-config/impl/discovery";
import {
  getPackagePublishConfig,
  mergePublishOptions,
  type PackageKind,
  type RegistryType,
} from "@reliverse/dler-config/impl/publish";
import { logger } from "@reliverse/dler-logger";
import { readPackageJSON, writePackageJSON } from "@reliverse/dler-pkg-tsc";

// ============================================================================
// Constants
// ============================================================================

const THROW_2FA_ERROR = false;

// Track if 2FA tip has been shown (only show once per session)
let hasShown2FATip = false;

// ============================================================================
// Types
// ============================================================================

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
  withNpmLogs?: boolean;
  gzipLevel?: string;
  ca?: string;
  cafile?: string;
  ignoreScripts?: boolean;
  silent?: boolean;
  noProgress?: boolean;
  noSummary?: boolean;
  bunRegistry?: string;
  skipTip2FA?: boolean;
}

export type {
  PackageKind,
  RegistryType,
} from "@reliverse/dler-config/impl/publish";

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
  verbose?: boolean,
  withNpmLogs?: boolean,
): Promise<SpawnResult> {
  try {
    if (verbose) {
      logger.debug(`Spawning bun publish command: bun ${args.join(" ")}`);
      logger.debug(`Working directory: ${packagePath}`);
      if (withNpmLogs) {
        logger.debug(
          "With npm logs enabled - output will be displayed directly",
        );
      }
    }

    // When withNpmLogs is true, use "inherit" to show output directly and allow input
    // When false, use "pipe" to capture output (default behavior) and ignore stdin
    // Explicitly pass environment variables to ensure NPM_CONFIG_TOKEN is available
    const proc = Bun.spawn(args, {
      cwd: packagePath,
      stdout: withNpmLogs ? "inherit" : "pipe",
      stderr: withNpmLogs ? "inherit" : "pipe",
      stdin: withNpmLogs ? "inherit" : "ignore", // Allow input when showing logs, prevent hangs when hiding logs
      env: process.env, // Explicitly pass environment variables
    });

    // Set a timeout to prevent infinite hangs (5 minutes)
    const timeout = 5 * 60 * 1000;
    let timeoutFired = false;
    const timeoutId = setTimeout(() => {
      timeoutFired = true;
      proc.kill();
    }, timeout);

    if (verbose) {
      logger.debug(`Set timeout of ${timeout / 1000}s for publish command`);
    }

    // When withNpmLogs is true, we can't capture stdout/stderr (they go to terminal)
    // So we just wait for the process to exit and return empty strings
    let stdout = "";
    let stderr = "";

    if (withNpmLogs) {
      // Wait for process to exit, can't capture output
      const exitCode = await proc.exited;
      clearTimeout(timeoutId);

      if (verbose) {
        logger.debug(`Command exited with code: ${exitCode}`);
      }

      // If timeout fired, provide a more helpful error message
      if (timeoutFired) {
        if (verbose) {
          logger.debug("Publish command timed out after 5 minutes");
        }
        return {
          stdout: "",
          stderr:
            "Error: Publishing timed out after 5 minutes. This may indicate an authentication issue or network problem.",
          exitCode: 1,
        };
      }

      return { stdout, stderr, exitCode };
    }

    // Original behavior: capture output when withNpmLogs is false
    [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exited;
    clearTimeout(timeoutId);

    if (verbose) {
      logger.debug(`Command exited with code: ${exitCode}`);
      if (stdout) {
        logger.debug(`Stdout length: ${stdout.length} bytes`);
      }
      if (stderr) {
        logger.debug(`Stderr length: ${stderr.length} bytes`);
      }
    }

    // If timeout fired, provide a more helpful error message
    if (timeoutFired) {
      if (verbose) {
        logger.debug("Publish command timed out after 5 minutes");
      }
      return {
        stdout,
        stderr: `${stderr}\n\nError: Publishing timed out after 5 minutes. This may indicate an authentication issue or network problem.`,
        exitCode: 1,
      };
    }

    // Check for OTP requirement message
    const combinedOutput = `${stdout}${stderr}`;
    if (
      THROW_2FA_ERROR &&
      combinedOutput.includes("This operation requires a one-time password.")
    ) {
      throw new Error(
        "This operation requires a one-time password. You have 2FA enabled in your npm account. Please set NPM_CONFIG_TOKEN environment variable with your npm token.",
      );
    }
    // Check for OTP input error (when stdin is ignored and bun publish tries to read OTP)
    if (
      combinedOutput.includes("failed to read OTP input") ||
      combinedOutput.includes("use your security key for authentication")
    ) {
      const hasToken = !!(
        process.env.NPM_CONFIG_TOKEN || process.env.NPM_TOKEN
      );
      if (hasToken) {
        throw new Error(
          "2FA authentication required. NPM_CONFIG_TOKEN is set but authentication failed. Please verify:\n  1. The token is valid and not expired\n  2. The token has publish permissions\n  3. Use --with-npm-logs flag to allow interactive OTP input if token authentication is not working",
        );
      }
      throw new Error(
        "2FA authentication required. The publish command cannot read OTP input when output is captured. Please either:\n  1. Set NPM_CONFIG_TOKEN environment variable with your npm token (note: .env files are not automatically loaded - export it in your shell or use a tool like dotenv-cli), or\n  2. Use --with-npm-logs flag to allow interactive OTP input.",
      );
    }

    return { stdout, stderr, exitCode };
  } catch (error) {
    if (verbose) {
      logger.debug(
        `Failed to spawn bun publish: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
  verbose?: boolean,
): { valid: boolean; error?: string } {
  if (verbose) {
    logger.debug(
      `Validating kind-registry combination: kind=${kind ?? "undefined"}, registry=${registry ?? "undefined"}`,
    );
  }

  // If no kind specified, allow any registry
  if (!kind) {
    if (verbose) {
      logger.debug("No kind specified, allowing any registry");
    }
    return { valid: true };
  }

  // If no registry specified, allow any kind
  if (!registry) {
    if (verbose) {
      logger.debug("No registry specified, allowing any kind");
    }
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
  if (verbose) {
    logger.debug(
      `Allowed registries for kind "${kind}": ${allowedRegistries.join(", ")}`,
    );
  }

  if (!allowedRegistries.includes(registry)) {
    if (verbose) {
      logger.debug(
        `Validation failed: registry "${registry}" not allowed for kind "${kind}"`,
      );
    }
    return {
      valid: false,
      error: `Package kind "${kind}" is not compatible with registry "${registry}". Allowed registries for "${kind}": ${allowedRegistries.join(", ")}`,
    };
  }

  if (verbose) {
    logger.debug("Kind-registry combination is valid");
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
async function validateDistFolder(
  packagePath: string,
  verbose?: boolean,
): Promise<boolean> {
  const distPath = resolve(packagePath, "dist");
  if (verbose) {
    logger.debug(`Checking dist folder at: ${distPath}`);
  }
  try {
    const stat = await Bun.file(distPath).stat();
    const isValid = stat.isDirectory();
    if (verbose) {
      logger.debug(
        `Dist folder ${isValid ? "exists and is a directory" : "is not a directory"}`,
      );
    }
    return isValid;
  } catch (error) {
    if (verbose) {
      logger.debug(
        `Dist folder validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
  verbose?: boolean,
): { valid: boolean; errors: string[] } {
  if (verbose) {
    logger.debug(`Validating package.json fields for package: ${pkg.name}`);
    logger.debug(`Package kind: ${kind ?? "undefined"}`);
  }

  const errors: string[] = [];

  // Required basic fields
  if (!pkg.name) {
    errors.push("Missing required field: 'name'");
  }

  if (!pkg.version) {
    errors.push("Missing required field: 'version'");
  } else if (verbose) {
    logger.debug(`Package version: ${pkg.version}`);
  }

  // Check if package is private (should not be)
  if (pkg.private === true) {
    errors.push(
      "Package has 'private: true' - cannot publish. Run 'dler build' to prepare the package.",
    );
  }

  // Check for files field (added by build command)
  if (!pkg.files || !Array.isArray(pkg.files) || pkg.files.length === 0) {
    errors.push("Missing or empty 'files' field - Run 'dler build' to add it.");
  } else {
    if (verbose) {
      logger.debug(`Files field: ${JSON.stringify(pkg.files)}`);
    }
    // Verify that dist is included in files
    const hasDist = pkg.files.includes("dist") || pkg.files.includes("dist/*");
    if (!hasDist) {
      errors.push("'files' field must include 'dist' directory");
    }
  }

  // Check for exports field (should exist)
  // The publish command will transform /src/ paths to /dist/ automatically
  // Skip exports requirement for packages with bin field
  const hasBinField =
    pkg.bin && typeof pkg.bin === "object" && Object.keys(pkg.bin).length > 0;

  if (verbose) {
    logger.debug(`Has bin field: ${hasBinField}`);
    logger.debug(`Has exports field: ${!!pkg.exports}`);
  }

  if (!pkg.exports && !hasBinField) {
    errors.push("Missing 'exports' field - Run 'dler build' to add it.");
  }

  // Check for publishConfig (added by build command)
  if (!pkg.publishConfig) {
    errors.push("Missing 'publishConfig' field - Run 'dler build' to add it.");
  } else if (!pkg.publishConfig.access) {
    errors.push(
      "Missing 'publishConfig.access' field - Run 'dler build' to add it.",
    );
  } else if (verbose) {
    logger.debug(`PublishConfig access: ${pkg.publishConfig.access}`);
  }

  // For CLI packages, check for bin field
  if (kind === "cli") {
    if (!pkg.bin) {
      errors.push(
        "CLI package missing 'bin' field - Run 'dler build' to add it.",
      );
    } else if (typeof pkg.bin === "object") {
      const binEntries = Object.keys(pkg.bin);
      if (verbose) {
        logger.debug(`CLI bin entries: ${binEntries.join(", ")}`);
      }
      if (binEntries.length === 0) {
        errors.push("CLI package has empty 'bin' field");
      } else {
        // Verify bin paths point to dist
        for (const [binName, binPath] of Object.entries(pkg.bin)) {
          if (typeof binPath === "string" && !binPath.startsWith("dist/")) {
            errors.push(
              `CLI bin entry '${binName}' should point to 'dist/' directory, found: '${binPath}'`,
            );
          }
        }
      }
    }
  }

  if (verbose) {
    logger.debug(
      `Package validation ${errors.length === 0 ? "passed" : "failed"} with ${errors.length} error(s)`,
    );
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
  originalScripts?: any,
  originalExports?: any,
  verbose?: boolean,
): Promise<void> {
  if (verbose) {
    logger.debug(`Restoring original package.json for: ${packagePath}`);
  }
  try {
    const pkg = await readPackageJSON(packagePath);
    if (pkg) {
      // Restore original dependencies (only if they existed)
      if (originalDependencies !== undefined) {
        if (verbose) {
          logger.debug(
            `Restoring ${Object.keys(originalDependencies).length} dependencies`,
          );
        }
        pkg.dependencies = originalDependencies;
      }
      if (originalDevDependencies !== undefined) {
        if (verbose) {
          logger.debug(
            `Restoring ${Object.keys(originalDevDependencies).length} devDependencies`,
          );
        }
        pkg.devDependencies = originalDevDependencies;
      }
      // Restore original scripts if they existed
      if (originalScripts !== undefined) {
        if (verbose) {
          logger.debug(
            `Restoring ${Object.keys(originalScripts).length} scripts`,
          );
        }
        pkg.scripts = originalScripts;
      }
      // Restore original exports if they existed
      if (originalExports !== undefined) {
        if (verbose) {
          logger.debug("Restoring original exports field");
        }
        pkg.exports = originalExports;
      }

      // Write back the restored package.json
      await writePackageJSON(resolve(packagePath, "package.json"), pkg);
      if (verbose) {
        logger.debug("Successfully restored original package.json");
      }
    }
  } catch (error) {
    logger.warn(
      `⚠️  Failed to restore original dependencies: ${error instanceof Error ? error.message : String(error)}`,
    );
    if (verbose) {
      logger.debug(
        `Restore error details: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
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
  verbose?: boolean,
): Promise<string | null> {
  try {
    if (verbose) {
      logger.debug(`Resolving workspace version for: ${depName}`);
    }

    // First check bumped versions map (for packages being published in this batch)
    if (bumpedVersions?.has(depName)) {
      const version = bumpedVersions.get(depName) || null;
      if (verbose) {
        logger.debug(`Found ${depName} in bumped versions map: ${version}`);
      }
      return version;
    }

    // Get workspace packages if not provided
    if (!workspacePackages) {
      if (verbose) {
        logger.debug("Workspace packages not provided, discovering...");
      }
      const monorepoRoot = await findMonorepoRoot(packagePath);
      if (!monorepoRoot) {
        if (verbose) {
          logger.debug("Monorepo root not found");
        }
        return null;
      }
      workspacePackages = await getWorkspacePackages(monorepoRoot);
      if (verbose) {
        logger.debug(`Found ${workspacePackages.length} workspace packages`);
      }
    }

    // Find the workspace package by name
    const workspacePkg = workspacePackages.find((pkg) => pkg.name === depName);
    if (workspacePkg?.pkg?.version) {
      if (verbose) {
        logger.debug(
          `Resolved workspace version for ${depName}: ${workspacePkg.pkg.version}`,
        );
      }
      return workspacePkg.pkg.version;
    }

    if (verbose) {
      logger.debug(`Workspace package ${depName} not found or has no version`);
    }
    return null;
  } catch (error) {
    if (verbose) {
      logger.debug(
        `Error resolving workspace version: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return null;
  }
}

/**
 * Resolve catalog dependency to actual version
 */
async function resolveCatalogVersion(
  packagePath: string,
  depName: string,
  verbose?: boolean,
): Promise<string | null> {
  try {
    if (verbose) {
      logger.debug(`Resolving catalog version for: ${depName}`);
    }

    // Go up to 3 levels to find monorepo root
    const possibleRoots = [
      resolve(packagePath, ".."),
      resolve(packagePath, "..", ".."),
      resolve(packagePath, "..", "..", ".."),
    ];

    if (verbose) {
      logger.debug(`Checking ${possibleRoots.length} possible root paths`);
    }

    for (const possibleRoot of possibleRoots) {
      try {
        if (verbose) {
          logger.debug(`Checking root path: ${possibleRoot}`);
        }
        const rootPkg = await readPackageJSON(possibleRoot);
        if (rootPkg && rootPkg.workspaces) {
          // Handle both array format and object format for workspaces
          const workspaces = rootPkg.workspaces;
          if (
            typeof workspaces === "object" &&
            workspaces !== null &&
            "catalog" in workspaces
          ) {
            const catalog = (workspaces as any).catalog;
            if (catalog && typeof catalog === "object") {
              const catalogVersion = catalog[depName];
              if (catalogVersion) {
                if (verbose) {
                  logger.debug(
                    `Resolved catalog version for ${depName}: ${catalogVersion}`,
                  );
                }
                return catalogVersion;
              } else if (verbose) {
                logger.debug(`Catalog found but ${depName} not in catalog`);
              }
            }
          }
        }
      } catch (error) {
        if (verbose) {
          logger.debug(
            `Error checking root ${possibleRoot}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        // Continue to next path
      }
    }

    if (verbose) {
      logger.debug(`Catalog version for ${depName} not found`);
    }
    return null;
  } catch (error) {
    if (verbose) {
      logger.debug(
        `Error resolving catalog version: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
  originalExports?: any;
}> {
  try {
    if (options.verbose) {
      logger.debug(`Preparing package for publishing: ${packagePath}`);
    }

    const pkg = await readPackageJSON(packagePath);
    if (!pkg) {
      if (options.verbose) {
        logger.debug("Failed to read package.json");
      }
      return { success: false, error: "Could not read package.json" };
    }

    if (options.verbose) {
      logger.debug(`Package name: ${pkg.name}, version: ${pkg.version}`);
    }

    // Create a backup of the original package.json
    const originalPkg = { ...pkg };
    const originalExports = pkg.exports
      ? JSON.parse(JSON.stringify(pkg.exports))
      : undefined;

    if (options.verbose) {
      logger.debug("Created backup of original package.json");
    }

    // Handle version bumping (skip if bumpDisable is true or dry-run is true or shouldBumpVersion is false)
    if (
      shouldBumpVersion &&
      options.bump &&
      !options.bumpDisable &&
      !options.dryRun &&
      pkg.version
    ) {
      if (options.verbose) {
        logger.debug(`Bumping version: ${pkg.version} -> ${options.bump}`);
      }
      const bumpResult = bumpVersion(pkg.version, options.bump);
      if (!bumpResult) {
        if (options.verbose) {
          logger.debug(`Invalid version bump: ${options.bump}`);
        }
        return {
          success: false,
          error: `Invalid version bump: ${options.bump}`,
        };
      }
      if (options.verbose) {
        logger.log(
          `  Bumping version from ${pkg.version} to ${bumpResult.bumped} (${options.bump})`,
        );
      }
      pkg.version = bumpResult.bumped;
    } else if (options.verbose) {
      logger.debug(
        `Skipping version bump: shouldBumpVersion=${shouldBumpVersion}, bump=${options.bump}, bumpDisable=${options.bumpDisable}, dryRun=${options.dryRun}`,
      );
    }

    // Add publishConfig with access level
    if (!pkg.publishConfig) {
      pkg.publishConfig = {};
      if (options.verbose) {
        logger.debug("Created publishConfig object");
      }
    }
    pkg.publishConfig.access = options.access || "public";
    if (options.verbose) {
      logger.debug(`Set publishConfig.access: ${pkg.publishConfig.access}`);
    }

    // Store original dependencies for restoration (only if they exist and have content)
    const originalDependencies =
      pkg.dependencies && Object.keys(pkg.dependencies).length > 0
        ? { ...pkg.dependencies }
        : undefined;
    const originalDevDependencies =
      pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0
        ? { ...pkg.devDependencies }
        : undefined;
    const originalScripts =
      pkg.scripts && Object.keys(pkg.scripts).length > 0
        ? { ...pkg.scripts }
        : undefined;

    if (options.verbose) {
      logger.debug(
        `Stored originals: ${originalDependencies ? Object.keys(originalDependencies).length : 0} deps, ${originalDevDependencies ? Object.keys(originalDevDependencies).length : 0} devDeps, ${originalScripts ? Object.keys(originalScripts).length : 0} scripts`,
      );
    }

    // Remove devDependencies for publishing (they shouldn't go to npm)
    delete pkg.devDependencies;

    // Remove scripts for publishing (they shouldn't go to npm)
    delete pkg.scripts;

    if (options.verbose) {
      logger.debug("Removed devDependencies and scripts for publishing");
    }

    // Resolve workspace and catalog dependencies to actual versions
    if (pkg.dependencies) {
      const depCount = Object.keys(pkg.dependencies).length;
      if (options.verbose) {
        logger.debug(`Resolving ${depCount} dependencies`);
      }

      for (const [depName, version] of Object.entries(pkg.dependencies)) {
        if (typeof version === "string") {
          if (version.startsWith("workspace:")) {
            // Resolve workspace dependency to actual version
            const workspaceVersion = await resolveWorkspaceVersion(
              packagePath,
              depName,
              workspacePackages,
              bumpedVersions,
              options.verbose,
            );
            if (workspaceVersion) {
              if (options.verbose) {
                logger.log(
                  `  Resolving workspace dependency ${depName}: ${version} -> ${workspaceVersion}`,
                );
              }
              pkg.dependencies[depName] = workspaceVersion;
            } else {
              // If can't resolve, remove the dependency
              if (options.verbose) {
                logger.warn(
                  `  ⚠️  Cannot resolve workspace dependency ${depName}, removing it`,
                );
              }
              delete pkg.dependencies[depName];
            }
          } else if (version === "catalog:") {
            // Resolve catalog dependency to actual version
            const catalogVersion = await resolveCatalogVersion(
              packagePath,
              depName,
              options.verbose,
            );
            if (catalogVersion) {
              if (options.verbose) {
                logger.log(
                  `  Resolving catalog dependency ${depName}: ${version} -> ${catalogVersion}`,
                );
              }
              pkg.dependencies[depName] = catalogVersion;
            } else {
              // If can't resolve, remove the dependency
              if (options.verbose) {
                logger.warn(
                  `  ⚠️  Cannot resolve catalog dependency ${depName}, removing it`,
                );
              }
              delete pkg.dependencies[depName];
            }
          }
        }
      }

      if (options.verbose) {
        logger.debug(
          `After resolution: ${Object.keys(pkg.dependencies).length} dependencies remaining`,
        );
      }
    }

    // Transform exports from src/*.ts to dist/*.js for publishing
    if (pkg.exports) {
      if (options.verbose) {
        logger.debug("Transforming exports field for publishing");
      }
      pkg.exports = transformExportsForBuild(pkg.exports);
    }

    // Write modified package.json back to root
    await writePackageJSON(resolve(packagePath, "package.json"), pkg);

    if (options.verbose) {
      logger.debug("Successfully wrote modified package.json");
    }

    return {
      success: true,
      version: pkg.version,
      originalPkg,
      originalDependencies,
      originalDevDependencies,
      originalScripts,
      originalExports,
    };
  } catch (error) {
    if (options.verbose) {
      logger.debug(
        `Error preparing package: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
  if (options.verbose) {
    logger.debug(`Starting publish for package at: ${packagePath}`);
  }

  // Read package name from root for initial validation
  const rootPkg = await readPackageJSON(packagePath);
  const rootPackageName = rootPkg?.name || "unknown";

  if (options.verbose) {
    logger.debug(`Package name: ${rootPackageName}`);
    logger.debug(`Publish options: ${JSON.stringify(options, null, 2)}`);
  }

  let originalDependencies: any = null;
  let originalDevDependencies: any = null;
  let originalScripts: any = null;
  let originalExports: any = null;

  // Fetch workspace packages once for efficient dependency resolution
  let workspacePackages:
    | Array<{ name: string; path: string; pkg: any }>
    | undefined;
  let monorepoRoot: string | null = null;
  try {
    if (options.verbose) {
      logger.debug("Discovering monorepo root and workspace packages...");
    }
    monorepoRoot = await findMonorepoRoot(packagePath);
    if (monorepoRoot) {
      if (options.verbose) {
        logger.debug(`Monorepo root: ${monorepoRoot}`);
      }
      workspacePackages = await getWorkspacePackages(monorepoRoot);
      if (options.verbose) {
        logger.log(`  Found ${workspacePackages.length} workspace packages`);
      }
    } else if (options.verbose) {
      logger.debug("Not in a monorepo (no root found)");
    }
  } catch (error) {
    // If we can't fetch workspace packages, we'll continue
    // without them and rely on fallback resolution
    if (options.verbose) {
      logger.debug(
        `Error discovering workspace: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Track files that were copied and need cleanup
  const copiedFiles: string[] = [];

  try {
    // NEVER allow publishing private packages
    if (rootPkg?.private === true) {
      if (options.verbose) {
        logger.debug("Package is private, skipping publish");
      }
      return {
        success: true,
        packageName: rootPackageName,
        packagePath,
        warning: `The package has "private: true", publishing skipped.`,
      };
    }

    // Validate kind-registry combination
    if (options.verbose) {
      logger.debug("Validating kind-registry combination...");
    }
    const validation = validateKindRegistryCombination(
      options.kind,
      options.registry,
      options.verbose,
    );
    if (!validation.valid) {
      if (options.verbose) {
        logger.debug(`Validation failed: ${validation.error}`);
      }
      return {
        success: false,
        packageName: rootPackageName,
        packagePath,
        error: validation.error,
      };
    }

    // Handle "none" registry - silently skip
    if (options.registry === "none") {
      if (options.verbose) {
        logger.debug("Registry is 'none', skipping publish");
      }
      return {
        success: true,
        packageName: rootPackageName,
        packagePath,
        version: (await readPackageJSON(packagePath))?.version,
      };
    }

    // Copy README.md and LICENSE from root if they're missing in package
    if (monorepoRoot) {
      if (options.verbose) {
        logger.debug("Checking for files to copy from monorepo root...");
      }
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
                logger.debug(
                  `Copied ${fileName} from ${sourcePath} to ${targetPath}`,
                );
              }
            } else if (options.verbose) {
              logger.debug(
                `${fileName} already exists in package, skipping copy`,
              );
            }
          } else if (options.verbose) {
            logger.debug(`${fileName} not found in monorepo root`);
          }
        } catch (error) {
          // Skip if can't copy (file doesn't exist or permission error)
          if (options.verbose) {
            logger.debug(
              `Error copying ${fileName}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    }

    // Validate package.json has all required fields
    if (options.verbose) {
      logger.debug("Validating package.json fields...");
    }
    const pkgValidation = validatePackageJsonFields(
      rootPkg,
      rootPackageName,
      options.kind,
      options.verbose,
    );
    if (!pkgValidation.valid) {
      if (options.verbose) {
        logger.debug(
          `Package validation failed with ${pkgValidation.errors.length} error(s)`,
        );
      }
      return {
        success: false,
        packageName: rootPackageName,
        packagePath,
        error: `Package.json validation failed:\n  ${pkgValidation.errors.join("\n  ")}`,
      };
    }

    // Validate dist folder exists
    if (options.verbose) {
      logger.debug("Validating dist folder...");
    }
    const hasDist = await validateDistFolder(packagePath, options.verbose);
    if (!hasDist) {
      if (options.verbose) {
        logger.debug("Dist folder validation failed");
      }
      return {
        success: false,
        packageName: rootPackageName,
        packagePath,
        error: "dist folder not found. Run 'dler build' first.",
      };
    }

    // Prepare package for publishing (modifies root package.json)
    if (options.verbose) {
      logger.debug("Preparing package for publishing...");
    }
    const prepResult = await preparePackageForPublishing(
      packagePath,
      options,
      workspacePackages,
      bumpedVersions,
    );
    if (!prepResult.success) {
      if (options.verbose) {
        logger.debug(`Preparation failed: ${prepResult.error}`);
      }
      return {
        success: false,
        packageName: rootPackageName,
        packagePath,
        error: prepResult.error,
      };
    }

    if (options.verbose) {
      logger.debug(
        `Package prepared successfully, version: ${prepResult.version}`,
      );
    }

    // Store original package and dependencies for potential restoration
    originalDependencies = prepResult.originalDependencies;
    originalDevDependencies = prepResult.originalDevDependencies;
    originalScripts = prepResult.originalScripts;
    originalExports = prepResult.originalExports;

    // Read package metadata from root after preparation
    const rootPackage = await readPackageJSON(packagePath);
    const packageName = rootPackage?.name || rootPackageName;

    // Handle different registries
    const registry = options.registry || "npm";

    if (options.verbose) {
      logger.debug(`Publishing to registry: ${registry}`);
    }

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
      if (options.gzipLevel) {
        args.push("--gzip-level", options.gzipLevel);
      }
      if (options.bunRegistry) {
        args.push("--registry", options.bunRegistry);
      }
      if (options.ca) {
        args.push("--ca", options.ca);
      }
      if (options.cafile) {
        args.push("--cafile", options.cafile);
      }
      if (options.ignoreScripts) {
        args.push("--ignore-scripts");
      }
      if (options.silent) {
        args.push("--silent");
      }
      if (options.noProgress) {
        args.push("--no-progress");
      }
      if (options.noSummary) {
        args.push("--no-summary");
      }

      if (options.verbose) {
        logger.debug(`Bun publish args: ${args.join(" ")}`);
      }

      // Display 2FA tip before first publish when using --with-npm-logs (unless skipped)
      // Only skip if explicitly set to true
      if (
        options.withNpmLogs &&
        options.skipTip2FA !== true &&
        !hasShown2FATip
      ) {
        hasShown2FATip = true;
        logger.log(
          "\n💡 2FA Tip: If you have 2FA enabled on npm and are prompted for a one-time password,\n   check the box 'Do not challenge npm publish operations from your IP address for the next 5 minutes'\n   on the npm login page to avoid repeated authentication prompts during publishing.\n   Use --skip-tip-2fa to skip this message.\n",
        );
        // Wait 3 seconds to give user time to read the message
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      try {
        const result = await runBunPublishCommand(
          packagePath,
          ["bun", ...args],
          options.verbose,
          options.withNpmLogs,
        );

        if (result.exitCode !== 0) {
          // Parse output for error information
          const errorOutput = result.stderr || result.stdout;
          if (options.verbose) {
            logger.debug(
              `Publish command failed with exit code ${result.exitCode}`,
            );
            logger.debug(`Error output: ${errorOutput}`);
          }
          // Check for OTP requirement message
          if (
            THROW_2FA_ERROR &&
            errorOutput.includes("This operation requires a one-time password.")
          ) {
            throw new Error(
              "This operation requires a one-time password. You have 2FA enabled in your npm account. Please set NPM_CONFIG_TOKEN environment variable with your npm token.",
            );
          }
          // Check for OTP input error (when stdin is ignored and bun publish tries to read OTP)
          if (
            errorOutput.includes("failed to read OTP input") ||
            errorOutput.includes("use your security key for authentication")
          ) {
            const hasToken = !!(
              process.env.NPM_CONFIG_TOKEN || process.env.NPM_TOKEN
            );
            if (hasToken) {
              throw new Error(
                "2FA authentication required. NPM_CONFIG_TOKEN is set but authentication failed. Please verify:\n  1. The token is valid and not expired\n  2. The token has publish permissions\n  3. Use --with-npm-logs flag to allow interactive OTP input if token authentication is not working",
              );
            }
            throw new Error(
              "2FA authentication required. The publish command cannot read OTP input when output is captured. Please either:\n  1. Set NPM_CONFIG_TOKEN environment variable with your npm token (note: .env files are not automatically loaded - export it in your shell or use a tool like dotenv-cli), or\n  2. Use --with-npm-logs flag to allow interactive OTP input.",
            );
          }
          throw new Error(
            `Failed to publish ${packageName} (exit code ${result.exitCode}): ${errorOutput}`,
          );
        }

        // Success - parse output for relevant info
        const output = result.stdout || result.stderr;

        if (options.verbose) {
          logger.debug(`Publish command succeeded`);
          logger.debug(`Output length: ${output.length} bytes`);
        }

        // Extract published version if available
        const versionMatch =
          output.match(/published\s+([^\s]+)/i) ||
          output.match(/@([0-9]+\.[0-9]+\.[0-9]+)/);
        const version = versionMatch ? versionMatch[1] : rootPackage?.version;

        if (options.verbose) {
          logger.debug(`Extracted version: ${version ?? "unknown"}`);
        }

        // Display custom log message (npm output is captured internally but never displayed)
        if (options.verbose) {
          logger.log(`✓ Published ${packageName}@${version || "unknown"}`);
        } else {
          // Minimal output in normal mode
          logger.log(
            `✓ Published ${packageName}${version ? `@${version}` : ""}`,
          );
        }
      } catch (error) {
        if (options.verbose) {
          logger.debug(
            `Publish error: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        throw new Error(
          `Failed to publish ${packageName}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (registry === "jsr" || registry === "npm-jsr") {
      // JSR publishing not yet implemented
      if (options.verbose) {
        logger.debug("JSR publishing not implemented, skipping");
      }
      logger.warn(
        `⚠️  JSR publishing not yet implemented for ${packageName}. Skipping JSR publish.`,
      );
    }

    if (registry === "vercel") {
      // Vercel publishing not yet implemented
      if (options.verbose) {
        logger.debug("Vercel publishing not implemented, skipping");
      }
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

    // Restore original dependencies and exports after successful publishing
    if (
      originalDependencies ||
      originalDevDependencies ||
      originalScripts ||
      originalExports
    ) {
      if (options.verbose) {
        logger.debug("Restoring original package.json...");
      }
      await restoreOriginalDependencies(
        packagePath,
        originalDependencies,
        originalDevDependencies,
        originalScripts,
        originalExports,
        options.verbose,
      );
    }

    return {
      success: true,
      packageName,
      packagePath,
      version: rootPackage?.version,
    };
  } catch (error) {
    if (options.verbose) {
      logger.debug(
        `Publish failed with error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Restore original dependencies and exports if they were modified
    // Note: We preserve the bumped version even on error, so users can retry without re-bumping
    if (
      originalDependencies ||
      originalDevDependencies ||
      originalScripts ||
      originalExports
    ) {
      if (options.verbose) {
        logger.debug("Restoring original package.json after error...");
      }
      await restoreOriginalDependencies(
        packagePath,
        originalDependencies,
        originalDevDependencies,
        originalScripts,
        originalExports,
        options.verbose,
      );
    }

    return {
      success: false,
      packageName: rootPackageName,
      packagePath,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Cleanup copied files regardless of success or failure
    if (options.verbose && copiedFiles.length > 0) {
      logger.debug(`Cleaning up ${copiedFiles.length} copied file(s)...`);
    }
    for (const copiedFile of copiedFiles) {
      try {
        await Bun.file(copiedFile).unlink();
        if (options.verbose) {
          const fileName = copiedFile.split(/[/\\]/).pop();
          logger.log(`  Removed copied file: ${fileName}`);
          logger.debug(`Removed copied file: ${copiedFile}`);
        }
      } catch (error) {
        if (options.verbose) {
          logger.debug(
            `Error removing copied file ${copiedFile}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
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
    if (options.verbose) {
      logger.debug(`Starting publishAllPackages, cwd: ${cwd ?? "current"}`);
      logger.debug(
        `Ignore patterns: ${ignore ? (Array.isArray(ignore) ? ignore.join(", ") : ignore) : "none"}`,
      );
    }

    // Load dler.ts configuration
    if (options.verbose) {
      logger.debug("Loading dler.ts configuration...");
    }
    const dlerConfig = await loadDlerConfig(cwd);

    if (options.verbose) {
      logger.debug("Discovering workspace packages...");
    }
    const packages = await getWorkspacePackages(cwd);

    if (options.verbose) {
      logger.debug(`Found ${packages.length} total workspace package(s)`);
    }

    // In single-repo mode, skip filterPackages since ignore would leave nothing to publish
    const isSingleRepo = packages.length === 1 && !ignore;
    const filteredPackages = isSingleRepo
      ? packages
      : filterPackages(packages, ignore);

    if (options.verbose) {
      logger.debug(
        `After filtering: ${filteredPackages.length} package(s) (single-repo mode: ${isSingleRepo})`,
      );
    }

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

    if (options.verbose) {
      logger.debug(`Concurrency: ${concurrency}`);
    }

    // Filter out packages with enable: false before processing
    const packagesToPublish = filteredPackages.filter((pkg) => {
      const packageConfig = getPackagePublishConfig(pkg.name, dlerConfig);
      // Only skip if enable is explicitly set to false
      // undefined means no config exists, so enable by default
      if (packageConfig?.enable === false) {
        if (options.verbose) {
          logger.info(`Skipping ${pkg.name} (disabled in config)`);
          logger.debug(
            `Package config for ${pkg.name}: ${JSON.stringify(packageConfig)}`,
          );
        }
        return false;
      }
      return true;
    });

    if (options.verbose) {
      logger.debug(
        `After enable filter: ${packagesToPublish.length} package(s) enabled`,
      );
    }

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
      const bumpType =
        mergedOptions.bump || (mergedOptions.bumpDisable ? undefined : "patch");

      if (options.verbose) {
        logger.debug(
          `Pre-bumping ${pkg.name}: current=${pkg.pkg.version}, bumpType=${bumpType ?? "none"}, bumpDisable=${mergedOptions.bumpDisable}`,
        );
      }

      if (bumpType && !mergedOptions.bumpDisable && pkg.pkg.version) {
        try {
          const nextVersion = getNextVersion(pkg.pkg.version, bumpType);
          if (nextVersion) {
            bumpedVersions.set(pkg.name, nextVersion);
            if (options.verbose) {
              logger.log(`  ${pkg.name}: ${pkg.pkg.version} -> ${nextVersion}`);
            }
          } else if (options.verbose) {
            logger.debug(`Failed to calculate next version for ${pkg.name}`);
          }
        } catch (error) {
          // Skip if can't bump
          if (options.verbose) {
            logger.debug(
              `Error bumping ${pkg.name}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      } else if (pkg.pkg.version) {
        // If not bumping, use current version
        bumpedVersions.set(pkg.name, pkg.pkg.version);
        if (options.verbose) {
          logger.debug(
            `Using current version for ${pkg.name}: ${pkg.pkg.version}`,
          );
        }
      }
    }

    if (options.verbose) {
      logger.debug(`Pre-bumped ${bumpedVersions.size} package version(s)`);
    }

    // Process packages with controlled concurrency
    const totalBatches = Math.ceil(packagesToPublish.length / concurrency);
    if (options.verbose) {
      logger.debug(
        `Processing ${totalBatches} batch(es) with concurrency ${concurrency}`,
      );
    }

    for (let i = 0; i < packagesToPublish.length; i += concurrency) {
      const batch = packagesToPublish.slice(i, i + concurrency);
      const batchNumber = Math.floor(i / concurrency) + 1;

      if (options.verbose) {
        logger.debug(
          `Processing batch ${batchNumber}/${totalBatches} with ${batch.length} package(s)`,
        );
      }

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

        if (options.verbose) {
          logger.debug(
            `Merged options for ${pkg.name}: ${JSON.stringify(mergedOptions)}`,
          );
        }

        if (mergedOptions.verbose) {
          logger.info(`Publishing ${pkg.name}...`);
        }
        return await publishPackage(pkg.path, mergedOptions, bumpedVersions);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (options.verbose) {
        const batchSuccess = batchResults.filter((r) => r.success).length;
        const batchErrors = batchResults.filter((r) => !r.success).length;
        logger.debug(
          `Batch ${batchNumber} completed: ${batchSuccess} success, ${batchErrors} error(s)`,
        );
      }

      // Stop processing remaining batches if any package in current batch failed
      const hasBatchErrors = batchResults.some((r) => !r.success);
      if (hasBatchErrors) {
        if (options.verbose) {
          logger.debug(
            `Batch ${batchNumber} had errors, stopping processing of remaining batches`,
          );
        }
        break;
      }
    }

    // Count successes, excluding packages that were skipped (private packages)
    const successCount = results.filter(
      (r) => r.success && !r.warning?.includes('"private: true"'),
    ).length;
    const errorCount = results.filter((r) => !r.success).length;
    const warningCount = results.filter((r) => r.warning).length;
    const hasErrors = errorCount > 0;

    if (options.verbose) {
      logger.debug(
        `Publish all completed: ${successCount} success, ${errorCount} error(s), ${warningCount} warning(s)`,
      );
    }

    return {
      results,
      hasErrors,
      successCount,
      errorCount,
      warningCount,
    };
  } catch (error) {
    if (options.verbose) {
      logger.debug(
        `Publish all failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
