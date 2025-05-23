import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";

import type { NpmOutExt, Sourcemap } from "~/libs/sdk/sdk-types.js";

// ============================
// Bundling Functions
// ============================

/**
 * Converts the Unified build sourcemap option to a Bun-friendly value.
 * @param transpileSourcemap - The sourcemap configuration ('none', 'inline', 'linked', 'external', true, false).
 * @returns "none", "inline", or "external" for Bun's bundler.
 */
export function getBunSourcemapOption(
  transpileSourcemap: Sourcemap,
): "external" | "inline" | "none" {
  relinka(
    "verbose",
    `Converting Bun sourcemap option from: ${transpileSourcemap}`,
  );
  switch (transpileSourcemap) {
    case "inline":
      return "inline";
    case "none":
    case false:
      return "none";
    default: // "linked" | "external" | true | any other truthy value
      return "external";
  }
}

/**
 * Converts the Unified build sourcemap option to a Rollup/Unified-bundler friendly value.
 * @param transpileSourcemap - The sourcemap configuration ('none', 'inline', 'linked', 'external', true, false).
 * @returns "inline" if inline is specified; true for linked/external or boolean true; otherwise false.
 */
export function getUnifiedSourcemapOption(
  transpileSourcemap: Sourcemap,
): "inline" | boolean {
  relinka(
    "verbose",
    `Converting Unified/Rollup sourcemap option from: ${transpileSourcemap}`,
  );
  switch (transpileSourcemap) {
    case "external":
    case "linked":
      return true; // Indicates separate sourcemap file
    case "inline":
      return "inline"; // Indicates inline sourcemap
    case "none":
    case false:
      return false; // No sourcemap
    default:
      // Handles boolean true explicitly, or any other truthy value
      return !!transpileSourcemap;
  }
}

/**
 * Renames the primary output file (and its declaration file, if applicable)
 * in the output directory to a standardized name (e.g., mod.js, mod.ts).
 *
 * @param isJsr - Flag indicating if the target platform is JSR.
 * @param outDirBin - The output directory where the compiled files reside.
 * @param originalEntryFileBasename - The base name (file name only) of the original entry file processed by the bundler.
 * @param unifiedBundlerOutExt - The file extension used for standard (non-JSR) builds (e.g., 'js', 'mjs').
 * @param distJsrOutFilesExt - The file extension used for JSR builds (likely 'ts' or 'js').
 * @returns An object containing the new base name of the entry file.
 * @throws If the expected source entry file is not found in the output directory.
 */
export async function renameEntryFile(
  isJsr: boolean,
  outDirBin: string,
  originalEntryFileBasename: string,
  unifiedBundlerOutExt: NpmOutExt,
  distJsrOutFilesExt: NpmOutExt,
): Promise<{ updatedEntryFile: string }> {
  relinka(
    "verbose",
    `Attempting to rename entry file. Original basename: ${originalEntryFileBasename}, Output Dir: ${outDirBin}, isJsr=${isJsr}`,
  );

  // 1. Determine Source and Target Basenames
  let sourceEntryBasename: string;
  let targetEntryBasename: string;
  let sourceDeclarationBasename: string | null = null;
  let targetDeclarationBasename: string | null = null;

  const outputExt = isJsr ? distJsrOutFilesExt : unifiedBundlerOutExt;
  const originalBasenameNoExt = originalEntryFileBasename
    .split(".")
    .slice(0, -1)
    .join(".");

  if (isJsr) {
    // JSR specifics: Keep .ts if original was .ts, otherwise use specified JSR ext
    if (originalEntryFileBasename.endsWith(".ts")) {
      sourceEntryBasename = originalEntryFileBasename; // e.g., index.ts
      targetEntryBasename = "mod.ts"; // Target for JSR TS file
    } else {
      // Handle cases where entry might be .js or .tsx -> outputExt
      sourceEntryBasename = `${originalBasenameNoExt}.${outputExt}`; // e.g., index.js
      targetEntryBasename = `mod.${outputExt}`; // e.g., mod.js
    }
  } else {
    // Standard NPM build specifics
    sourceEntryBasename = `${originalBasenameNoExt}.${outputExt}`; // e.g., index.js
    targetEntryBasename = `mod.${outputExt}`; // e.g., mod.js

    // Expect a corresponding .d.ts file for standard builds
    sourceDeclarationBasename = `${originalBasenameNoExt}.d.ts`; // e.g., index.d.ts
    targetDeclarationBasename = "mod.d.ts"; // Target declaration name
  }

  // 2. Define Full Paths
  const sourceEntryPath = path.join(outDirBin, sourceEntryBasename);
  const targetEntryPath = path.join(outDirBin, targetEntryBasename);
  const sourceDeclarationPath = sourceDeclarationBasename
    ? path.join(outDirBin, sourceDeclarationBasename)
    : null;
  const targetDeclarationPath = targetDeclarationBasename
    ? path.join(outDirBin, targetDeclarationBasename)
    : null;

  // 3. Check if Source Entry File Exists
  if (!(await fs.pathExists(sourceEntryPath))) {
    // Throw an error if the expected source file isn't there.
    throw new Error(
      `Entry file expected for renaming not found: ${sourceEntryPath}`,
    );
  }

  relinka(
    "verbose",
    `Found source entry file: ${sourceEntryPath}. Renaming to: ${targetEntryPath}`,
  );

  // 4. Rename Declaration File (if applicable)
  if (sourceDeclarationPath && targetDeclarationPath) {
    if (await fs.pathExists(sourceDeclarationPath)) {
      relinka(
        "verbose",
        `Renaming declaration ${sourceDeclarationPath} to ${targetDeclarationPath}`,
      );
      await fs.rename(sourceDeclarationPath, targetDeclarationPath);
    } else {
      relinka(
        "verbose",
        `Source declaration file not found, skipping rename: ${sourceDeclarationPath}`,
      );
    }
  }

  // 5. Rename Main Entry File
  if (sourceEntryPath !== targetEntryPath) {
    await fs.rename(sourceEntryPath, targetEntryPath);
    relinka("log", `Renamed entry file to ${targetEntryPath}`);
  } else {
    relinka(
      "log",
      `Source entry file ${sourceEntryPath} already has the target name. Skipping rename.`,
    );
  }

  // 6. Return the updated base name
  return { updatedEntryFile: targetEntryBasename };
}
