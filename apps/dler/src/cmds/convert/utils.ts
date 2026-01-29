#!/usr/bin/env bun

/**
 * Shared utilities for codemod scripts
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

export type ColorKey = keyof typeof colors;

/**
 * Logging utilities
 */
export function log(message: string, color: ColorKey = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

export function error(message: string): void {
  log(`❌ Error: ${message}`, 'red');
}

export function success(message: string): void {
  log(`✅ ${message}`, 'green');
}

export function info(message: string): void {
  log(`ℹ️  ${message}`, 'blue');
}

export function warning(message: string): void {
  log(`⚠️  ${message}`, 'yellow');
}

/**
 * Parse command line arguments
 */
export interface ParsedArgs {
  dryRun: boolean;
  verbose: boolean;
  cwd: string;
  [key: string]: boolean | string | string[];
}

export function parseArgs(additionalFlags: string[] = []): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    cwd: process.cwd(),
  };

  // Parse additional flags
  for (const flag of additionalFlags) {
    result[flag] = args.includes(`--${flag}`);
  }

  // Parse --cwd
  const cwdIndex = args.indexOf('--cwd');
  if (cwdIndex !== -1 && cwdIndex + 1 < args.length) {
    let cwd = args[cwdIndex + 1];

    // Expand ~ to home directory
    if (cwd.startsWith('~')) {
      cwd = join(homedir(), cwd.slice(1));
    }

    // Create directory if it doesn't exist
    if (!existsSync(cwd)) {
      mkdirSync(cwd, { recursive: true });
      log(`Created directory: ${cwd}`, 'blue');
    }

    process.chdir(cwd);
    log(`Changed working directory to: ${cwd}`, 'blue');
    result.cwd = cwd;
  }

  return result;
}

/**
 * File finding utilities
 */
export interface FindFilesOptions {
  ignoredDirs?: readonly string[];
  ignoredFilePatterns?: readonly string[];
  extensions?: readonly string[];
  patterns?: readonly string[] | string;
}

