/**
 * Extracts the package name (or scoped package name) from a potential bare import path.
 * Returns null if the path is relative, absolute, or empty.
 * @param importPath - The import path string.
 * @returns The package name (e.g., "react", "@scope/pkg") or null.
 */
export function extractPackageName(importPath: string | undefined): null | string {
  if (!importPath || importPath.startsWith(".") || importPath.startsWith("/")) {
    return null;
  }
  // Match 'package', '@scope/package'
  const match = /^(@[^/]+\/[^/]+|[^/]+)/.exec(importPath);
  return match ? match[0] : null;
}
