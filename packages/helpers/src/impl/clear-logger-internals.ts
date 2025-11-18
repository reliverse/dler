// packages/helpers/src/impl/clear-logger-internals.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readdirRecursive } from "@reliverse/dler-fs-utils";

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

function matchesPattern(str: string, pattern: string): boolean {
  if (pattern.includes("*")) {
    const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
    return regex.test(str);
  }
  return str === pattern;
}

function shouldIgnorePackage(
  packageName: string,
  ignorePackages: string | string[],
): boolean {
  const patterns =
    typeof ignorePackages === "string" ? [ignorePackages] : ignorePackages;
  return patterns.some((pattern) => matchesPattern(packageName, pattern));
}

function clearLoggerInternalsInFile(filePath: string): boolean {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const filteredLines: string[] = [];
  let hasChanges = false;

  for (const line of lines) {
    // Check if line contains logger.internal( or logInternal(
    // Match patterns: logger.internal(, logInternal(, with optional whitespace
    if (/logger\.internal\s*\(/.test(line) || /logInternal\s*\(/.test(line)) {
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
      log(
        `   ⏭️  Skipping ${pkg.name} (dist directory not found: ${outputDir})`,
      );
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
    log(
      `\n   Summary: Updated ${updatedCount} file(s), skipped ${skippedCount} package(s)`,
    );
  }

  return {
    updated: updatedCount,
    skipped: skippedCount,
    files: processedFiles,
  };
}
