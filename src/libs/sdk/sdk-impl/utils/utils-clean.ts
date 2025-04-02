import fs from "fs-extra";
import pMap from "p-map";
import path from "pathe";

import type { LibConfig } from "~/libs/sdk/sdk-types.js";

import { CONCURRENCY_DEFAULT, PROJECT_ROOT } from "./utils-consts.js";
import { relinka } from "@reliverse/relinka";

/**
 * Recursively removes any existing distribution folders.
 */
export async function removeDistFolders(
  distNpmDirName: string,
  distJsrDirName: string,
  libsDirDist: string,
  libsList: Record<string, LibConfig>,
): Promise<boolean> {
  // Determine folders to remove based on config or use defaults
  const foldersToRemove: string[] = [];
  foldersToRemove.push(distNpmDirName);
  foldersToRemove.push(distJsrDirName);

  // Add libs dist dir if defined and at least one lib is configured
  if (libsList && Object.keys(libsList).length > 0) {
    foldersToRemove.push(libsDirDist);
  }

  const existingFolders: string[] = [];
  for (const folder of foldersToRemove) {
    const folderPath = path.resolve(PROJECT_ROOT, folder);
    if (await fs.pathExists(folderPath)) {
      existingFolders.push(folder);
    }
  }

  if (existingFolders.length > 0) {
    await pMap(
      existingFolders,
      async (folder) => {
        const folderPath = path.resolve(PROJECT_ROOT, folder);
        if (await fs.pathExists(folderPath)) {
          await fs.remove(folderPath);
          relinka("verbose", `Removed: ${folderPath}`);
        }
      },
      { concurrency: CONCURRENCY_DEFAULT },
    );
    relinka("success", "Distribution folders removed successfully");
  }

  return true;
}