export function findFiles(
  dir: string,
  options: FindFilesOptions = {}
): string[] {
  const {
    ignoredDirs = ['node_modules', '.git', 'target', 'dist', '.next', '.nuxt', 'build', 'out', '.idea', 'generated', '.cache'],
    ignoredFilePatterns = ['*.node', '*.wasm', '*.png', '*.jpg', '*.jpeg', '*.gif', '*.ico', '*.woff', '*.woff2', '*.ttf', '*.eot', '*.pdf', '*.zip', '*.tar.gz', '*.7z'],
    extensions,
    patterns,
  } = options;

  const results: string[] = [];
  const patternArray = patterns ? (Array.isArray(patterns) ? patterns : [patterns]) : null;
  const extensionSet = extensions ? new Set(extensions) : null;

  function traverse(currentDir: string): void {
    let items: string[];
    try {
      items = readdirSync(currentDir);
    } catch (err) {
      return; // Skip directories we can't read
    }

    for (const item of items) {
      if (ignoredDirs.includes(item)) continue;

      const fullPath = join(currentDir, item);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch (err) {
        continue; // Skip files/directories that can't be accessed
      }

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else {
        // Check if file matches patterns or extensions
        const matchesPattern = patternArray
          ? patternArray.some(pattern => item === pattern || item.endsWith(pattern))
          : true;

        const matchesExtension = extensionSet
          ? Array.from(extensionSet).some(ext => item.endsWith(ext))
          : true;

        const isIgnored = ignoredFilePatterns.some(pattern =>
          item.endsWith(pattern.replace('*', ''))
        );

        if (matchesPattern && matchesExtension && !isIgnored) {
          results.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return results;
}

/**
 * Batch file processor for efficient file operations
 */
export interface BatchFileProcessor {
  queueReplacement(filePath: string, oldString: string, newString: string): void;
  applyAll(): { processed: number; modified: number };
  size(): number;
}

export function createBatchFileProcessor(dryRun: boolean = false): BatchFileProcessor {
  const operations = new Map<string, Map<string, string>>();
  const fileCache = new Map<string, string>();

  const queueReplacement = (filePath: string, oldString: string, newString: string): void => {
    if (oldString === newString) return; // Skip no-op replacements

    if (!operations.has(filePath)) {
      operations.set(filePath, new Map());
    }
    const fileOps = operations.get(filePath)!;

    // Avoid duplicate operations on the same string
    if (!fileOps.has(oldString)) {
      fileOps.set(oldString, newString);
    }
  };

  const applyOperations = (filePath: string): boolean => {
    const fileOps = operations.get(filePath);
    if (!fileOps || fileOps.size === 0) return false;

    try {
      let content = fileCache.get(filePath);
      if (content === undefined) {
        content = readFileSync(filePath, 'utf8');
        fileCache.set(filePath, content);
      }

      let modified = false;
      let newContent = content;

      // Sort operations by length (longest first) to avoid partial replacements
      const sortedOps = Array.from(fileOps.entries()).sort(([a], [b]) => b.length - a.length);

      for (const [oldString, newString] of sortedOps) {
        // Idempotency check: only skip if oldString is NOT in content (already replaced)
        // But still process if oldString IS in content (needs replacement)
        if (!newContent.includes(oldString)) {
          continue; // Old string not found, already replaced or never existed
        }

        // Additional check: if both old and new are present, we still want to replace old with new
        // This handles cases where file was partially migrated
        if (newContent.includes(oldString)) {
          if (dryRun) {
            log(`[DRY RUN] Would update ${filePath}: ${oldString} → ${newString}`, 'yellow');
          }
          newContent = newContent.replace(
            new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            newString
          );
          modified = true;
        }
      }

      if (modified && !dryRun) {
        writeFileSync(filePath, newContent);
        fileCache.set(filePath, newContent);
      }

      return modified;
    } catch (err) {
      error(`Failed to process ${filePath}: ${err}`);
      return false;
    }
  };

  const applyAll = (): { processed: number; modified: number } => {
    let processed = 0;
    let modified = 0;

    for (const filePath of Array.from(operations.keys())) {
      processed++;
      if (applyOperations(filePath)) {
        modified++;
      }
    }

    // Clean up resources
    operations.clear();
    fileCache.clear();
    return { processed, modified };
  };

  const size = (): number => operations.size;

  return {
    queueReplacement,
    applyAll,
    size,
  };
}

/**
 * Read file content with caching
 */
const fileContentCache = new Map<string, string>();

export function readFileContent(filePath: string, useCache: boolean = true): string {
  if (useCache && fileContentCache.has(filePath)) {
    return fileContentCache.get(filePath)!;
  }

  const content = readFileSync(filePath, 'utf8');
  if (useCache) {
    fileContentCache.set(filePath, content);
  }
  return content;
}

export function clearFileCache(): void {
  fileContentCache.clear();
}

/**
 * Check if directory is empty (ignoring hidden files)
 */
export function isDirectoryEmpty(dirPath: string): boolean {
  try {
    const items = readdirSync(dirPath);
    return items.filter(item => !item.startsWith('.')).length === 0;
  } catch (err) {
    return true; // Directory doesn't exist or can't be read
  }
}

/**
 * Check if the current directory is already a relinter project
 */
export function isRelinterProject(dirPath: string = '.'): boolean {
  try {
    const packageJsonPath = join(dirPath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      return false;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return packageJson.name === 'relinter';
  } catch (err) {
    return false;
  }
}

/**
 * Check if the project has already been migrated from oxc to relinter
 */
export function isAlreadyMigratedFromOxc(dirPath: string = '.'): boolean {
  try {
    // Check if there are any oxc references in key files
    const packageJsonPath = join(dirPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      const content = readFileSync(packageJsonPath, 'utf8');
      // If we find "oxc" but not "relinter", it's not migrated
      if (content.includes('oxc') && !content.includes('relinter')) {
        return false;
      }
    }

    // Check Cargo.toml
    const cargoTomlPath = join(dirPath, 'Cargo.toml');
    if (existsSync(cargoTomlPath)) {
      const content = readFileSync(cargoTomlPath, 'utf8');
      if (content.includes('oxc_') && !content.includes('relinter_')) {
        return false;
      }
    }

    // Check if relinter directories exist
    const relintPath = join(dirPath, 'apps/relint');
    const relfmtPath = join(dirPath, 'apps/relfmt');
    if (existsSync(relintPath) || existsSync(relfmtPath)) {
      return true;
    }

    // If we have relinter in package.json, assume migrated
    return isRelinterProject(dirPath);
  } catch (err) {
    return false;
  }
}

/**
 * Check if the project has already been migrated to bun
 */
export function isAlreadyMigratedToBun(dirPath: string = '.'): boolean {
  try {
    const packageJsonPath = join(dirPath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      return false;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    // Check packageManager field
    if (packageJson.packageManager?.startsWith('bun@')) {
      return true;
    }

    // Check if pnpm-workspace.yaml still exists (indicates not migrated)
    if (existsSync(join(dirPath, 'pnpm-workspace.yaml'))) {
      return false;
    }

    // Check if scripts use bun instead of pnpm
    if (packageJson.scripts) {
      const scriptsStr = JSON.stringify(packageJson.scripts);
      if (scriptsStr.includes('pnpm ') && !scriptsStr.includes('bun ')) {
        return false;
      }
    }

    return false;
  } catch (err) {
    return false;
  }
}
