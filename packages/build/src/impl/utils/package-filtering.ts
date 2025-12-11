// packages/build/src/impl/utils/package-filtering.ts

import type { PackageInfo } from "../types";

/**
 * Check if a package name matches allowed patterns
 */
function isPackageAllowed(pkgName: string, allowedPatterns: string[]): boolean {
  for (const pattern of allowedPatterns) {
    // Simple glob pattern matching
    if (pattern.includes("*")) {
      const regexPattern = pattern.replace(/\*/g, ".*");
      if (new RegExp(`^${regexPattern}$`).test(pkgName)) {
        return true;
      }
    } else if (pkgName === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Filter packages based on private status and allowed patterns
 */
export function filterPrivatePackages(
  packages: PackageInfo[],
  allowPrivateBuild?: string | string[],
): PackageInfo[] {
  // Filter out private packages unless explicitly allowed
  if (!allowPrivateBuild) {
    return packages.filter((pkg) => pkg.private !== true);
  }

  // Normalize allowPrivateBuild to array
  const allowedPatterns = Array.isArray(allowPrivateBuild)
    ? allowPrivateBuild
    : [allowPrivateBuild];

  // Filter: allow if not private OR if private and explicitly allowed
  return packages.filter(
    (pkg) =>
      pkg.private !== true || isPackageAllowed(pkg.name, allowedPatterns),
  );
}
