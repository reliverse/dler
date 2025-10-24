// apps/dler/src/cmds/tsc/impl.ts

import { existsSync } from "node:fs";
import { cpus } from "node:os";
import { join, resolve } from "node:path";
import { writeErrorLines } from "@reliverse/dler-helpers";
import { logger } from "@reliverse/dler-logger";
import pMap from "@reliverse/dler-mapper";
import { createIgnoreFilter, normalizePatterns } from "@reliverse/dler-matcher";
import {
  getWorkspacePatterns,
  hasWorkspaces,
  readPackageJSON,
} from "@reliverse/dler-pkg-tsc";
import clipboard from "clipboardy";
import { TscCache } from "./cache";
import type { PackageDiscoveryResult } from "./types";

const DEFAULT_CONCURRENCY = Math.max(4, cpus().length);
const DISCOVERY_CONCURRENCY = 10;

// ============================================================================
// Types
// ============================================================================

export interface PackageInfo {
  name: string;
  path: string;
  hasTsConfig: boolean;
}

interface TscResult {
  package: PackageInfo;
  success: boolean;
  skipped: boolean;
  cached: boolean;
  totalErrors: number;
  totalWarnings: number;
  filteredErrors: number;
  filteredWarnings: number;
  output: string;
  filteredOutput: string;
  executionTime: number;
}

interface TscSummary {
  totalPackages: number;
  failedPackages: number;
  successfulPackages: number;
  skippedPackages: number;
  totalErrors: number;
  totalWarnings: number;
  hasErrors: boolean;
  results: TscResult[];
}

interface TscOptions {
  concurrency?: number;
  stopOnError?: boolean;
  verbose?: boolean;
  copyLogs?: boolean;
  cache?: boolean;
  incremental?: boolean;
  autoConcurrency?: boolean;
  skipUnchanged?: boolean;
  buildMode?: boolean;
}

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ============================================================================
// Constants
// ============================================================================

const TS_ERROR_REGEX = /\([0-9]+,[0-9]+\): (error|warning) TS[0-9]+:/;

// ============================================================================
// Package Discovery
// ============================================================================

const findMonorepoRoot = async (startDir?: string): Promise<string | null> => {
  let currentDir = resolve(startDir ?? process.cwd());

  while (currentDir !== "/") {
    const pkgPath = join(currentDir, "package.json");

    if (existsSync(pkgPath)) {
      const pkg = await readPackageJSON(currentDir);

      if (pkg && hasWorkspaces(pkg)) {
        return currentDir;
      }
    }

    const parentDir = resolve(currentDir, "..");
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return null;
};

const resolvePackageInfo = async (
  packagePath: string,
): Promise<PackageInfo | null> => {
  const pkgJsonPath = join(packagePath, "package.json");
  const tsConfigPath = join(packagePath, "tsconfig.json");

  // Early skip if no package.json
  if (!existsSync(pkgJsonPath)) {
    return null;
  }

  // Early skip if no tsconfig.json (cheaper check first)
  if (!existsSync(tsConfigPath)) {
    return null;
  }

  try {
    const pkg = await readPackageJSON(packagePath);

    if (!pkg?.name) {
      return null;
    }

    return {
      name: pkg.name,
      path: packagePath,
      hasTsConfig: true, // We already checked this above
    };
  } catch {
    return null;
  }
};

const getWorkspacePackages = async (
  cwd?: string,
): Promise<PackageDiscoveryResult> => {
  const startTime = Date.now();
  const monorepoRoot = await findMonorepoRoot(cwd);

  if (!monorepoRoot) {
    throw new Error(
      "❌ No monorepo found. Ensure package.json has 'workspaces' field.",
    );
  }

  const rootPkg = await readPackageJSON(monorepoRoot);
  if (!rootPkg) {
    throw new Error("❌ Could not read root package.json");
  }

  const patterns = getWorkspacePatterns(rootPkg);

  if (!patterns.length) {
    throw new Error("❌ No workspace patterns found in package.json");
  }

  // Collect all potential package paths first
  const allPackagePaths: string[] = [];
  const seenPaths = new Set<string>();

  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    const matches = glob.scanSync({ cwd: monorepoRoot, onlyFiles: false });

    for (const match of matches) {
      const packagePath = resolve(monorepoRoot, match);

      if (seenPaths.has(packagePath)) continue;
      seenPaths.add(packagePath);
      allPackagePaths.push(packagePath);
    }
  }

  // Resolve package info in parallel
  const packageResults = await pMap(
    allPackagePaths,
    async (packagePath) => {
      const pkgInfo = await resolvePackageInfo(packagePath);
      return { packagePath, pkgInfo };
    },
    { concurrency: DISCOVERY_CONCURRENCY },
  );

  const packages = packageResults
    .filter((result) => result.pkgInfo !== null)
    .map((result) => result.pkgInfo!);

  const discoveryTime = Date.now() - startTime;

  return {
    packages,
    discoveryTime,
    cacheHits: 0, // Will be updated by cache layer
    cacheMisses: packages.length,
  };
};

