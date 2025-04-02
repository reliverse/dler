import { readPackageJSON } from "pkg-types";
import { glob } from "tinyglobby";

import type { ExcludeMode } from "~/libs/sdk/sdk-types.js";

import { readFileSafe } from "./utils-fs.js";
import { relinka } from "@reliverse/relinka";
import { extractPackageName } from "./utils-paths.js";

/**
 * Filters out development dependencies from a dependency record.
 */
export async function filterDeps(
  deps: Record<string, string> | undefined,
  clearUnused: boolean,
  outDirBin: string,
  isJsr: boolean,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
): Promise<Record<string, string>> {
  relinka("verbose", `Filtering dependencies (clearUnused=${clearUnused})`);
  if (!deps) return {};

  // Function to check if a dependency should be excluded based on patterns
  const shouldExcludeByPattern = (depName: string) => {
    return rmDepsPatterns.some((pattern) =>
      depName.toLowerCase().includes(pattern.toLowerCase()),
    );
  };

  // Read the original package.json to determine if we're dealing with devDependencies
  const originalPkg = await readPackageJSON();

  // Function to determine if a dependency should be excluded based on the rmDepsMode
  const shouldExcludeDep = (depName: string, isDev: boolean) => {
    if (rmDepsMode === "patterns-only") {
      // Only exclude dependencies matching patterns, regardless if they're dev dependencies
      return shouldExcludeByPattern(depName);
    }
    if (rmDepsMode === "patterns-and-devdeps") {
      // Exclude both dev dependencies and dependencies matching patterns
      return isDev || shouldExcludeByPattern(depName);
    }
    // Default fallback (should not happen with proper typing)
    return shouldExcludeByPattern(depName);
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
