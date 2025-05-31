import type { DependencyResult, FinderOptions } from "./deps-types";

import { readFile, findSourceFiles, readPackageJson } from "./filesystem";
import {
  extractPackageNames,
  getListedDependencies,
  getBuiltinModules,
} from "./parser";

export const analyzeDependencies = async (
  options: FinderOptions,
): Promise<DependencyResult> => {
  // Read package.json
  const packageJson = await readPackageJson(options.directory);
  const listedDependencies = getListedDependencies(packageJson);

  // Find all source files
  const sourceFiles = await findSourceFiles(
    options.directory,
    options.ignorePatterns,
  );

  // Get builtin modules
  const builtinModules = getBuiltinModules();

  // Extract dependencies from each file
  const allDependencies = new Set<string>();
  const devOnlyDependencies = new Set<string>();
  const duplicateDependencies = new Set<string>();

  // Check for packages listed in both dependencies and devDependencies
  if (packageJson.dependencies && packageJson.devDependencies) {
    for (const dep of Object.keys(packageJson.dependencies)) {
      if (packageJson.devDependencies[dep]) {
        duplicateDependencies.add(dep);
      }
    }
  }

  for (const filePath of sourceFiles) {
    const fileContent = await readFile(filePath);
    const packageNames = extractPackageNames(fileContent);

    for (const packageName of packageNames) {
      allDependencies.add(packageName);

      // Check if package is only in devDependencies
      if (
        packageJson.devDependencies?.[packageName] &&
        !packageJson.dependencies?.[packageName] &&
        !packageJson.peerDependencies?.[packageName] &&
        !packageJson.optionalDependencies?.[packageName] &&
        !builtinModules.has(packageName)
      ) {
        devOnlyDependencies.add(packageName);
      }
    }
  }

  // Find missing dependencies (those not listed in package.json)
  const missingDependencies = new Set<string>();
  const builtinModulesList: string[] = [];

  for (const dependency of allDependencies) {
    if (!listedDependencies.has(dependency)) {
      if (builtinModules.has(dependency)) {
        if (options.builtins) {
          builtinModulesList.push(dependency);
        }
      } else {
        missingDependencies.add(dependency);
      }
    }
  }

  return {
    missingDependencies: Array.from(missingDependencies).sort(),
    allDependencies: Array.from(allDependencies).sort(),
    listedDependencies: Array.from(listedDependencies).sort(),
    builtinModules: builtinModulesList.sort(),
    devOnlyDependencies: Array.from(devOnlyDependencies).sort(),
    duplicateDependencies: Array.from(duplicateDependencies).sort(),
  };
};
