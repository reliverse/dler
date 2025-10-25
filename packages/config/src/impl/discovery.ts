// packages/config/src/discovery.ts

import { dirname, resolve } from "node:path";
import { readPackageJSON } from "@reliverse/dler-pkg-tsc";
import { loadConfig, watchConfig } from "c12";

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
// Configuration Loading
// ============================================================================

/**
 * Load dler.ts configuration using c12
 *
 * c12 automatically handles:
 * - Searching up directory tree for config files
 * - Loading TypeScript/JavaScript config files
 * - Merging multiple config sources (dler.ts, package.json, .dlerrc, etc.)
 * - Environment-specific configurations ($test, $development, $production)
 * - Config extending from remote/local sources
 *
 * Additional c12 features available:
 * - .config/ directory support
 * - RC file support (.dlerrc)
 * - Environment-specific configs ($env: { staging: {...} })
 * - Config watching with auto-reload
 * - Remote config extending (gh:user/repo)
 */
export const loadDlerConfig = async <T extends Record<string, any> = any>(
  cwd?: string,
): Promise<T | null> => {
  try {
    const { config } = await loadConfig<T>({
      cwd: cwd || process.cwd(),
      name: "dler",
      configFile: "dler",
      packageJson: "dler", // Enable reading from package.json "dler" field
      dotenv: false,
    });

    return config || null;
  } catch (error) {
    // Return null for config loading errors (file not found, etc.)
    return null;
  }
};

/**
 * Watch dler.ts configuration for changes (development mode)
 * Uses c12's watchConfig for auto-reload and HMR support
 */
export const watchDlerConfig = <T extends Record<string, any> = any>(
  cwd?: string,
  options?: {
    onUpdate?: (config: T) => void;
    onError?: (error: Error) => void;
  },
) => {
  return watchConfig<T>({
    cwd: cwd || process.cwd(),
    name: "dler",
    configFile: "dler",
    packageJson: "dler",
    dotenv: false,
    onUpdate: ({ newConfig }) => {
      options?.onUpdate?.(newConfig.config);
    },
    onWatch: (event) => {
      console.log("[dler config watcher]", event.type, event.path);
    },
  });
};
