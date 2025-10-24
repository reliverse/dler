// apps/dler/src/cmds/clean/impl.ts

import { existsSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { logger } from "@reliverse/dler-logger";
import pMap from "@reliverse/dler-mapper";
import { createIgnoreFilter, normalizePatterns } from "@reliverse/dler-matcher";
import {
  getWorkspacePatterns,
  hasWorkspaces,
  readPackageJSON,
} from "@reliverse/dler-pkg-tsc";
import { confirmPrompt } from "@reliverse/dler-prompt";
import {
  LOCK_FILE_PATTERNS,
  mergePatterns,
  parseCustomPatterns,
  parsePresets,
  validatePatterns,
} from "./presets";
import type {
  CleanError,
  CleanOptions,
  CleanSummary,
  FileMatch,
  PackageCleanResult,
  PackageInfo,
} from "./types";

const DEFAULT_CONCURRENCY = 5;

// ============================================================================
// Package Discovery
// ============================================================================

const findMonorepoRoot = async (
  startDir?: string,
  useCwd = false,
): Promise<string | null> => {
  let currentDir = resolve(startDir ?? process.cwd());

  // If useCwd is true, only check the specified directory, don't search up
  if (useCwd) {
    const pkgPath = join(currentDir, "package.json");

    if (existsSync(pkgPath)) {
      const pkg = await readPackageJSON(currentDir);

      if (pkg && hasWorkspaces(pkg)) {
        return currentDir;
      }
    }

    return null;
  }

  // Original behavior: search up the directory tree
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
  isRoot = false,
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

    return {
      name: pkg.name,
      path: packagePath,
      isRoot,
    };
  } catch {
    return null;
  }
};

const getWorkspacePackages = async (
  cwd?: string,
  useCwd = false,
): Promise<PackageInfo[]> => {
  const monorepoRoot = await findMonorepoRoot(cwd, useCwd);

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

      const pkgInfo = await resolvePackageInfo(packagePath, false);

      if (pkgInfo) {
        packages.push(pkgInfo);
      }
    }
  }

  return packages;
};

const getSingleRepoPackages = async (cwd?: string): Promise<PackageInfo[]> => {
  const currentDir = resolve(cwd ?? process.cwd());
  const pkgInfo = await resolvePackageInfo(currentDir, true);

  if (!pkgInfo) {
    throw new Error("❌ No package.json found in current directory");
  }

  return [pkgInfo];
};

// ============================================================================
// File Discovery
// ============================================================================

const calculateSize = (path: string): number => {
  try {
    const stats = statSync(path);
    if (stats.isDirectory()) {
      // For directories, we'll calculate recursively
      return calculateDirectorySize(path);
    }
    return stats.size;
  } catch {
    return 0;
  }
};

