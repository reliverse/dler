// packages/helpers/src/impl/replace-exports.ts

import { readFileSync, writeFileSync } from "node:fs";
import { Glob } from "bun";

interface ReplaceExportsOptions {
  direction?: "ts-to-js" | "js-to-ts";
  cwd?: string;
  ignorePackages?: string | string[];
  verbose?: boolean;
}

interface ReplaceResult {
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

function shouldIgnorePackage(
  packageName: string,
  ignorePackages: string | string[],
): boolean {
  const patterns =
    typeof ignorePackages === "string" ? [ignorePackages] : ignorePackages;
  return patterns.some((pattern) => matchesPattern(packageName, pattern));
}

// Pre-compiled regex patterns for package.json replacement
const DEFAULT_PATTERN_TS_TO_JS = /"default":\s*"\.\/src\/([^"]+)\.ts"/g;
const TYPES_PATTERN_TS_TO_JS = /"types":\s*"\.\/src\/([^"]+)\.ts"/g;
const ROOT_JS_PATTERN_TS_TO_JS = /"default":\s*"\.\/([^"]+\.js)"/g;
const ROOT_DTS_PATTERN_TS_TO_JS = /"types":\s*"\.\/([^"]+\.d\.ts)"/g;
const DIST_JS_PATTERN_JS_TO_TS = /"default":\s*"\.\/dist\/([^"]+)\.js"/g;
const DIST_DTS_PATTERN_JS_TO_TS = /"types":\s*"\.\/dist\/([^"]+)\.d\.ts"/g;
const ROOT_JS_PATTERN_JS_TO_TS = /"default":\s*"\.\/([^"]+\.js)"/g;
const ROOT_DTS_PATTERN_JS_TO_TS = /"types":\s*"\.\/([^"]+\.d\.ts)"/g;

function replaceInPackageJson(
  filePath: string,
  direction: "ts-to-js" | "js-to-ts",
): boolean {
  const content = readFileSync(filePath, "utf-8");

  if (direction === "ts-to-js") {
    let updated = content;
    let hasChanges = false;

    // Replace ./src/*.ts → ./dist/*.js (for default)
    // Reset lastIndex before testing to ensure consistent behavior
    DEFAULT_PATTERN_TS_TO_JS.lastIndex = 0;
    if (DEFAULT_PATTERN_TS_TO_JS.test(content)) {
      DEFAULT_PATTERN_TS_TO_JS.lastIndex = 0;
      updated = updated.replace(
        DEFAULT_PATTERN_TS_TO_JS,
        '"default": "./dist/$1.js"',
      );
      hasChanges = true;
    }

    // Replace ./src/*.ts → ./dist/*.d.ts (for types)
    TYPES_PATTERN_TS_TO_JS.lastIndex = 0;
    if (TYPES_PATTERN_TS_TO_JS.test(content)) {
      TYPES_PATTERN_TS_TO_JS.lastIndex = 0;
      updated = updated.replace(
        TYPES_PATTERN_TS_TO_JS,
        '"types": "./dist/$1.d.ts"',
      );
      hasChanges = true;
    }

    // Replace ./file.js → ./dist/file.js (if not already in dist/)
    ROOT_JS_PATTERN_TS_TO_JS.lastIndex = 0;
    updated = updated.replace(ROOT_JS_PATTERN_TS_TO_JS, (match, fileName) => {
      if (!fileName.startsWith("dist/")) {
        hasChanges = true;
        return `"default": "./dist/${fileName}"`;
      }
      return match;
    });

    // Replace ./file.d.ts → ./dist/file.d.ts (if not already in dist/)
    ROOT_DTS_PATTERN_TS_TO_JS.lastIndex = 0;
    updated = updated.replace(ROOT_DTS_PATTERN_TS_TO_JS, (match, fileName) => {
      if (!fileName.startsWith("dist/")) {
        hasChanges = true;
        return `"types": "./dist/${fileName}"`;
      }
      return match;
    });

    if (hasChanges) {
      writeFileSync(filePath, updated, "utf-8");
      return true;
    }
  } else {
    let updated = content;
    let hasChanges = false;

    // Replace ./dist/*.js → ./src/*.ts (for default)
    DIST_JS_PATTERN_JS_TO_TS.lastIndex = 0;
    if (DIST_JS_PATTERN_JS_TO_TS.test(content)) {
      DIST_JS_PATTERN_JS_TO_TS.lastIndex = 0;
      updated = updated.replace(
        DIST_JS_PATTERN_JS_TO_TS,
        '"default": "./src/$1.ts"',
      );
      hasChanges = true;
    }

    // Replace ./dist/*.d.ts → ./src/*.ts (for types)
    DIST_DTS_PATTERN_JS_TO_TS.lastIndex = 0;
    if (DIST_DTS_PATTERN_JS_TO_TS.test(content)) {
      DIST_DTS_PATTERN_JS_TO_TS.lastIndex = 0;
      updated = updated.replace(
        DIST_DTS_PATTERN_JS_TO_TS,
        '"types": "./src/$1.ts"',
      );
      hasChanges = true;
    }

    // Replace ./file.js → ./src/file.ts (if not already in src/ or dist/)
    ROOT_JS_PATTERN_JS_TO_TS.lastIndex = 0;
    updated = updated.replace(ROOT_JS_PATTERN_JS_TO_TS, (match, fileName) => {
      if (!fileName.startsWith("src/") && !fileName.startsWith("dist/")) {
        const baseName = fileName.replace(/\.js$/, "");
        hasChanges = true;
        return `"default": "./src/${baseName}.ts"`;
      }
      return match;
    });

    // Replace ./file.d.ts → ./src/file.ts (if not already in src/ or dist/)
    ROOT_DTS_PATTERN_JS_TO_TS.lastIndex = 0;
    updated = updated.replace(ROOT_DTS_PATTERN_JS_TO_TS, (match, fileName) => {
      if (!fileName.startsWith("src/") && !fileName.startsWith("dist/")) {
        const baseName = fileName.replace(/\.d\.ts$/, "");
        hasChanges = true;
        return `"types": "./src/${baseName}.ts"`;
      }
      return match;
    });

    if (hasChanges) {
      writeFileSync(filePath, updated, "utf-8");
      return true;
    }
  }

  return false;
}

export async function replaceExportsInPackages(
  options: ReplaceExportsOptions = {},
): Promise<ReplaceResult> {
  const {
    direction = "ts-to-js",
    cwd = process.cwd(),
    ignorePackages,
  } = options;

  const glob = new Glob("**/package.json");
  const packageJsonFiles: string[] = [];

  for await (const file of glob.scan({ cwd, onlyFiles: true })) {
    if (!file.includes("node_modules/")) {
      packageJsonFiles.push(file);
    }
  }

  let filteredFiles = packageJsonFiles;

  if (ignorePackages) {
    filteredFiles = [];
    for (const file of packageJsonFiles) {
      try {
        const content = readFileSync(file, "utf-8");
        const pkg = JSON.parse(content);
        if (!pkg?.name || !shouldIgnorePackage(pkg.name, ignorePackages)) {
          filteredFiles.push(file);
        }
      } catch {
        filteredFiles.push(file);
      }
    }
  }

  let updatedCount = 0;
  for (const file of filteredFiles) {
    if (replaceInPackageJson(file, direction)) {
      updatedCount++;
    }
  }

  return {
    updated: updatedCount,
    skipped: filteredFiles.length - updatedCount,
    files: filteredFiles,
  };
}
