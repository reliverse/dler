import fs from "fs-extra";
import path from "pathe";

import type { NpmOutExt, Sourcemap } from "~/types.js";

import { relinka } from "./utils-logs.js";

// ============================
// Bundling Functions
// ============================

/**
 * Converts the transpileSourcemap option to a Bun-friendly value.
 * @returns "none", "inline", or "external".
 */
export function getBunSourcemapOption(
  transpileSourcemap: Sourcemap,
): "external" | "inline" | "none" {
  if (transpileSourcemap === "none" || transpileSourcemap === false)
    return "none";
  if (transpileSourcemap === "inline") return "inline";
  // For "linked", "external", or boolean true, return "external"
  return "external";
}

/**
 * Computes the Rollup transpileSourcemap option based on the given configuration.
 * @returns "inline" if inline is specified; true for linked/external or boolean true; otherwise false.
 */
export function getUnifiedSourcemapOption(
  transpileSourcemap: Sourcemap,
): "inline" | boolean {
  relinka(
    "commonVerbose",
    `Converting rollup transpileSourcemap option: ${transpileSourcemap}`,
  );
  switch (transpileSourcemap) {
    case "external":
    case "linked":
      return true;
    case "inline":
      return "inline";
    case "none":
      return false;
    default:
      return !!transpileSourcemap;
  }
}

/**
 * Renames the entry file to a standard name (main.js or main.ts).
 */
export async function renameEntryFile(
  isJsr: boolean,
  outDirBin: string,
  coreEntryFile: string,
  unifiedBundlerOutExt: NpmOutExt,
): Promise<{ updatedEntryFile: string }> {
  relinka(
    "commonVerbose",
    `Renaming entry file. Original: ${coreEntryFile} (isJsr=${isJsr})`,
  );

  // Get the base filename without directory path
  const entryBasename = path.basename(coreEntryFile);
  // Convert to output extension
  const outExt = unifiedBundlerOutExt || "js";
  const jsEntryFile = entryBasename.replace(/\.tsx?$/, `.${outExt}`);
  const coreEntryFileNoExt = jsEntryFile.split(".").slice(0, -1).join(".");

  // First check if the entry file exists in the output directory
  if (!(await fs.pathExists(path.join(outDirBin, jsEntryFile)))) {
    relinka(
      "error",
      `Entry file not found for renaming: ${path.join(outDirBin, jsEntryFile)}`,
    );
    return { updatedEntryFile: jsEntryFile };
  }

  // Handle declaration files if they exist
  if (!isJsr) {
    const declarationPath = path.join(outDirBin, `${coreEntryFileNoExt}.d.ts`);
    if (await fs.pathExists(declarationPath)) {
      await fs.rename(declarationPath, path.join(outDirBin, "main.d.ts"));
    }
  }

  // Rename the main file
  if (!isJsr) {
    await fs.rename(
      path.join(outDirBin, jsEntryFile),
      path.join(outDirBin, `main.${outExt}`),
    );
    coreEntryFile = `main.${outExt}`;
  } else if (entryBasename.endsWith(".ts")) {
    // For JSR, keep TypeScript extension
    if (await fs.pathExists(path.join(outDirBin, entryBasename))) {
      await fs.rename(
        path.join(outDirBin, entryBasename),
        path.join(outDirBin, "main.ts"),
      );
      coreEntryFile = "main.ts";
    } else {
      relinka(
        "warn",
        `JSR entry file not found for renaming: ${path.join(outDirBin, entryBasename)}. Skipping rename operation.`,
      );
      coreEntryFile = entryBasename;
    }
  }

  relinka(
    "info",
    `Renamed entry file to ${path.join(outDirBin, coreEntryFile)}`,
  );
  return { updatedEntryFile: coreEntryFile };
}
