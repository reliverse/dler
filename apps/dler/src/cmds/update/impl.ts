import pMap from "@reliverse/mapkit";
import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { logger } from "@reliverse/relinka";
import { Glob } from "bun";

import {
  applyVersionUpdate,
  checkPackageUpdate,
  collectTargetDependencies,
  type DependencyInfo,
  type PackageCheckOptions,
  prepareDependenciesForUpdate,
  prepareDependenciesForUpdateFromMap,
  runInstallCommand,
  type UpdateResult,
} from "./utils";

interface UpdateArgs {
  ci?: boolean;
  cwd?: string;
  name?: string[];
  ignore?: string[];
  dryRun?: boolean;
  install?: boolean;
  allowMajor?: boolean;
  concurrency?: number;
  ignoreFields?: string[];
  verbose?: boolean;
}

export async function validatePackageJson(): Promise<string> {
  const packageJsonPath = path.resolve(process.cwd(), "package.json");

  if (!(await fs.pathExists(packageJsonPath))) {
    logger.error("No package.json found in current directory");
    process.exit(1);
  }

  return packageJsonPath;
}

export async function prepareAllUpdateCandidates(cwd?: string): Promise<{
  packageJsonFiles: string[];
  fileDepsMap: Map<string, Record<string, DependencyInfo>>;
}> {
  // Find ALL package.json files in the project
  const glob = new Glob("**/package.json");
  let packageJsonFiles: string[] = [];

  for await (const file of glob.scan({
    cwd: process.cwd(),
    onlyFiles: true,
  })) {
    const fullPath = path.resolve(process.cwd(), file);

    // Filter out unwanted directories
    if (
      !(
        file.includes("node_modules") ||
        file.includes("dist") ||
        file.includes("build") ||
        file.includes(".git") ||
        file.includes("coverage") ||
        file.includes(".next") ||
        file.includes("out") ||
        file.includes("target") ||
        file.includes(".turbo")
      )
    ) {
      packageJsonFiles.push(fullPath);
    }
  }

  // Filter by cwd if specified
  if (cwd) {
    const cwdPath = path.resolve(process.cwd(), cwd);
    packageJsonFiles = packageJsonFiles.filter((filePath) => {
      return (
        filePath.startsWith(cwdPath + path.sep) || filePath === path.join(cwdPath, "package.json")
      );
    });
  }

  if (packageJsonFiles.length === 0) {
    logger.warn("No package.json files found");
    return { packageJsonFiles: [], fileDepsMap: new Map() };
  }

  // Process each package.json file in parallel for better I/O performance
  const fileDepsMap = new Map<string, Record<string, DependencyInfo>>();

  const readPromises = packageJsonFiles.map(async (packageJsonPath) => {
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, { encoding: "utf8" }));
      const { map } = collectTargetDependencies(packageJson);
      return { path: packageJsonPath, map };
    } catch (error) {
      logger.warn(
        `Failed to process ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`
      );
      return { path: packageJsonPath, map: {} };
    }
  });

  const readResults = await pMap(readPromises, (promise) => promise, { concurrency: 20 });

  for (const result of readResults) {
    fileDepsMap.set(result.path, result.map);
  }

  logger.debug(`Processing ${packageJsonFiles.length} package.json files...`);
  return { packageJsonFiles, fileDepsMap };
}

export async function checkPackageUpdatesForFile(
  fileDepsMap: Record<string, DependencyInfo>,
  args: UpdateArgs
): Promise<UpdateResult[]> {
  const options: PackageCheckOptions = {
    allowMajor: !!args.allowMajor,
    savePrefix: "^", // Use default prefix
    concurrency: args.concurrency || 5,
  };

  // Get candidates for this specific file
  const candidates = prepareDependenciesForUpdate(fileDepsMap, args);

  if (candidates.length === 0) {
    return [];
  }

  return await pMap(
    candidates,
    async (dep): Promise<UpdateResult> => {
      const depInfo = fileDepsMap[dep];
      if (!depInfo?.versionSpec) {
        return {
          package: dep,
          currentVersion: "unknown",
          latestVersion: "unknown",
          updated: false,
          error: "Current version not found",
          semverCompatible: false,
          location: "unknown",
        };
      }

      return checkPackageUpdate(dep, depInfo.versionSpec, depInfo.locations, options);
    },
    { concurrency: args.concurrency || 5 }
  );
}

