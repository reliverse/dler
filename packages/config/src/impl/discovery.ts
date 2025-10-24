// packages/config/src/discovery.ts

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { readPackageJSON } from "@reliverse/dler-pkg-tsc";
import { loadConfig } from "c12";

// ============================================================================
// Monorepo Discovery
// ============================================================================

/**
 * Find monorepo root by looking for package.json with workspaces field
 */
export const findMonorepoRoot = async (
  cwd?: string,
): Promise<string | null> => {
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
  if (!pkg.workspaces) return [];

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
  packagePath: string,
): Promise<{ name: string; path: string; pkg: any } | null> => {
  try {
    const pkg = await readPackageJSON(packagePath);
    if (!pkg || !pkg.name) {
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
  cwd?: string,
): Promise<{ name: string; path: string; pkg: any }[]> => {
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

  const packages: { name: string; path: string; pkg: any }[] = [];
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

/**
 * Filter packages based on ignore patterns
 */
export const filterPackages = (
  packages: { name: string; path: string; pkg: any }[],
  ignore?: string | string[],
): { name: string; path: string; pkg: any }[] => {
  if (!ignore) return packages;

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
// Configuration Discovery
// ============================================================================

/**
 * Find dler.ts configuration file by searching up the directory tree
 */
export const findDlerConfig = async (
  startDir: string,
  maxDepth = 3,
): Promise<string | null> => {
  let currentDir = resolve(startDir);
  let depth = 0;

  while (depth <= maxDepth) {
    const packageJsonPath = resolve(currentDir, "package.json");
    const dlerPath = resolve(currentDir, "dler.ts");

    // Check if both files exist
    if (existsSync(packageJsonPath) && existsSync(dlerPath)) {
      try {
        // Verify package.json has workspaces.packages field
        const pkg = await readPackageJSON(currentDir);
        if (
          pkg &&
          pkg.workspaces &&
          typeof pkg.workspaces === "object" &&
          "packages" in pkg.workspaces
        ) {
          return currentDir;
        }
      } catch {
        // If we can't read package.json, continue searching
      }
    }

    // Move up one directory level
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
    depth++;
  }

  return null;
};

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Load dler.ts configuration
 */
export const loadDlerConfig = async <T extends Record<string, any> = any>(
  cwd?: string,
  maxConfigDepth = 3,
): Promise<T | null> => {
  try {
    const startDir = cwd || process.cwd();
    const configDir = await findDlerConfig(startDir, maxConfigDepth);

    if (!configDir) {
      throw new Error(
        `Could not find dler.ts and root package.json with workspaces.packages in the same directory after searching ${maxConfigDepth} levels up from ${startDir}`,
      );
    }

    const { config } = await loadConfig<T>({
      cwd: configDir,
      name: "dler",
      configFile: "dler",
      packageJson: false,
      dotenv: false,
    });

    return config || null;
  } catch (error) {
    // Re-throw discovery errors, but return null for config loading errors
    if (
      error instanceof Error &&
      error.message.includes("Could not find dler.ts")
    ) {
      throw error;
    }
    return null;
  }
};