const calculateDirectorySize = (dirPath: string): number => {
  try {
    let totalSize = 0;
    const entries =
      existsSync(dirPath) && statSync(dirPath).isDirectory()
        ? Array.from(
            new Bun.Glob("**/*").scanSync({ cwd: dirPath, onlyFiles: true }),
          )
        : [];

    for (const entry of entries) {
      try {
        const fullPath = join(dirPath, entry);
        const stats = statSync(fullPath);
        totalSize += stats.size;
      } catch {
        // Ignore files we can't access
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
};

const isAbsolutePath = (path: string): boolean =>
  path.startsWith("/") || (path.length > 1 && path[1] === ":");

const findMatchingFiles = (
  targetDir: string,
  patterns: string[],
  subdirs = false,
): FileMatch[] => {
  const matches: FileMatch[] = [];
  const searchDirs = subdirs ? [targetDir] : [targetDir];

  for (const pattern of patterns) {
    // Handle absolute paths directly
    if (isAbsolutePath(pattern)) {
      if (existsSync(pattern)) {
        const stats = statSync(pattern);
        const size = calculateSize(pattern);

        matches.push({
          path: pattern,
          size,
          isDirectory: stats.isDirectory(),
          category: getCategoryForPattern(pattern),
        });
      }
      continue;
    }

    // Handle relative patterns with glob
    for (const searchDir of searchDirs) {
      try {
        const glob = new Bun.Glob(pattern);
        const globMatches = glob.scanSync({
          cwd: searchDir,
          onlyFiles: false,
          dot: true, // Include hidden files/directories
        });

        for (const match of globMatches) {
          const fullPath = join(searchDir, match);

          if (existsSync(fullPath)) {
            const stats = statSync(fullPath);
            const size = calculateSize(fullPath);

            matches.push({
              path: fullPath,
              size,
              isDirectory: stats.isDirectory(),
              category: getCategoryForPattern(pattern),
            });
          }
        }
      } catch (error) {
        // Ignore glob errors
        if (process.env.DEBUG) {
          console.warn(`Glob error for pattern ${pattern}:`, error);
        }
      }
    }
  }

  return matches;
};

const getCategoryForPattern = (pattern: string): string => {
  // Map patterns to categories for better organization
  if (pattern.includes("dist")) return "build";
  if (pattern.includes("_generated")) return "db";
  if (pattern.includes(".basehub")) return "cms";
  if (
    pattern.includes(".next") ||
    pattern.includes(".nuxt") ||
    pattern.includes(".expo")
  )
    return "frontend";
  if (pattern.includes(".source")) return "docs";
  if (pattern.includes(".react-email")) return "email";
  if (
    pattern.includes(".turbo") ||
    pattern.includes(".vercel") ||
    pattern.includes(".wrangler")
  )
    return "build-tools";
  if (pattern.includes("node_modules")) return "deps";
  return "other";
};

// ============================================================================
// File Deletion
// ============================================================================

const deleteFile = (filePath: string): CleanError | null => {
  try {
    rmSync(filePath, { recursive: true, force: true });
    return null;
  } catch (error) {
    return {
      path: filePath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const deleteFiles = async (
  files: FileMatch[],
  dryRun = false,
): Promise<{
  deletedCount: number;
  deletedSize: number;
  errors: CleanError[];
}> => {
  if (dryRun) {
    return {
      deletedCount: files.length,
      deletedSize: files.reduce((sum, file) => sum + file.size, 0),
      errors: [],
    };
  }

  let deletedCount = 0;
  let deletedSize = 0;
  const errors: CleanError[] = [];

  for (const file of files) {
    const error = deleteFile(file.path);
    if (error) {
      errors.push(error);
    } else {
      deletedCount++;
      deletedSize += file.size;
    }
  }

  return { deletedCount, deletedSize, errors };
};

// ============================================================================
// Package Processing
// ============================================================================

const discoverPackageFiles = async (
  pkg: PackageInfo,
  patterns: string[],
  options: CleanOptions,
): Promise<PackageCleanResult> => {
  const { subdirs = false, verbose = false } = options;

  if (verbose) {
    logger.info(`🔍 Scanning ${pkg.name}...`);
  }

  const files = findMatchingFiles(pkg.path, patterns, subdirs);

  if (verbose && files.length > 0) {
    logger.info(`   Found ${files.length} files/directories to clean`);
  }

  // During discovery phase, we don't delete files yet
  return {
    package: pkg,
    files,
    deletedCount: 0,
    deletedSize: 0,
    errors: [],
  };
};

const cleanPackage = async (
  pkg: PackageInfo,
  patterns: string[],
  options: CleanOptions,
): Promise<PackageCleanResult> => {
  const { subdirs = false, dryRun = false, verbose = false } = options;

  if (verbose) {
    logger.info(`🔍 Scanning ${pkg.name}...`);
  }

  const files = findMatchingFiles(pkg.path, patterns, subdirs);

  if (verbose && files.length > 0) {
    logger.info(`   Found ${files.length} files/directories to clean`);
  }

  const { deletedCount, deletedSize, errors } = await deleteFiles(
    files,
    dryRun,
  );

  if (verbose) {
    const status = errors.length === 0 ? "✅" : "⚠️";
    logger.log(
      `${status} ${pkg.name}: ${deletedCount} deleted, ${errors.length} errors`,
    );
  }

  return {
    package: pkg,
    files,
    deletedCount,
    deletedSize,
    errors,
  };
};

// ============================================================================
// Lock Files Processing
// ============================================================================

const cleanLockFiles = async (
  rootDir: string,
  deleteLockFiles: boolean,
  dryRun = false,
): Promise<{
  deletedCount: number;
  deletedSize: number;
  errors: CleanError[];
}> => {
  if (!deleteLockFiles) {
    return { deletedCount: 0, deletedSize: 0, errors: [] };
  }

  const lockFiles: FileMatch[] = [];

  for (const pattern of LOCK_FILE_PATTERNS) {
    const fullPath = join(rootDir, pattern);
    if (existsSync(fullPath)) {
      const stats = statSync(fullPath);
      lockFiles.push({
        path: fullPath,
        size: stats.size,
        isDirectory: false,
        category: "deps",
      });
    }
  }

  return deleteFiles(lockFiles, dryRun);
};

// ============================================================================
// Confirmation and Display
// ============================================================================

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const displayPreview = (
  results: PackageCleanResult[],
  lockFilesResult: { deletedCount: number; deletedSize: number },
): void => {
  logger.log("━".repeat(60));
  logger.log("🧹 Clean Preview:");
  logger.log("━".repeat(60));

  let totalFiles = 0;
  let totalSize = 0;

  for (const result of results) {
    if (result.files.length === 0) continue;

    logger.log(
      `\n📦 ${result.package.name}${result.package.isRoot ? " (root)" : ""}:`,
    );

    // Group by category
    const byCategory = result.files.reduce(
      (acc, file) => {
        if (!acc[file.category]) acc[file.category] = [];
        acc[file.category]!.push(file);
        return acc;
      },
      {} as Record<string, FileMatch[]>,
    );

    for (const [category, files] of Object.entries(byCategory)) {
      const categorySize = files.reduce((sum, file) => sum + file.size, 0);
      logger.log(
        `   ${category}: ${files.length} files (${formatBytes(categorySize)})`,
      );

      if (files.length <= 5) {
        for (const file of files) {
          const relativePath = file.path.replace(result.package.path + "/", "");
          logger.log(`     • ${relativePath}`);
        }
      } else {
        logger.log(`     • ... and ${files.length - 5} more files`);
      }
    }

    totalFiles += result.files.length;
    totalSize += result.files.reduce((sum, file) => sum + file.size, 0);
  }

  if (lockFilesResult.deletedCount > 0) {
    logger.log(
      `\n🔒 Lock files: ${lockFilesResult.deletedCount} files (${formatBytes(lockFilesResult.deletedSize)})`,
    );
    totalFiles += lockFilesResult.deletedCount;
    totalSize += lockFilesResult.deletedSize;
  }

  logger.log(`\n📊 Total: ${totalFiles} files (${formatBytes(totalSize)})`);
  logger.log("━".repeat(60));
};

const askConfirmation = async (force: boolean): Promise<boolean> => {
  if (force) {
    return true;
  }

  try {
    return await confirmPrompt("Proceed with deletion?", false);
  } catch {
    // If prompt fails, default to false for safety
    return false;
  }
};

// ============================================================================
// Main Orchestration
// ============================================================================

export const runCleanOnAllPackages = async (
  ignore?: string | string[],
  cwd?: string,
  options: CleanOptions = {},
): Promise<CleanSummary> => {
  const {
    presets: presetsString,
    custom: customString,
    dryRun = false,
    force = false,
    verbose = false,
    deleteLockFiles = false,
  } = options;

  const presets = parsePresets(presetsString);
  const customPatterns = parseCustomPatterns(customString);

  // Validate that at least one pattern source is provided
  validatePatterns(presets, customPatterns);

  const patterns = mergePatterns(presets, customPatterns);

  // Check if we have any absolute paths in custom patterns
  const hasAbsolutePaths = customPatterns.some((pattern) =>
    isAbsolutePath(pattern),
  );

  // Log discovery start
  if (verbose) {
    logger.info("🔍 Discovering files to clean...");
  }

  // Execute the main logic
  const result = await (async () => {
    // If we have only absolute paths and no presets, just clean those directly
    if (
      hasAbsolutePaths &&
      presets.length === 0 &&
      customPatterns.every((pattern) => isAbsolutePath(pattern))
    ) {
      if (verbose) {
        logger.info(`   Processing absolute paths directly`);
      }

      // For absolute paths, we don't need to search in directories
      const files: FileMatch[] = [];
      for (const pattern of patterns) {
        if (isAbsolutePath(pattern) && existsSync(pattern)) {
          const stats = statSync(pattern);
          const size = calculateSize(pattern);
          files.push({
            path: pattern,
            size,
            isDirectory: stats.isDirectory(),
            category: getCategoryForPattern(pattern),
          });
        }
      }

      // Display preview
      displayPreview(
        [
          {
            package: { name: "Absolute paths", path: "", isRoot: true },
            files,
            deletedCount: 0,
            deletedSize: 0,
            errors: [],
          },
        ],
        { deletedCount: 0, deletedSize: 0 },
      );

      if (!dryRun) {
        const shouldProceed = await askConfirmation(force);

        if (!shouldProceed) {
          logger.info("❌ Clean cancelled by user");
          process.exit(0);
        }

        // Delete files
        const { deletedCount, deletedSize, errors } = await deleteFiles(
          files,
          dryRun,
        );

        const summary: CleanSummary = {
          totalPackages: 1,
          processedPackages: 1,
          totalFiles: files.length,
          totalSize: files.reduce((sum, file) => sum + file.size, 0),
          deletedFiles: deletedCount,
          deletedSize: deletedSize,
          errors,
          hasErrors: errors.length > 0,
          results: [
            {
              package: { name: "Absolute paths", path: "", isRoot: true },
              files,
              deletedCount,
              deletedSize,
              errors,
            },
          ],
        };

        // Display final summary
        logger.log("\n" + "━".repeat(60));
        logger.log("📊 Clean Summary:");
        logger.log(
          `   Files ${dryRun ? "would be" : ""} deleted: ${summary.deletedFiles}`,
        );
        logger.log(
          `   Size ${dryRun ? "would be" : ""} freed: ${formatBytes(summary.deletedSize)}`,
        );

        if (summary.hasErrors) {
          logger.log(`   Errors: ${summary.errors.length}`);
          logger.error("\n❌ Errors occurred during cleanup:");
          for (const error of summary.errors) {
            logger.error(`   • ${error.path}: ${error.error}`);
          }
        }

        logger.log("━".repeat(60));

        return summary;
      }

      // If dry run, return early
      if (dryRun) {
        const summary: CleanSummary = {
          totalPackages: 1,
          processedPackages: 1,
          totalFiles: files.length,
          totalSize: files.reduce((sum, file) => sum + file.size, 0),
          deletedFiles: files.length,
          deletedSize: files.reduce((sum, file) => sum + file.size, 0),
          errors: [],
          hasErrors: false,
          results: [
            {
              package: { name: "Absolute paths", path: "", isRoot: true },
              files,
              deletedCount: files.length,
              deletedSize: files.reduce((sum, file) => sum + file.size, 0),
              errors: [],
            },
          ],
        };

        logger.log("\n" + "━".repeat(60));
        logger.log("📊 Clean Summary:");
        logger.log(`   Files would be deleted: ${summary.deletedFiles}`);
        logger.log(
          `   Size would be freed: ${formatBytes(summary.deletedSize)}`,
        );
        logger.log("━".repeat(60));

        return summary;
      }
    }

    // Detect if we're in a monorepo or single repo
    let packages: PackageInfo[];
    let isMonorepo = false;
    const useCwd = !!cwd; // If cwd is provided, don't search up for monorepo root

    try {
      packages = await getWorkspacePackages(cwd, useCwd);
      isMonorepo = true;

      if (verbose) {
        logger.info(`   Found ${packages.length} packages in monorepo`);
      }
    } catch {
      packages = await getSingleRepoPackages(cwd);

      if (verbose) {
        logger.info(`   Single repo mode: ${packages[0]?.name}`);
      }
    }

    // Filter packages if ignore patterns provided
    if (isMonorepo && ignore) {
      const ignoreFilter = createIgnoreFilter(ignore);
      const filteredPackages = ignoreFilter(packages);
      const ignoredCount = packages.length - filteredPackages.length;

      if (ignoredCount > 0) {
        const patterns = normalizePatterns(ignore);
        logger.info(
          `   Ignoring ${ignoredCount} packages matching: ${patterns.join(", ")}`,
        );
      }

      packages = filteredPackages;
    }

    // Discover files
    const results = await pMap(
      packages,
      async (pkg) => discoverPackageFiles(pkg, patterns, options),
      {
        concurrency: DEFAULT_CONCURRENCY,
        stopOnError: false,
      },
    );

    // Clean lock files if requested
    const rootDir = cwd ?? process.cwd();
    const lockFilesResult = await cleanLockFiles(
      rootDir,
      deleteLockFiles,
      dryRun,
    );

    // Display preview
    displayPreview(results, lockFilesResult);

    if (!dryRun) {
      const shouldProceed = await askConfirmation(force);

      if (!shouldProceed) {
        logger.info("❌ Clean cancelled by user");
        process.exit(0);
      }

      // Actually delete files
      const cleanedResults = await pMap(
        packages,
        async (pkg) => cleanPackage(pkg, patterns, options),
        {
          concurrency: DEFAULT_CONCURRENCY,
          stopOnError: false,
        },
      );

      // Clean lock files if requested
      if (deleteLockFiles) {
        await cleanLockFiles(rootDir, true, false);
      }

      // Calculate totals
      const totalFiles =
        cleanedResults.reduce((sum, r) => sum + r.files.length, 0) +
        lockFilesResult.deletedCount;
      const totalSize =
        cleanedResults.reduce(
          (sum, r) => sum + r.files.reduce((s, f) => s + f.size, 0),
          0,
        ) + lockFilesResult.deletedSize;
      const deletedFiles =
        cleanedResults.reduce((sum, r) => sum + r.deletedCount, 0) +
        lockFilesResult.deletedCount;
      const deletedSize =
        cleanedResults.reduce((sum, r) => sum + r.deletedSize, 0) +
        lockFilesResult.deletedSize;
      const allErrors = cleanedResults.flatMap((r) => r.errors);

      const summary: CleanSummary = {
        totalPackages: packages.length,
        processedPackages: cleanedResults.length,
        totalFiles,
        totalSize,
        deletedFiles,
        deletedSize,
        errors: allErrors,
        hasErrors: allErrors.length > 0,
        results: cleanedResults,
      };

      // Display final summary
      logger.log("\n" + "━".repeat(60));
      logger.log("📊 Clean Summary:");
      logger.log(`   Packages processed: ${summary.processedPackages}`);
      logger.log(
        `   Files ${dryRun ? "would be" : ""} deleted: ${summary.deletedFiles}`,
      );
      logger.log(
        `   Size ${dryRun ? "would be" : ""} freed: ${formatBytes(summary.deletedSize)}`,
      );

      if (summary.hasErrors) {
        logger.log(`   Errors: ${summary.errors.length}`);
        logger.error("\n❌ Errors occurred during cleanup:");
        for (const error of summary.errors) {
          logger.error(`   • ${error.path}: ${error.error}`);
        }
      }

      logger.log("━".repeat(60));

      return summary;
    }

    // If dry run, return early
    const totalFiles =
      results.reduce((sum, r) => sum + r.files.length, 0) +
      lockFilesResult.deletedCount;
    const totalSize =
      results.reduce(
        (sum, r) => sum + r.files.reduce((s, f) => s + f.size, 0),
        0,
      ) + lockFilesResult.deletedSize;
    const deletedFiles =
      results.reduce((sum, r) => sum + r.deletedCount, 0) +
      lockFilesResult.deletedCount;
    const deletedSize =
      results.reduce((sum, r) => sum + r.deletedSize, 0) +
      lockFilesResult.deletedSize;
    const allErrors = results.flatMap((r) => r.errors);

    const summary: CleanSummary = {
      totalPackages: packages.length,
      processedPackages: results.length,
      totalFiles,
      totalSize,
      deletedFiles,
      deletedSize,
      errors: allErrors,
      hasErrors: allErrors.length > 0,
      results,
    };

    // Display final summary
    logger.log("\n" + "━".repeat(60));
    logger.log("📊 Clean Summary:");
    logger.log(`   Packages processed: ${summary.processedPackages}`);
    logger.log(`   Files would be deleted: ${summary.deletedFiles}`);
    logger.log(`   Size would be freed: ${formatBytes(summary.deletedSize)}`);

    if (summary.hasErrors) {
      logger.log(`   Errors: ${summary.errors.length}`);
      logger.error("\n❌ Errors occurred during cleanup:");
      for (const error of summary.errors) {
        logger.error(`   • ${error.path}: ${error.error}`);
      }
    }

    logger.log("━".repeat(60));

    return summary;
  })();

  return result;
};