export async function checkPackageUpdatesForAllFiles(
  globalDepsMap: Map<string, { versionSpec: string; locations: Set<string>; files: Set<string> }>,
  args: UpdateArgs
): Promise<UpdateResult[]> {
  const options: PackageCheckOptions = {
    allowMajor: !!args.allowMajor,
    savePrefix: "^", // Use default prefix
    concurrency: args.concurrency || 50, // Increased default concurrency for HTTP requests
  };

  // Get candidates for all files combined (pass Map directly to avoid conversion)
  const candidates = prepareDependenciesForUpdateFromMap(globalDepsMap, args);

  if (candidates.length === 0) {
    return [];
  }

  if (args.verbose) {
    logger.debug(
      `Checking ${candidates.length} unique dependencies across all files with concurrency ${options.concurrency}`
    );
  }

  // Use Promise.allSettled with high concurrency for maximum parallelization of HTTP requests
  const promises = candidates.map(async (dep): Promise<UpdateResult> => {
    const depInfo = globalDepsMap.get(dep);
    if (!depInfo?.versionSpec) {
      return {
        package: dep,
        currentVersion: "unknown",
        latestVersion: "unknown",
        updated: false,
        error: "Current version not found",
        semverCompatible: false,
        location: "unknown",
      };
    }

    return checkPackageUpdate(dep, depInfo.versionSpec, depInfo.locations, options);
  });

  const results = await Promise.allSettled(promises);

  // Convert results and filter out any rejected promises (treat as errors)
  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      const dep = candidates[index] ?? "unknown";
      return {
        package: dep,
        currentVersion: "unknown",
        latestVersion: "unknown",
        updated: false,
        error: `Failed to check: ${result.reason}`,
        semverCompatible: false,
        location: "unknown",
      };
    }
  });
}

export async function updatePackageJsonFileDirectly(
  packageJsonPath: string,
  fileDepsMap: Record<string, DependencyInfo>,
  updatesToApply: UpdateResult[],
  savePrefix: string,
  fieldsToIgnore: string[] = []
): Promise<number> {
  if (updatesToApply.length === 0) {
    return 0;
  }

  try {
    const packageJson = JSON.parse(
      await fs.readFile(packageJsonPath, { encoding: "utf8" })
    ) as Record<string, unknown>;
    const updatedPackageJson = { ...packageJson };

    for (const update of updatesToApply) {
      const depInfo = fileDepsMap[update.package];
      if (!depInfo) {
        continue;
      }

      const locations = depInfo.locations || new Set<string>();

      // Check if any of the dependency's locations should be ignored
      const shouldIgnore = Array.from(locations).some((location) =>
        fieldsToIgnore.includes(String(location))
      );

      if (shouldIgnore) {
        continue; // Skip this update
      }

      // Determine the version prefix based on dependency type
      let newVersion: string;
      if (locations.has("peerDependencies")) {
        // For peerDependencies, preserve the >= prefix if it exists
        const currentVersion = String(fileDepsMap[update.package]?.versionSpec || "");
        if (currentVersion.startsWith(">=")) {
          newVersion = `>=${update.latestVersion}`;
        } else {
          newVersion =
            savePrefix === "none" ? update.latestVersion : `${savePrefix}${update.latestVersion}`;
        }
      } else {
        // For other dependency types, use the standard prefix
        newVersion =
          savePrefix === "none" ? update.latestVersion : `${savePrefix}${update.latestVersion}`;
      }

      applyVersionUpdate(updatedPackageJson, update.package, newVersion, locations);
    }

    await fs.writeFile(packageJsonPath, `${JSON.stringify(updatedPackageJson, null, 2)}\n`, {
      encoding: "utf8",
    });

    return updatesToApply.length;
  } catch (error) {
    logger.warn(
      `Failed to update ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return 0;
  }
}

export async function handleInstallation(verbose: boolean = false): Promise<void> {
  try {
    await runInstallCommand(verbose);
    logger.log("Installation completed successfully");
  } catch (error) {
    logger.warn(`Install failed: ${error instanceof Error ? error.message : String(error)}`);
    logger.log("Run 'bun install' manually to apply the changes");
  }
}
