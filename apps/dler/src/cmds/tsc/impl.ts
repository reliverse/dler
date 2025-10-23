// apps/dler/src/cmds/tsc/impl.ts

import { existsSync } from "node:fs";
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
import {
  createMultiStepSpinner,
  createSpinner,
  withSpinner,
} from "@reliverse/dler-spinner";

const DEFAULT_CONCURRENCY = 5;

// ============================================================================
// Types
// ============================================================================

interface PackageInfo {
  name: string;
  path: string;
  hasTsConfig: boolean;
}

interface TscResult {
  package: PackageInfo;
  success: boolean;
  skipped: boolean;
  totalErrors: number;
  totalWarnings: number;
  filteredErrors: number;
  filteredWarnings: number;
  output: string;
  filteredOutput: string;
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

  if (!existsSync(pkgJsonPath)) {
    return null;
  }

  try {
    const pkg = await readPackageJSON(packagePath);

    if (!pkg?.name) {
      return null;
    }

    const hasTsConfig = existsSync(join(packagePath, "tsconfig.json"));

    return {
      name: pkg.name,
      path: packagePath,
      hasTsConfig,
    };
  } catch {
    return null;
  }
};

const getWorkspacePackages = async (cwd?: string): Promise<PackageInfo[]> => {
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

  const packages: PackageInfo[] = [];
  const seenPaths = new Set<string>();

  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    const matches = glob.scanSync({ cwd: monorepoRoot, onlyFiles: false });

    for (const match of matches) {
      const packagePath = resolve(monorepoRoot, match);

      if (seenPaths.has(packagePath)) continue;
      seenPaths.add(packagePath);

      const pkgInfo = await resolvePackageInfo(packagePath);

      if (pkgInfo) {
        packages.push(pkgInfo);
      }
    }
  }

  return packages;
};

// ============================================================================
// Package Filtering
// ============================================================================

const filterPackages = (
  packages: PackageInfo[],
  ignore?: string | string[],
): PackageInfo[] => {
  if (!ignore) {
    return packages;
  }

  const ignoreFilter = createIgnoreFilter(ignore);
  return ignoreFilter(packages);
};

// ============================================================================
// TypeScript Execution
// ============================================================================

const runTscCommand = async (packagePath: string): Promise<SpawnResult> => {
  try {
    const proc = Bun.spawn(["tsc", "--noEmit"], {
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
  verbose = false,
): Promise<TscResult> => {
  if (!pkg.hasTsConfig) {
    if (verbose) {
      logger.info(`⏭️  Skipping ${pkg.name} (no tsconfig.json)`);
    }
    return {
      package: pkg,
      success: true,
      skipped: true,
      totalErrors: 0,
      totalWarnings: 0,
      filteredErrors: 0,
      filteredWarnings: 0,
      output: "",
      filteredOutput: "",
    };
  }

  if (verbose) {
    logger.info(`🔍 Checking ${pkg.name}...`);
  }

  try {
    const result = await runTscCommand(pkg.path);
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

    return {
      package: pkg,
      success: filteredCounts.errors === 0,
      skipped: false,
      totalErrors: totalCounts.errors,
      totalWarnings: totalCounts.warnings,
      filteredErrors: filteredCounts.errors,
      filteredWarnings: filteredCounts.warnings,
      output,
      filteredOutput,
    };
  } catch (error) {
    logger.error(
      `❌ ${pkg.name}: Failed to run tsc - ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      package: pkg,
      success: false,
      skipped: false,
      totalErrors: 1,
      totalWarnings: 0,
      filteredErrors: 1,
      filteredWarnings: 0,
      output: error instanceof Error ? error.message : String(error),
      filteredOutput: error instanceof Error ? error.message : String(error),
    };
  }
};

// ============================================================================
// Result Collection
// ============================================================================

const collectAllResults = async (
  packages: PackageInfo[],
  options: TscOptions = {},
): Promise<TscSummary> => {
  const {
    concurrency = DEFAULT_CONCURRENCY,
    stopOnError = false,
    verbose = false,
  } = options;

  // Create progress spinner for package processing
  const progressSpinner = createSpinner({
    text: `Processing ${packages.length} packages...`,
    color: "cyan",
    spinner: "dots",
  });

  if (!verbose) {
    progressSpinner.start();
  }

  try {
    const tscResults = await pMap(
      packages,
      async (pkg, index) => {
        if (!verbose) {
          progressSpinner.text = `Processing ${pkg.name} (${index + 1}/${packages.length})...`;
        }
        return runTscOnPackage(pkg, verbose);
      },
      {
        concurrency,
        stopOnError,
      },
    );

    if (!verbose) {
      progressSpinner.stop();
    }

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
    if (!verbose) {
      progressSpinner.stop();
    }

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
          totalErrors: 1,
          totalWarnings: 0,
          filteredErrors: 1,
          filteredWarnings: 0,
          output: err instanceof Error ? err.message : String(err),
          filteredOutput: err instanceof Error ? err.message : String(err),
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
  const { verbose = false } = options;

  return withSpinner(
    {
      text: "🔍 Discovering workspace packages...",
      color: "cyan",
      spinner: "dots",
    },
    async (spinner) => {
      // Discover packages
      const allPackages = await getWorkspacePackages(cwd);

      if (verbose) {
        spinner.text = `   Found ${allPackages.length} packages`;
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
        const patterns = normalizePatterns(ignore!);
        logger.info(
          `   Ignoring ${ignoredCount} packages matching: ${patterns.join(", ")}`,
        );
      }

      const { concurrency = DEFAULT_CONCURRENCY, stopOnError = false } =
        options;
      logger.info(
        `   Checking ${packages.length} packages (concurrency: ${concurrency}, stopOnError: ${stopOnError})...\n`,
      );

      // Create multi-step spinner for TypeScript checks
      const steps = [
        "Initializing TypeScript checks",
        "Running type checking on packages",
        "Processing results",
        "Generating summary",
      ];

      const multiStepSpinner = createMultiStepSpinner(
        "TypeScript Check",
        steps,
        {
          color: "cyan",
          spinner: "dots",
        },
      );

      try {
        // Step 1: Initialize
        multiStepSpinner.nextStep(0);

        if (verbose) {
          logger.info("🚀 Starting TypeScript checks...\n");
        }

        // Step 2: Run TypeScript checks
        multiStepSpinner.nextStep(1);
        const summary = await collectAllResults(packages, options);

        // Step 3: Process results
        multiStepSpinner.nextStep(2);

        // Step 4: Generate summary
        multiStepSpinner.nextStep(3);

        // Display results
        formatOutput(summary, verbose);

        // Complete with success
        multiStepSpinner.complete(
          `TypeScript check completed - ${summary.successfulPackages}/${summary.totalPackages} packages passed`,
        );

        return summary;
      } catch (error) {
        multiStepSpinner.error(
          error instanceof Error ? error : new Error(String(error)),
        );
        throw error;
      }
    },
    verbose ? "✅ Workspace packages discovered successfully" : undefined,
    "❌ Failed to discover workspace packages",
  );
};
