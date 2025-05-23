import type { DependencyResult, FinderOptions } from "./deps-types.js";

import { readFile, findSourceFiles, readPackageJson } from "./filesystem.js";
import {
  extractPackageNames,
  getListedDependencies,
  getBuiltinModules,
} from "./parser.js";

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

  for (const filePath of sourceFiles) {
    const fileContent = await readFile(filePath);
    const packageNames = extractPackageNames(fileContent);

    for (const packageName of packageNames) {
      allDependencies.add(packageName);
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
  };
};
