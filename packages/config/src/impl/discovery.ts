// packages/config/src/discovery.ts

import { dirname, resolve } from "node:path";
import { createIncludeFilter } from "@reliverse/matcha";
import { readPackageJSON } from "@reliverse/typerso";
import type { LoadedConfig } from "./config-loader";
import { loadConfig } from "./config-loader";

// ============================================================================
// Monorepo Discovery
// ============================================================================

/**
 * Find monorepo root by looking for package.json with workspaces field
 */
export const findMonorepoRoot = async (cwd?: string): Promise<string | null> => {
  let currentDir = cwd || process.cwd();
  const maxDepth = 10;
  let depth = 0;

  while (depth < maxDepth) {
    try {
      const pkg = await readPackageJSON(currentDir);
      if (pkg?.workspaces) {
        return currentDir;
      }
    } catch {
      // Continue searching
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
    depth++;
  }

  return null;
};

/**
 * Get workspace patterns from package.json
 */
export const getWorkspacePatterns = (pkg: any): string[] => {
  if (!pkg.workspaces) {
    return [];
  }

  if (Array.isArray(pkg.workspaces)) {
    return pkg.workspaces;
  }

  if (pkg.workspaces.packages) {
    return pkg.workspaces.packages;
  }

  return [];
};

/**
 * Check if package has workspaces
 */
export const hasWorkspaces = (pkg: any): boolean => {
  return !!(
    pkg.workspaces &&
    (Array.isArray(pkg.workspaces) ||
      (typeof pkg.workspaces === "object" && pkg.workspaces.packages))
  );
};

// ============================================================================
// Package Discovery
// ============================================================================

/**
 * Resolve package info for a given path
 */
export const resolvePackageInfo = async (
  packagePath: string
): Promise<{ name: string; path: string; pkg: any } | null> => {
  try {
    const pkg = await readPackageJSON(packagePath);
    if (!pkg?.name) {
      return null;
    }

    return {
      name: pkg.name,
      path: packagePath,
      pkg,
    };
  } catch {
    return null;
  }
};

/**
 * Get all workspace packages
 */
export const getWorkspacePackages = async (
  cwd?: string
): Promise<{ name: string; path: string; pkg: any }[]> => {
  const monorepoRoot = await findMonorepoRoot(cwd);

  // If no monorepo found, check if current directory is a single package
  if (!monorepoRoot) {
    const currentDir = cwd || process.cwd();
    const currentPkg = await readPackageJSON(currentDir);

    if (currentPkg?.name) {
      // Return single package info
      return [
        {
          name: currentPkg.name,
          path: currentDir,
          pkg: currentPkg,
        },
      ];
    }

    // Neither monorepo nor valid package found
    throw new Error(
      "❌ No monorepo or valid package found. Ensure package.json has 'workspaces' field or contains a valid 'name' field."
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

  const packages: { name: string; path: string; pkg: any }[] = [];
  const seenPaths = new Set<string>();

  for (const pattern of patterns) {
    // Check if pattern contains wildcards
    if (pattern.includes("*")) {
      // Pattern with wildcards - use glob
      const glob = new Bun.Glob(pattern);
      const matches = glob.scanSync({ cwd: monorepoRoot, onlyFiles: false });

      for (const match of matches) {
        const packagePath = resolve(monorepoRoot, match);
        if (seenPaths.has(packagePath)) {
          continue;
        }
        seenPaths.add(packagePath);

        const pkgInfo = await resolvePackageInfo(packagePath);
        if (pkgInfo) {
          packages.push(pkgInfo);
        }
      }
    } else {
      // Direct package path (no wildcards)
      const packagePath = resolve(monorepoRoot, pattern);
      if (seenPaths.has(packagePath)) {
        continue;
      }
      seenPaths.add(packagePath);

      const pkgInfo = await resolvePackageInfo(packagePath);
      if (pkgInfo) {
        packages.push(pkgInfo);
      }
    }
  }

  // Filter out the monorepo root to prevent publishing it
  const filteredPackages = packages.filter((pkg) => {
    const normalizedPkgPath = resolve(pkg.path);
    const normalizedRootPath = resolve(monorepoRoot);
    return normalizedPkgPath !== normalizedRootPath;
  });

  return filteredPackages;
};

// ============================================================================
// Package Filtering
// ============================================================================

/**
 * Filter packages based on ignore patterns or include filter
 */
export const filterPackages = (
  packages: { name: string; path: string; pkg: any }[],
  ignore?: string | string[],
  filter?: string | string[]
): { name: string; path: string; pkg: any }[] => {
  // If filter is provided, use it to include only matching packages (takes precedence over ignore)
  if (filter) {
    const includeFilter = createIncludeFilter(filter);
    return includeFilter(packages);
  }

  if (!ignore) {
    return packages;
  }

  const ignorePatterns = Array.isArray(ignore) ? ignore : [ignore];

  return packages.filter((pkg) => {
    return !ignorePatterns.some((pattern) => {
      // Support wildcard patterns
      if (pattern.includes("*")) {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(pkg.name);
      }
      return pkg.name === pattern;
    });
  });
};

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Load dler.config.ts configuration
 *
 * Uses the unified config loader which:
 * - Validates against @reliverse/rempts schema
 * - Loads dler.config.ts, dler.config.js, or dler.config.mjs files
 * - Applies schema defaults
 * - Returns LoadedConfig with extended build and publish configs
 */
export const loadDlerConfig = async (cwd?: string): Promise<LoadedConfig | null> => {
  try {
    const config = await loadConfig(cwd || process.cwd());
    return config;
  } catch {
    // Return null for config loading errors (file not found, etc.)
    return null;
  }
};
