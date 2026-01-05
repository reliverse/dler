// packages/helpers/src/impl/clear-logger-internals.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readdirRecursive } from "@reliverse/relifso";

interface ClearLoggerInternalsOptions {
  packages: Array<{ name: string; outputDir: string; path: string }>;
  ignorePackages?: string | string[];
  verbose?: boolean;
  onLog?: (message: string) => void;
}

interface ClearResult {
  updated: number;
  skipped: number;
  files: string[];
}

// Cache for compiled regex patterns
const patternCache = new Map<string, RegExp>();

function matchesPattern(str: string, pattern: string): boolean {
  if (pattern.includes("*")) {
    let regex = patternCache.get(pattern);
    if (!regex) {
      regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
      patternCache.set(pattern, regex);
    }
    return regex.test(str);
  }
  return str === pattern;
}

function shouldIgnorePackage(packageName: string, ignorePackages: string | string[]): boolean {
  const patterns = typeof ignorePackages === "string" ? [ignorePackages] : ignorePackages;
  return patterns.some((pattern) => matchesPattern(packageName, pattern));
}

// Compiled regex patterns for logger internals detection
const LOGGER_INTERNAL_REGEX = /logger\.internal\s*\(/;
const LOG_INTERNAL_REGEX = /logInternal\s*\(/;

function clearLoggerInternalsInFile(filePath: string): boolean {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const filteredLines: string[] = [];
  let hasChanges = false;

  for (const line of lines) {
    // Check if line contains logger.internal( or logInternal(
    // Using pre-compiled regex for better performance
    if (LOGGER_INTERNAL_REGEX.test(line) || LOG_INTERNAL_REGEX.test(line)) {
      hasChanges = true;
      // Skip this line
      continue;
    }
    filteredLines.push(line);
  }

  if (hasChanges) {
    const updated = filteredLines.join("\n");
    writeFileSync(filePath, updated, "utf-8");
    return true;
  }

  return false;
}

export async function clearLoggerInternalsInPackages(
  options: ClearLoggerInternalsOptions,
): Promise<ClearResult> {
  const { packages, ignorePackages, verbose = false, onLog } = options;

  const log = (message: string) => {
    if (verbose && onLog) {
      onLog(message);
    }
  };

  if (verbose) {
    log(`\n🧹 Clearing logger internals from ${packages.length} package(s)...`);
  }

  let updatedCount = 0;
  let skippedCount = 0;
  const processedFiles: string[] = [];

  for (const pkg of packages) {
    log(`   Processing package: ${pkg.name}`);

    // Check if package should be ignored
    if (ignorePackages && shouldIgnorePackage(pkg.name, ignorePackages)) {
      log(`   ⏭️  Skipping ${pkg.name} (ignored by pattern)`);
      skippedCount++;
      continue;
    }

    // Check if output directory exists
    // outputDir is already an absolute path from the build system
    const outputDir = pkg.outputDir;
    if (!existsSync(outputDir)) {
      log(`   ⏭️  Skipping ${pkg.name} (dist directory not found: ${outputDir})`);
      skippedCount++;
      continue;
    }

    log(`   📁 Scanning dist directory: ${outputDir}`);

    // Find all .js files in the dist directory
    let jsFiles: string[] = [];
    try {
      jsFiles = await readdirRecursive(outputDir, {
        extensions: ["js"],
      });
      log(`   📄 Found ${jsFiles.length} .js file(s)`);
    } catch (error) {
      log(`   ⚠️  Error reading dist directory for ${pkg.name}: ${error}`);
      skippedCount++;
      continue;
    }

    // Process each .js file
    let packageUpdatedCount = 0;
    for (const filePath of jsFiles) {
      try {
        if (clearLoggerInternalsInFile(filePath)) {
          updatedCount++;
          packageUpdatedCount++;
          processedFiles.push(filePath);
          log(`   ✓ Updated: ${filePath}`);
        }
      } catch (error) {
        log(`   ⚠️  Error processing ${filePath}: ${error}`);
      }
    }

    if (packageUpdatedCount === 0 && jsFiles.length > 0) {
      log(`   ℹ️  No logger internals found in ${pkg.name}`);
    }
  }

  if (verbose) {
    log(`\n   Summary: Updated ${updatedCount} file(s), skipped ${skippedCount} package(s)`);
  }

  return {
    updated: updatedCount,
    skipped: skippedCount,
    files: processedFiles,
  };
}
