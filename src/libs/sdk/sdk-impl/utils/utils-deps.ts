import { relinka } from "@reliverse/relinka";
import { readPackageJSON } from "pkg-types";
import { glob } from "tinyglobby";

import type { BuildPublishConfig } from "~/libs/sdk/sdk-types";

import { readFileSafe } from "./utils-fs";
import { extractPackageName } from "./utils-misc";

/**
 * Filters out development dependencies from a dependency record.
 */
export async function filterDeps(
  deps: Record<string, string> | undefined,
  clearUnused: boolean,
  outDirBin: string,
  isJsr: boolean,
  config: BuildPublishConfig,
  libName?: string,
): Promise<Record<string, string>> {
  relinka("verbose", `Filtering dependencies (clearUnused=${clearUnused})`);
  if (!deps) return {};

  // Get the appropriate patterns based on the build type and library
  const patterns = new Set<string>();

  // Always include global patterns
  for (const pattern of config.removeDepsPatterns.global) {
    patterns.add(pattern);
  }

  // Add NPM-specific patterns if not JSR
  if (!isJsr) {
    for (const pattern of config.removeDepsPatterns["dist-npm"]) {
      patterns.add(pattern);
    }
  }

  // Add JSR-specific patterns if JSR
  if (isJsr) {
    for (const pattern of config.removeDepsPatterns["dist-jsr"]) {
      patterns.add(pattern);
    }
  }

  // Add library-specific patterns if a library is specified
  if (libName && config.removeDepsPatterns["dist-libs"][libName]) {
    const libPatterns = config.removeDepsPatterns["dist-libs"][libName];
    // Add NPM-specific patterns if not JSR
    if (!isJsr) {
      for (const pattern of libPatterns.npm) {
        patterns.add(pattern);
      }
    }
    // Add JSR-specific patterns if JSR
    if (isJsr) {
      for (const pattern of libPatterns.jsr) {
        patterns.add(pattern);
      }
    }
  }

  // Function to check if a dependency should be excluded based on patterns
  const shouldExcludeByPattern = (depName: string) => {
    return Array.from(patterns).some((pattern) =>
      depName.toLowerCase().includes(pattern.toLowerCase()),
    );
  };

  // Read the original package.json to determine if we're dealing with devDependencies
  const originalPkg = await readPackageJSON();

  // Function to determine if a dependency should be excluded
  const shouldExcludeDep = (depName: string, isDev: boolean) => {
    // For CLI packages building for JSR, only exclude dependencies matching patterns
    if (isJsr && config.coreIsCLI.enabled) {
      return shouldExcludeByPattern(depName);
    }
    // For all other cases, exclude both dev dependencies and dependencies matching patterns
    return isDev || shouldExcludeByPattern(depName);
  };

  // Check if we're filtering dependencies or devDependencies
  // If the deps object is from package.devDependencies, devDeps should be true
  const devDeps = deps === originalPkg.devDependencies;

  if (!clearUnused) {
    const filtered = Object.entries(deps).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        if (!shouldExcludeDep(k, devDeps)) {
          acc[k] = v;
        }
        return acc;
      },
      {},
    );
    relinka(
      "verbose",
      `Filtered dependencies count: ${Object.keys(filtered).length}`,
    );
    return filtered;
  }

  const files = await glob("**/*.{js,ts}", {
    absolute: true,
    cwd: outDirBin,
  });
  const usedPackages = new Set<string>();
  for (const file of files) {
    const content = await readFileSafe(file, isJsr, "filterDeps");
    const importMatches = content.matchAll(
      /from\s+['"](\.|\.\/|\.\\)?src(\/|\\)/g,
    );
    for (const match of importMatches) {
      const importPath = match[1];
      const pkg = extractPackageName(importPath);
      if (pkg) {
        usedPackages.add(pkg);
      }
    }
  }
  const filtered = Object.entries(deps).reduce<Record<string, string>>(
    (acc, [k, v]) => {
      if (usedPackages.has(k) && !shouldExcludeDep(k, devDeps)) {
        acc[k] = v;
      }
      return acc;
    },
    {},
  );
  relinka(
    "verbose",
    `Filtered dependencies count (after usage check): ${Object.keys(filtered).length}`,
  );
  return filtered;
}
