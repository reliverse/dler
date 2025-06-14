import path, { convertImportsAliasToRelative } from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";

import { applyMagicSpells } from "~/libs/sdk/sdk-impl/magic/ms-apply";
import { resolveAllCrossLibs } from "~/libs/sdk/sdk-impl/utils/resolve-cross-libs";

export async function dlerPostBuild(isDev: boolean) {
  /* ====================================
        EXPERIMENTAL POSTBUILD START
     ================================= */

  // Cross replacements
  await resolveAllCrossLibs();

  // Apply magic spells (this feature is for end-users only, so we call it when isDev=true)
  if (isDev) {
    await applyMagicSpells(["dist-jsr", "dist-npm", "dist-libs"]);
  }

  // Convert alias to relative paths
  relinka("log", "[processDistDirectory] dist-npm");
  await processDistDirectory("dist-npm", "~");
  relinka("log", "[processDistDirectory] dist-jsr");
  await processDistDirectory("dist-jsr", "~");

  /* ====================================
        EXPERIMENTAL POSTBUILD END
     ================================= */
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function processDistDirectory(dir: string, alias: string): Promise<string[]> {
  const modifiedFiles: string[] = [];
  try {
    const binDir = path.join(dir, "bin");
    const binDirExists = await directoryExists(binDir);
    if (binDirExists) {
      await convertImportsAliasToRelative({
        targetDir: binDir,
        aliasToReplace: alias,
        pathExtFilter: "js-ts-none",
        // displayLogsOnlyFor: [
        //   "dist-npm/bin/libs/cfg/cfg-mod.js",
        //   "dist-jsr/bin/libs/cfg/cfg-mod.ts",
        // ],
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka("internal", `Error processing ${dir}: ${errorMessage}`);
    throw error;
  }
  return modifiedFiles;
}
