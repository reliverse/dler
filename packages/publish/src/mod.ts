import { resolve } from "node:path";
import { type BumpType, bumpVersion } from "@reliverse/dler-bump";
import {
  filterPackages as filterPackagesFromConfig,
  getWorkspacePackages as getWorkspacePackagesFromConfig,
  loadDlerConfig,
  mergePublishOptions,
} from "@reliverse/dler-config";
import { logger } from "@reliverse/dler-logger";
import { readPackageJSON, writePackageJSON } from "@reliverse/dler-pkg-tsc";
import { $ } from "bun";

export interface PublishConfig {
  // Global publish configuration
  global?: {
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
  };
  // Per-package publish configurations
  packages?: Record<
    string,
    {
      dryRun?: boolean;
      tag?: string;
      access?: "public" | "restricted";
      otp?: string;
      authType?: "web" | "legacy";
      verbose?: boolean;
      bump?:
        | "major"
        | "minor"
        | "patch"
        | "premajor"
        | "preminor"
        | "prepatch"
        | "prerelease";
    }
  >;
  // Package patterns for applying configs
  patterns?: Array<{
    pattern: string;
    config: {
      dryRun?: boolean;
      tag?: string;
      access?: "public" | "restricted";
      otp?: string;
      authType?: "web" | "legacy";
      verbose?: boolean;
      bump?:
        | "major"
        | "minor"
        | "patch"
        | "premajor"
        | "preminor"
        | "prepatch"
        | "prerelease";
    };
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
  concurrency?: number;
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
 * Modify package.json for publishing
 */
async function preparePackageForPublishing(
  packagePath: string,
  options: PublishOptions,
): Promise<{ success: boolean; version?: string; error?: string }> {
  try {
    const pkg = await readPackageJSON(packagePath);
    if (!pkg) {
      return { success: false, error: "Could not read package.json" };
    }

    // Create a copy for modification
    const modifiedPkg = { ...pkg };

    // Handle version bumping
    if (options.bump && pkg.version) {
      const bumpResult = bumpVersion(pkg.version, options.bump);
      if (!bumpResult) {
        return {
          success: false,
          error: `Invalid version bump: ${options.bump}`,
        };
      }
      modifiedPkg.version = bumpResult.bumped;
    }

    // Strip workspace protocols from dependencies
    if (modifiedPkg.dependencies) {
      for (const [, version] of Object.entries(modifiedPkg.dependencies)) {
        if (typeof version === "string" && version.startsWith("workspace:")) {
          // For now, we'll keep workspace deps as-is since we don't have version resolution
          // In a real implementation, you'd resolve these to actual versions
        }
      }
    }

    // Write modified package.json to dist folder
    const distPath = resolve(packagePath, "dist");
    await writePackageJSON(resolve(distPath, "package.json"), modifiedPkg);

    return { success: true, version: modifiedPkg.version };
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
  const packageName = (await readPackageJSON(packagePath))?.name || "unknown";

  try {
    // Validate dist folder exists
    const hasDist = await validateDistFolder(packagePath);
    if (!hasDist) {
      return {
        success: false,
        packageName,
        packagePath,
        error: "dist folder not found. Run 'dler build' first.",
      };
    }

    // Prepare package for publishing
    const prepResult = await preparePackageForPublishing(packagePath, options);
    if (!prepResult.success) {
      return {
        success: false,
        packageName,
        packagePath,
        error: prepResult.error,
      };
    }

    // Build bun publish command
    const distPath = resolve(packagePath, "dist");
    const args: string[] = ["publish", distPath];

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

    // Execute bun publish
    await $`bun ${args.join(" ")}`.cwd(packagePath).quiet();

    return {
      success: true,
      packageName,
      packagePath,
      version: prepResult.version,
    };
  } catch (error) {
    return {
      success: false,
      packageName,
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

    // Process packages with controlled concurrency
    for (let i = 0; i < filteredPackages.length; i += concurrency) {
      const batch = filteredPackages.slice(i, i + concurrency);

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