// ============================================================================
// Package Filtering
// ============================================================================

const filterPackages = (
  packages: PackageInfo[],
  ignore?: string | string[],
): PackageInfo[] => {
  // Always ignore @reliverse/dler-v1 package
  const alwaysIgnored = ["@reliverse/dler-v1"];

  // Combine user-provided ignore patterns with always ignored packages
  const combinedIgnore = ignore
    ? Array.isArray(ignore)
      ? [...alwaysIgnored, ...ignore]
      : [...alwaysIgnored, ignore]
    : alwaysIgnored;

  const ignoreFilter = createIgnoreFilter(combinedIgnore);
  return ignoreFilter(packages);
};

// ============================================================================
// TypeScript Execution
// ============================================================================

const hasProjectReferences = async (packagePath: string): Promise<boolean> => {
  try {
    const tsConfigPath = join(packagePath, "tsconfig.json");
    if (!existsSync(tsConfigPath)) return false;

    const content = await Bun.file(tsConfigPath).text();
    const config = JSON.parse(content);
    return !!(
      config.references &&
      Array.isArray(config.references) &&
      config.references.length > 0
    );
  } catch {
    return false;
  }
};

const runTscCommand = async (
  packagePath: string,
  options: { incremental?: boolean; buildMode?: boolean } = {},
): Promise<SpawnResult> => {
  try {
    const { incremental = true, buildMode = false } = options;

    let args: string[];

    if (buildMode && (await hasProjectReferences(packagePath))) {
      // Use tsc --build for project references (faster for multi-package setups)
      args = ["tsc", "--build"];
      if (incremental) {
        args.push("--incremental");
      }
    } else {
      // Use regular tsc --noEmit for single packages
      args = ["tsc", "--noEmit"];
      if (incremental) {
        args.push("--incremental");
        // Add tsbuildinfo file path for incremental compilation
        const tsBuildInfoPath = join(
          packagePath,
          "node_modules/.cache/dler-tsc",
          `${packagePath.split(/[/\\]/).pop()}.tsbuildinfo`,
        );
        args.push("--tsBuildInfoFile", tsBuildInfoPath);
      }
    }

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
      `Failed to spawn tsc: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

// ============================================================================
// Output Filtering
// ============================================================================

const countErrorsAndWarnings = (
  output: string,
): { errors: number; warnings: number } => {
  const lines = output.split("\n");
  let errors = 0;
  let warnings = 0;

  for (const line of lines) {
    if (TS_ERROR_REGEX.test(line)) {
      if (line.includes(": error TS")) {
        errors++;
      } else if (line.includes(": warning TS")) {
        warnings++;
      }
    }
  }

  return { errors, warnings };
};

const filterOutputLines = (output: string, packagePath: string): string => {
  const lines = output.split("\n");
  const filtered: string[] = [];
  const normalizedPackagePath = resolve(packagePath);

  for (const line of lines) {
    // Keep non-error lines
    if (!TS_ERROR_REGEX.test(line)) {
      filtered.push(line);
      continue;
    }

    // Check if error is from another package
    const isCrossPackageError = line.includes("../") || line.includes("..\\");

    if (isCrossPackageError) {
      // Extract file path from error line
      const match = line.match(/^(.+?)\(/);

      if (match && match[1]) {
        const filePath = resolve(packagePath, match[1]);
        const normalizedFilePath = resolve(filePath);

        // Only include if file is within current package
        if (normalizedFilePath.startsWith(normalizedPackagePath)) {
          filtered.push(line);
        }
      }
    } else {
      filtered.push(line);
    }
  }

  return filtered.join("\n");
};

// ============================================================================
// Package Processing
// ============================================================================

const runTscOnPackage = async (
  pkg: PackageInfo,
  options: {
    verbose?: boolean;
    cache?: TscCache;
    incremental?: boolean;
    buildMode?: boolean;
  } = {},
): Promise<TscResult> => {
  const {
    verbose = false,
    cache,
    incremental = true,
    buildMode = false,
  } = options;
  const startTime = Date.now();

  if (!pkg.hasTsConfig) {
    if (verbose) {
      logger.info(`⏭️  Skipping ${pkg.name} (no tsconfig.json)`);
    }
    return {
      package: pkg,
      success: true,
      skipped: true,
      cached: false,
      totalErrors: 0,
      totalWarnings: 0,
      filteredErrors: 0,
      filteredWarnings: 0,
      output: "",
      filteredOutput: "",
      executionTime: Date.now() - startTime,
    };
  }

  // Check cache first
  if (cache) {
    const shouldSkip = await cache.shouldSkipPackage(pkg);
    if (shouldSkip) {
      if (verbose) {
        logger.info(`⚡ Skipping ${pkg.name} (no changes since last check)`);
      }
      const cachedResult = await cache.getCachedResult(pkg);
      return {
        package: pkg,
        success: !cachedResult?.hasErrors,
        skipped: false,
        cached: true,
        totalErrors: cachedResult?.errorCount ?? 0,
        totalWarnings: cachedResult?.warningCount ?? 0,
        filteredErrors: cachedResult?.errorCount ?? 0,
        filteredWarnings: cachedResult?.warningCount ?? 0,
        output: cachedResult?.output ?? "Cached result",
        filteredOutput: cachedResult?.filteredOutput ?? "Cached result",
        executionTime: Date.now() - startTime,
      };
    }
  }

  if (verbose) {
    logger.info(`🔍 Checking ${pkg.name}...`);
  }

  try {
    const result = await runTscCommand(pkg.path, { incremental, buildMode });
    const output = result.stdout + result.stderr;
    const filteredOutput = filterOutputLines(output, pkg.path);

    const totalCounts = countErrorsAndWarnings(output);
    const filteredCounts = countErrorsAndWarnings(filteredOutput);

    if (verbose) {
      const status = filteredCounts.errors === 0 ? "✅" : "❌";
      logger.log(
        `${status} ${pkg.name}: ${filteredCounts.errors} errors, ${filteredCounts.warnings} warnings`,
      );
    }

    const tscResult: TscResult = {
      package: pkg,
      success: filteredCounts.errors === 0,
      skipped: false,
      cached: false,
      totalErrors: totalCounts.errors,
      totalWarnings: totalCounts.warnings,
      filteredErrors: filteredCounts.errors,
      filteredWarnings: filteredCounts.warnings,
      output,
      filteredOutput,
      executionTime: Date.now() - startTime,
    };

    // Update cache
    if (cache) {
      await cache.updatePackageCache(pkg, {
        success: tscResult.success,
        errorCount: tscResult.filteredErrors,
        warningCount: tscResult.filteredWarnings,
        output: tscResult.output,
        filteredOutput: tscResult.filteredOutput,
      });
    }

    return tscResult;
  } catch (error) {
    logger.error(
      `❌ ${pkg.name}: Failed to run tsc - ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      package: pkg,
      success: false,
      skipped: false,
      cached: false,
      totalErrors: 1,
      totalWarnings: 0,
      filteredErrors: 1,
      filteredWarnings: 0,
      output: error instanceof Error ? error.message : String(error),
      filteredOutput: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime,
    };
  }
};

