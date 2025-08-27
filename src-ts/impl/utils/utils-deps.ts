import { relinka } from "@reliverse/relinka";
import { readPackageJSON } from "pkg-types";
import { glob } from "tinyglobby";

import type { ReliverseConfig } from "~/impl/schema/mod";

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
  config: ReliverseConfig,
  libName?: string,
): Promise<Record<string, string>> {
  relinka("verbose", `Filtering dependencies (clearUnused=${clearUnused})`);
  if (!deps) return {};

  // Get the appropriate patterns based on the build type and library
  const patterns = new Set<string>();
  const addPatterns = new Set<string>(); // Track patterns that should be added

  // Always include global patterns
  for (const pattern of config.filterDepsPatterns.global) {
    if (pattern.startsWith("+")) {
      addPatterns.add(pattern.slice(1));
    } else {
      patterns.add(pattern);
    }
  }

  // Add NPM-specific patterns if not JSR
  if (!isJsr) {
    for (const pattern of config.filterDepsPatterns["dist-npm"]) {
      if (pattern.startsWith("+")) {
        addPatterns.add(pattern.slice(1));
      } else {
        patterns.add(pattern);
      }
    }
  }

  // Add JSR-specific patterns if JSR
  if (isJsr) {
    for (const pattern of config.filterDepsPatterns["dist-jsr"]) {
      if (pattern.startsWith("+")) {
        addPatterns.add(pattern.slice(1));
      } else {
        patterns.add(pattern);
      }
    }
  }

  // Add library-specific patterns if a library is specified
  if (libName && config.filterDepsPatterns["dist-libs"][libName]) {
    const libPatterns = config.filterDepsPatterns["dist-libs"][libName];
    // Add NPM-specific patterns if not JSR
    if (!isJsr) {
      for (const pattern of libPatterns.npm) {
        if (pattern.startsWith("+")) {
          addPatterns.add(pattern.slice(1));
        } else {
          patterns.add(pattern);
        }
      }
    }
    // Add JSR-specific patterns if JSR
    if (isJsr) {
      for (const pattern of libPatterns.jsr) {
        if (pattern.startsWith("+")) {
          addPatterns.add(pattern.slice(1));
        } else {
          patterns.add(pattern);
        }
      }
    }
  }

  // Function to check if a dependency should be excluded based on patterns
  const shouldExcludeByPattern = (depName: string) => {
    const depNameLower = depName.toLowerCase();

    // First check negation patterns - if any match, don't exclude
    for (const pattern of patterns) {
      if (pattern.startsWith("!")) {
        const negPattern = pattern.slice(1).toLowerCase();
        if (depNameLower.includes(negPattern)) {
          return false;
        }
      }
    }

    // Then check regular patterns - if any match, exclude
    for (const pattern of patterns) {
      if (!pattern.startsWith("!")) {
        if (depNameLower.includes(pattern.toLowerCase())) {
          return true;
        }
      }
    }

    // If no patterns matched, don't exclude
    return false;
  };

  // Read the original package.json to determine if we're dealing with devDependencies
  const originalPkg = await readPackageJSON();

  // Function to determine if a dependency should be excluded
  const shouldExcludeDep = (depName: string, isDevDep: boolean) => {
    // For CLI packages building for JSR, only exclude dependencies matching patterns
    if (isJsr && config.coreIsCLI.enabled) {
      return shouldExcludeByPattern(depName);
    }
    // For all other cases, exclude both dev dependencies and dependencies matching patterns
    return isDevDep || shouldExcludeByPattern(depName);
  };

  // Check if we're filtering dependencies or devDependencies
  // If the deps object is from package.devDependencies, devDeps should be true
  const devDeps = deps === originalPkg.devDependencies;

  if (!clearUnused) {
    const filtered = Object.entries(deps).reduce<Record<string, string>>((acc, [k, v]) => {
      if (!shouldExcludeDep(k, devDeps)) {
        acc[k] = v;
      }
      return acc;
    }, {});

    // Add dependencies from addPatterns if they don't exist
    for (const pattern of addPatterns) {
      if (!filtered[pattern] && !originalPkg.dependencies?.[pattern]) {
        // Use the version from the original package.json if it exists in devDependencies
        // Otherwise use the latest version
        filtered[pattern] = originalPkg.devDependencies?.[pattern] || "latest";
      }
    }

    relinka("verbose", `Filtered dependencies count: ${Object.keys(filtered).length}`);
    return filtered;
  }

  const files = await glob("**/*.{js,ts}", {
    absolute: true,
    cwd: outDirBin,
  });
  const usedPackages = new Set<string>();
  for (const file of files) {
    const content = await readFileSafe(file, isJsr, "filterDeps");
    const importMatches = content.matchAll(/from\s+['"](\.|\.\/|\.\\)?src(\/|\\)/g);
    for (const match of importMatches) {
      const importPath = match[1];
      const pkg = extractPackageName(importPath);
      if (pkg) {
        usedPackages.add(pkg);
      }
    }
  }
  const filtered = Object.entries(deps).reduce<Record<string, string>>((acc, [k, v]) => {
    if (usedPackages.has(k) && !shouldExcludeDep(k, devDeps)) {
      acc[k] = v;
    }
    return acc;
  }, {});
  relinka(
    "verbose",
    `Filtered dependencies count (after usage check): ${Object.keys(filtered).length}`,
  );
  return filtered;
}
