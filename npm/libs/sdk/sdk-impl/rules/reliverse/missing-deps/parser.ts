import { builtinModules } from "node:module";

import type { PackageJson } from "./deps-types";

// Regular expressions for different import patterns
const importRegexes = [
  // ES modules
  /import\s+(?:{[^}]*}|\*\s+as\s+[^,]*|[^,{]*)\s+from\s+["']([^"']+)["']/g,
  // Dynamic imports
  /import\(["']([^"']+)["']\)/g,
  // CommonJS requires
  /require\(["']([^"']+)["']\)/g,
  // Export from
  /export\s+(?:{[^}]*}|\*)\s+from\s+["']([^"']+)["']/g,
];

export const extractPackageNames = (fileContent: string): Set<string> => {
  const packageNames = new Set<string>();

  // Apply all regex patterns
  for (const regex of importRegexes) {
    let match: RegExpExecArray | null;
    // Clone the regex to reset lastIndex
    const clonedRegex = new RegExp(regex.source, regex.flags);

    for (;;) {
      match = clonedRegex.exec(fileContent);
      if (match === null) {
        break;
      }

      const importPath = match[1];
      if (importPath) {
        // Get the package name from the import path
        const packageName = normalizePackageName(importPath);
        if (packageName) {
          packageNames.add(packageName);
        }
      }
    }
  }

  return packageNames;
};

export const normalizePackageName = (importPath: string): string | null => {
  // Skip relative imports
  if (importPath.startsWith(".") || importPath.startsWith("/")) {
    return null;
  }

  // Handle scoped packages
  if (importPath.startsWith("@")) {
    const scopedMatch = importPath.match(/^(@[^/]+\/[^/]+)/);
    return scopedMatch ? (scopedMatch[1] ?? null) : null;
  }

  // Handle regular packages
  const match = importPath.match(/^([^/]+)/);
  return match ? (match[1] ?? null) : null;
};

export const getListedDependencies = (packageJson: PackageJson): Set<string> => {
  const listedDependencies = new Set<string>();

  // Combine all dependency types
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  };

  // Add each dependency to the set
  for (const dep of Object.keys(allDependencies || {})) {
    listedDependencies.add(dep);
  }

  return listedDependencies;
};

export const getBuiltinModules = (): Set<string> => {
  return new Set(builtinModules);
};