// ============================================================================
// Result Collection
// ============================================================================

const collectAllResults = async (
  packages: PackageInfo[],
  options: TscOptions = {},
  cache?: TscCache,
): Promise<TscSummary> => {
  const {
    concurrency = DEFAULT_CONCURRENCY,
    stopOnError = false,
    verbose = false,
    incremental = true,
    buildMode = false,
  } = options;

  // Log progress for package processing
  if (!verbose) {
    logger.info(`Processing ${packages.length} packages...`);
  }

  try {
    const tscResults = await pMap(
      packages,
      async (pkg, index) => {
        if (!verbose) {
          logger.info(
            `Processing ${pkg.name} (${index + 1}/${packages.length})...`,
          );
        }
        return runTscOnPackage(pkg, {
          verbose,
          cache,
          incremental,
          buildMode,
        });
      },
      {
        concurrency,
        stopOnError,
      },
    );

    const failedPackages = tscResults.filter(
      (r) => !r.success && !r.skipped,
    ).length;
    const successfulPackages = tscResults.filter((r) => r.success).length;
    const skippedPackages = tscResults.filter((r) => r.skipped).length;
    const totalErrors = tscResults.reduce(
      (sum, r) => sum + r.filteredErrors,
      0,
    );
    const totalWarnings = tscResults.reduce(
      (sum, r) => sum + r.filteredWarnings,
      0,
    );

    return {
      totalPackages: packages.length,
      failedPackages,
      successfulPackages,
      skippedPackages,
      totalErrors,
      totalWarnings,
      hasErrors: failedPackages > 0,
      results: tscResults,
    };
  } catch (error) {
    // Handle aggregate errors from pMap when stopOnError is false
    if (error instanceof AggregateError) {
      const tscResults: TscResult[] = error.errors.map((err, index) => {
        const pkg = packages[index];
        if (!pkg) {
          throw new Error(`Package at index ${index} not found`);
        }

        if (verbose) {
          logger.error(
            `❌ ${pkg.name}: Aggregate error - ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        return {
          package: pkg,
          success: false,
          skipped: false,
          cached: false,
          totalErrors: 1,
          totalWarnings: 0,
          filteredErrors: 1,
          filteredWarnings: 0,
          output: err instanceof Error ? err.message : String(err),
          filteredOutput: err instanceof Error ? err.message : String(err),
          executionTime: 0,
        };
      });

      const failedPackages = tscResults.filter(
        (r) => !r.success && !r.skipped,
      ).length;
      const successfulPackages = tscResults.filter((r) => r.success).length;
      const skippedPackages = tscResults.filter((r) => r.skipped).length;
      const totalErrors = tscResults.reduce(
        (sum, r) => sum + r.filteredErrors,
        0,
      );
      const totalWarnings = tscResults.reduce(
        (sum, r) => sum + r.filteredWarnings,
        0,
      );

      return {
        totalPackages: packages.length,
        failedPackages,
        successfulPackages,
        skippedPackages,
        totalErrors,
        totalWarnings,
        hasErrors: failedPackages > 0,
        results: tscResults,
      };
    }

    // Re-throw other errors
    throw error;
  }
};

// ============================================================================
// Clipboard Functionality
// ============================================================================

const collectFailedPackageLogs = (summary: TscSummary): string => {
  const failed = summary.results.filter((r) => !r.success && !r.skipped);

  if (failed.length === 0) {
    return "";
  }

  const logs: string[] = [];
  logs.push(
    "I received the following TypeScript errors (please analyse the related code for each and correct them):",
  );
  logs.push("```");
  logs.push("TypeScript Check (bun dler tsc)");
  logs.push("");

  for (const result of failed) {
    logs.push(`📦 ${result.package.name}`);
    logs.push(
      `   Errors: ${result.filteredErrors}, Warnings: ${result.filteredWarnings}`,
    );
    logs.push("   " + "─".repeat(30));

    if (result.filteredOutput.trim()) {
      const lines = result.filteredOutput
        .trim()
        .split("\n")
        .map((line) => `   ${line}`);
      logs.push(...lines);
    }

    logs.push("```");
    logs.push("");
    logs.push("");
  }

  return logs.join("\n");
};

const copyLogsToClipboard = async (summary: TscSummary): Promise<void> => {
  try {
    const logs = collectFailedPackageLogs(summary);

    if (!logs) {
      logger.info("ℹ️  No failed packages to copy to clipboard");
      return;
    }

    await clipboard.write(logs);
    logger.success("📋 Failed package logs copied to clipboard!");
  } catch (error) {
    logger.error("❌ Failed to copy logs to clipboard:");
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error(String(error));
    }
  }
};

// ============================================================================
// Output Formatting
// ============================================================================

const formatOutput = (summary: TscSummary, verbose: boolean): void => {
  const { totalPackages, failedPackages, successfulPackages, skippedPackages } =
    summary;

  // Summary header
  logger.log("━".repeat(60));
  logger.log(`📊 TypeScript Check Summary:`);
  logger.log(`   Total packages: ${totalPackages}`);
  logger.log(`   ✅ Passed: ${successfulPackages}`);
  logger.log(`   ❌ Failed: ${failedPackages}`);
  logger.log(`   ⏭️  Skipped: ${skippedPackages}`);
  logger.log(`   🐛 Total errors: ${summary.totalErrors}`);
  logger.log(`   ⚠️  Total warnings: ${summary.totalWarnings}`);
  logger.log("━".repeat(60));

  // Failed packages
  const failed = summary.results.filter((r) => !r.success && !r.skipped);

  if (failed.length > 0) {
    logger.error("\n❌ Failed Packages:\n");

    for (const result of failed) {
      logger.error(`📦 ${result.package.name}`);
      logger.error(
        `   Errors: ${result.filteredErrors}, Warnings: ${result.filteredWarnings}`,
      );

      if (result.filteredOutput.trim()) {
        logger.error("   ─".repeat(30));
        const lines = result.filteredOutput
          .trim()
          .split("\n")
          .map((line) => `   ${line}`);
        writeErrorLines(lines);
        logger.error("");
      }
    }
  }

  if (verbose) {
    // Successful packages
    const successful = summary.results.filter((r) => r.success && !r.skipped);

    if (successful.length > 0) {
      logger.success("\n✅ Successful Packages:\n");
      for (const result of successful) {
        logger.success(`   • ${result.package.name}`);
      }
    }

    // Skipped packages
    const skipped = summary.results.filter((r) => r.skipped);

    if (skipped.length > 0) {
      logger.info("\n⏭️  Skipped Packages (no tsconfig.json):\n");
      for (const result of skipped) {
        logger.info(`   • ${result.package.name}`);
      }
    }

    logger.log("");
  }
};

// ============================================================================
// Main Entry Point
// ============================================================================

export const runTscOnAllPackages = async (
  ignore?: string | string[],
  cwd?: string,
  options: TscOptions = {},
): Promise<TscSummary> => {
  const {
    verbose = false,
    copyLogs = false,
    cache: enableCache = true,
    autoConcurrency = false,
  } = options;

  return (async () => {
    // Initialize cache
    const cache = enableCache ? new TscCache() : undefined;
    if (cache) {
      await cache.initialize();
    }

    // Discover packages with timing
    const discoveryResult = await getWorkspacePackages(cwd);
    const { packages: allPackages, discoveryTime } = discoveryResult;

    if (verbose) {
      logger.info(
        `   Found ${allPackages.length} packages (${discoveryTime}ms)`,
      );
      logger.info("   Packages found:");
      for (const pkg of allPackages) {
        const configStatus = pkg.hasTsConfig ? "✅" : "⏭️";
        logger.info(`     ${configStatus} ${pkg.name} (${pkg.path})`);
      }
      logger.info("");
    }

    // Apply filters
    const packages = filterPackages(allPackages, ignore);
    const ignoredCount = allPackages.length - packages.length;

    if (ignoredCount > 0) {
      // Always ignore @reliverse/dler-v1 package
      const alwaysIgnored = ["@reliverse/dler-v1"];
      const combinedIgnore = ignore
        ? Array.isArray(ignore)
          ? [...alwaysIgnored, ...ignore]
          : [...alwaysIgnored, ignore]
        : alwaysIgnored;

      const patterns = normalizePatterns(combinedIgnore);
      logger.info(
        `   Ignoring ${ignoredCount} packages matching: ${patterns.join(", ")}`,
      );
    }

    // Auto-detect concurrency if requested
    let concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    if (autoConcurrency) {
      concurrency = Math.max(4, cpus().length * 2);
    }

    const { stopOnError = false } = options;
    logger.info(
      `   Checking ${packages.length} packages (concurrency: ${concurrency}, stopOnError: ${stopOnError})...\n`,
    );

    if (verbose) {
      logger.info("🚀 Starting TypeScript checks...\n");
    }

    const summary = await collectAllResults(packages, options, cache);

    // Display results
    formatOutput(summary, verbose);

    // Copy logs to clipboard if requested and there are errors
    if (copyLogs && summary.hasErrors) {
      await copyLogsToClipboard(summary);
    }

    return summary;
  })();
};
