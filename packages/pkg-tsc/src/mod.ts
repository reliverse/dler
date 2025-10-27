import { resolve } from "node:path";

import {
  defineTSConfig,
  readPackageJSON,
  readTSConfig,
  resolvePackageJSON,
  writePackageJSON,
  writeTSConfig,
} from "pkg-types";

export {
  readPackageJSON,
  writePackageJSON,
  resolvePackageJSON,
  defineTSConfig,
  writeTSConfig,
  readTSConfig,
};

export const readPackageJSONSafe = async (path: string) => {
  try {
    return await readPackageJSON(path);
  } catch (error) {
    return null;
  }
};

export const hasWorkspaces = (packageJson: any): boolean =>
  !!(
    packageJson?.workspaces?.packages &&
    Array.isArray(packageJson.workspaces.packages)
  );

export const getWorkspacePatterns = (packageJson: any): string[] =>
  packageJson?.workspaces?.packages || [];


export type PackageKind = "library" | "browser-app" | "native-app" | "cli";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract package name from scoped package name
 * @param packageName - The full package name (e.g., "@reliverse/dler")
 * @returns The package name without scope (e.g., "dler")
 */
export function extractPackageName(packageName: string): string {
  const parts = packageName.split("/");
  return parts[parts.length - 1] || packageName;
}

/**
 * Parse bin argument string into a record of binary definitions
 * @param binArg - The bin argument string (e.g., "dler=dist/cli.js,login=dist/foo/bar/login.js")
 * @returns Record mapping binary names to their file paths
 */
export function parseBinArgument(binArg: string): Record<string, string> {
  const binMap: Record<string, string> = {};

  if (!binArg) {
    return binMap;
  }

  const entries = binArg.split(",");
  for (const entry of entries) {
    const [name, path] = entry.split("=");
    if (name && path) {
      binMap[name.trim()] = path.trim();
    }
  }

  return binMap;
}

// ============================================================================
// Exports Field Transformation
// ============================================================================

/**
 * Transform exports field to point to built files instead of source files
 * This converts source paths (src/*.ts) to built paths (dist/*.js, dist/*.d.ts)
 */
export function transformExportsForBuild(exports: any): any {
  if (typeof exports === "string") {
    // Simple string export - convert .ts to .js and src/ to dist/
    return exports.replace(/\.ts$/, ".js").replace(/^\.\/src\//, "./dist/");
  }

  if (Array.isArray(exports)) {
    // Array of exports - recursively update each
    return exports.map(transformExportsForBuild);
  }

  if (typeof exports === "object" && exports !== null) {
    const updated: any = {};
    
    for (const [key, value] of Object.entries(exports)) {
      if (typeof value === "object" && value !== null) {
        // Nested object
        const updatedValue: any = {};
        for (const [subKey, subValue] of Object.entries(value)) {
          if (typeof subValue === "string") {
            // Convert source paths to built paths
            if (subKey === "types") {
              // TypeScript declarations: .ts -> .d.ts and src/ -> dist/
              updatedValue[subKey] = subValue.replace(/\.ts$/, ".d.ts").replace(/^\.\/src\//, "./dist/");
            } else {
              // JavaScript files: .ts -> .js and src/ -> dist/
              updatedValue[subKey] = subValue.replace(/\.ts$/, ".js").replace(/^\.\/src\//, "./dist/");
            }
          } else {
            updatedValue[subKey] = subValue;
          }
        }
        updated[key] = updatedValue;
      } else if (typeof value === "string") {
        // Direct string value - convert .ts to .js and src/ to dist/
        updated[key] = value.replace(/\.ts$/, ".js").replace(/^\.\/src\//, "./dist/");
      } else {
        updated[key] = value;
      }
    }
    
    return updated;
  }

  return exports;
}

// ============================================================================
// Bin Field Management
// ============================================================================

/**
 * Add bin field to package.json for CLI packages
 */
export function addBinFieldToPackageJson(
  pkg: any,
  kind: PackageKind | undefined,
  binDefinitions?: string
): void {
  if (kind !== "cli") {
    return;
  }

  const binMap = parseBinArgument(binDefinitions || "");

  // If no custom bin definitions provided, use default
  if (Object.keys(binMap).length === 0) {
    const packageName = extractPackageName(pkg.name || "cli");
    binMap[packageName] = "dist/cli.js";
  }

  pkg.bin = binMap;
}

// ============================================================================
// Files Field Management
// ============================================================================

/**
 * Add files field to package.json if missing or empty
 * @param packagePath - Path to the package directory
 * @returns Object indicating success and whether the field was added
 */
export async function addFilesFieldIfMissing(
  packagePath: string
): Promise<{ success: boolean; added: boolean; error?: string }> {
  try {
    const pkg = await readPackageJSON(packagePath);
    if (!pkg) {
      return { success: false, added: false, error: "Could not read package.json" };
    }

    // Check if files field exists and has at least one element
    if (pkg.files && Array.isArray(pkg.files) && pkg.files.length > 0) {
      return { success: true, added: false };
    }

    // Add files field with default values - ensure it's always set
    const files = ["dist", "package.json"];
    pkg.files = files;

    // Write modified package.json back
    await writePackageJSON(resolve(packagePath, "package.json"), pkg);

    return { success: true, added: true };
  } catch (error) {
    return {
      success: false,
      added: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Package.json Preparation
// ============================================================================

export interface PreparePackageJsonOptions {
  /** Package kind (library, cli, browser-app, native-app) */
  kind?: PackageKind;
  /** Binary definitions for CLI packages */
  binDefinitions?: string;
  /** Access level for publishing */
  access?: "public" | "restricted";
  /** Whether to add publishConfig */
  addPublishConfig?: boolean;
  /** Whether to add license field if missing */
  addLicense?: boolean;
  /** Whether to transform exports from src/*.ts to dist/*.js (default: false) */
  transformExports?: boolean;
}

/**
 * Prepare package.json for publishing by transforming exports and adding necessary fields
 */
export async function preparePackageJsonForPublishing(
  packagePath: string,
  options: PreparePackageJsonOptions = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const pkg = await readPackageJSON(packagePath);
    if (!pkg) {
      return { success: false, error: "Could not read package.json" };
    }

    // Transform exports field to point to built files (only if requested)
    if (options.transformExports && pkg.exports) {
      pkg.exports = transformExportsForBuild(pkg.exports);
    }

    // Add bin field for CLI packages
    addBinFieldToPackageJson(pkg, options.kind, options.binDefinitions);

    // Add files field if missing or empty
    if (!pkg.files || !Array.isArray(pkg.files) || pkg.files.length === 0) {
      pkg.files = ["dist", "package.json"];
    }

    // Determine if package is publishable (not private)
    const isPublishable = pkg.private !== true;

    // Add publishConfig with access level
    if (options.addPublishConfig !== false) {
      if (!pkg.publishConfig) {
        pkg.publishConfig = {};
      }
      pkg.publishConfig.access = options.access || "public";
    }

    // Add license field for publishable packages if missing
    if (isPublishable && options.addLicense !== false && !pkg.license) {
      pkg.license = "MIT";
    }

    // Write modified package.json back
    await writePackageJSON(resolve(packagePath, "package.json"), pkg);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
