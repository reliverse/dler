// cli/src/cmds/optimize/finder.ts

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { readdirRecursive, readFile } from "@reliverse/relifso";
import { logger } from "@reliverse/relinka";
import type { PackageMetadata } from "./types";

const PACKAGE_NAMES = [
  "@reliverse/dler",
  "@reliverse/build",
  "@reliverse/bump",
  "@reliverse/config",
  "@reliverse/helpers",
  "@reliverse/mapkit",
  "@reliverse/matcha",
  "@reliverse/pathkit",
  "@reliverse/publish",
  "@reliverse/relico",
  "@reliverse/relifso",
  "@reliverse/relinka",
  "@reliverse/rempts",
  "@reliverse/tsconfig",
  "@reliverse/typerso",
] as const;

const PACKAGE_PATH_MAP: Record<string, string> = {
  "@reliverse/dler": "cli",
  "@reliverse/build": "packages/build",
  "@reliverse/bump": "packages/bump",
  "@reliverse/config": "packages/config",
  "@reliverse/helpers": "packages/helpers",
  "@reliverse/mapkit": "packages/mapkit",
  "@reliverse/matcha": "packages/matcha",
  "@reliverse/pathkit": "packages/pathkit",
  "@reliverse/publish": "packages/publish",
  "@reliverse/relico": "packages/relico",
  "@reliverse/relifso": "packages/relifso",
  "@reliverse/relinka": "packages/relinka",
  "@reliverse/rempts": "packages/rempts",
  "@reliverse/tsconfig": "packages/tsconfig",
  "@reliverse/typerso": "packages/typerso",
};

export async function findMostRecentlyModifiedPackage(
  rootDir: string,
): Promise<PackageMetadata | null> {
  const packages: PackageMetadata[] = [];

  for (const packageName of PACKAGE_NAMES) {
    const packagePath = PACKAGE_PATH_MAP[packageName];
    if (!packagePath) {
      continue;
    }

    const fullPath = resolve(rootDir, packagePath);
    if (!existsSync(fullPath)) {
      continue;
    }

    try {
      const lastModified = await getLastModifiedTime(fullPath);
      const packageJsonPath = resolve(fullPath, "package.json");

      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          await readFile(packageJsonPath, { encoding: "utf-8" }),
        ) as { name?: string };

        packages.push({
          name: packageJson.name ?? packageName,
          path: fullPath,
          lastModified,
        });
      }
    } catch (error) {
      logger.warn(`Failed to process package ${packageName}: ${error}`);
    }
  }

  if (packages.length === 0) {
    return null;
  }

  packages.sort((a, b) => b.lastModified - a.lastModified);
  return packages[0] ?? null;
}

async function getLastModifiedTime(dirPath: string): Promise<number> {
  let maxTime = 0;

  try {
    const entries = await readdirRecursive(dirPath);

    for (const entry of entries) {
      const fullPath = resolve(dirPath, entry);
      if (!existsSync(fullPath)) {
        continue;
      }

      try {
        const stats = statSync(fullPath);
        const mtime = stats.mtimeMs;

        if (mtime > maxTime) {
          maxTime = mtime;
        }
      } catch {
        // Ignore files we can't stat
      }
    }
  } catch (error) {
    logger.warn(`Failed to read directory ${dirPath}: ${error}`);
  }

  return maxTime;
}

export function getPackagePath(packageName: string): string | null {
  return PACKAGE_PATH_MAP[packageName] ?? null;
}
