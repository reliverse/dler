import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import pMap from "p-map";
import { glob } from "tinyglobby";

import { detectPackageManager } from "~/impl/utils/pm/pm-detect";
import {
  checkPackageUpdate,
  collectTargetDependencies,
  type PackageCheckOptions,
  prepareDependenciesForUpdate,
  runInstallCommand,
  type UpdateResult,
  updatePackageJsonFile,
} from "./utils";

interface UpdateArgs {
  ci?: boolean;
  cwd?: string;
  name?: string[];
  ignore?: string[];
  dryRun?: boolean;
  withInstall?: boolean;
  allowMajor?: boolean;
  concurrency?: number;
}

export async function validatePackageJson(): Promise<string> {
  const packageJsonPath = path.resolve(process.cwd(), "package.json");

  if (!(await fs.pathExists(packageJsonPath))) {
    relinka("error", "No package.json found in current directory");
    process.exit(1);
  }

  return packageJsonPath;
}

export async function prepareAllUpdateCandidates(args: UpdateArgs): Promise<{
  candidates: string[];
  allDepsMap: Record<string, any>;
  packageJsonFiles: string[];
}> {
  // Find ALL package.json files in the project using tinyglobby
  const packageJsonFiles = await glob("**/package.json", {
    cwd: process.cwd(),
    absolute: true,
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/coverage/**",
      "**/.next/**",
      "**/.nuxt/**",
      "**/out/**",
      "**/target/**",
      "**/.turbo/**",
    ],
  });

  if (packageJsonFiles.length === 0) {
    relinka("warn", "No package.json files found");
    return { candidates: [], allDepsMap: {}, packageJsonFiles: [] };
  }

  relinka("verbose", `Found ${packageJsonFiles.length} package.json files`);

  // Collect dependencies from all package.json files
  const allDepsMap: Record<string, any> = {};
  const allCandidates = new Set<string>();

  for (const packageJsonPath of packageJsonFiles) {
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
      const { map } = collectTargetDependencies(packageJson);
      const candidates = prepareDependenciesForUpdate(map, args);

      // Merge dependencies and candidates
      for (const [dep, info] of Object.entries(map)) {
        if (!allDepsMap[dep]) {
          allDepsMap[dep] = { ...info, locations: new Set(info.locations) };
        } else {
          // Merge locations from multiple package.json files
          for (const location of info.locations) {
            allDepsMap[dep].locations.add(location);
          }
          // Use the most recent version spec we find
          allDepsMap[dep].versionSpec = info.versionSpec;
        }
      }

      for (const candidate of candidates) {
        allCandidates.add(candidate);
      }
    } catch (error) {
      relinka(
        "warn",
        `Failed to process ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const candidates = Array.from(allCandidates);

  if (candidates.length === 0) {
    relinka("warn", "No dependencies to update");
    return { candidates: [], allDepsMap: {}, packageJsonFiles };
  }

  relinka("verbose", `Processing ${packageJsonFiles.length} package.json files`);
  return { candidates, allDepsMap, packageJsonFiles };
}

export async function checkPackageUpdates(
  candidates: string[],
  allDepsMap: Record<string, any>,
  args: UpdateArgs,
): Promise<UpdateResult[]> {
  const options: PackageCheckOptions = {
    allowMajor: !!args.allowMajor,
    savePrefix: "^", // Use default prefix
    concurrency: args.concurrency || 5,
  };

  return await pMap(
    candidates,
    async (dep): Promise<UpdateResult> => {
      const depInfo = allDepsMap[dep];
      if (!depInfo?.versionSpec) {
        return {
          package: dep,
          currentVersion: "unknown",
          latestVersion: "unknown",
          updated: false,
          error: "Current version not found",
          semverCompatible: false,
          location: Array.from(depInfo?.locations || ["unknown"]).join(", "),
        };
      }

      return checkPackageUpdate(dep, depInfo.versionSpec, depInfo.locations, options);
    },
    { concurrency: args.concurrency || 5 },
  );
}

export async function updateAllPackageJsonFiles(
  packageJsonFiles: string[],
  toUpdate: UpdateResult[],
  savePrefix: string,
): Promise<number> {
  if (packageJsonFiles.length === 0 || toUpdate.length === 0) {
    return 0;
  }

  let totalUpdated = 0;

  for (const packageJsonPath of packageJsonFiles) {
    try {
      // For each package.json, only update dependencies that actually exist in that file
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
      const { map: fileDepsMap } = collectTargetDependencies(packageJson);

      // Filter updates to only include dependencies that exist in this specific file
      const fileSpecificUpdates = toUpdate.filter((update) => fileDepsMap[update.package]);

      if (fileSpecificUpdates.length > 0) {
        const updated = await updatePackageJsonFile(
          packageJsonPath,
          fileDepsMap,
          fileSpecificUpdates,
          savePrefix,
        );
        totalUpdated += updated;

        if (updated > 0) {
          const relativePath = path.relative(process.cwd(), packageJsonPath);
          relinka("verbose", `Updated ${updated} dependencies in ${relativePath}`);
        }
      }
    } catch (error) {
      relinka(
        "warn",
        `Failed to process ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return totalUpdated;
}

export async function handleInstallation(): Promise<void> {
  const packageManager = await detectPackageManager(process.cwd());
  if (!packageManager) {
    relinka("warn", "Could not detect package manager. Please run install manually.");
    return;
  }

  try {
    await runInstallCommand(packageManager);
    relinka("log", "Installation completed successfully");
  } catch (error) {
    relinka("warn", `Install failed: ${error instanceof Error ? error.message : String(error)}`);
    relinka("log", `Run '${packageManager.command} install' manually to apply the changes`);
  }
}
