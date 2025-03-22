import fs from "fs-extra";
import pMap from "p-map";
import path from "pathe";
import { readPackageJSON } from "pkg-types";
import semver from "semver";
import { glob } from "tinyglobby";

import type { BumpFilter, BumpMode } from "~/libs/sdk/sdk-types.js";

import { CONCURRENCY_DEFAULT, PROJECT_ROOT } from "./utils-consts.js";
import { readFileSafe, writeFileSafe } from "./utils-fs.js";
import { relinka } from "./utils-logs.js";

// ============================
// Version Bumping Functions
// ============================

const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/.cache/**",
  "**/tmp/**",
  "**/.temp/**",
  "**/package-lock.json",
  "**/pnpm-lock.yaml",
  "**/yarn.lock",
  "**/bun.lock",
];

// Regex factories for version updates
const createJsonVersionRegex = (oldVer: string): RegExp =>
  new RegExp(`"version"\\s*:\\s*"${oldVer}"`, "g");
const TS_VERSION_REGEXES = [
  (oldVer: string) =>
    new RegExp(`(export\\s+const\\s+version\\s*=\\s*["'])${oldVer}(["'])`, "g"),
  (oldVer: string) =>
    new RegExp(`(const\\s+version\\s*=\\s*["'])${oldVer}(["'])`, "g"),
  (oldVer: string) => new RegExp(`(version\\s*:\\s*["'])${oldVer}(["'])`, "g"),
  (oldVer: string) => new RegExp(`(VERSION\\s*=\\s*["'])${oldVer}(["'])`, "g"),
  (oldVer: string) =>
    new RegExp(
      `(export\\s+const\\s+cliVersion\\s*=\\s*["'])${oldVer}(["'])`,
      "g",
    ),
  (oldVer: string) =>
    new RegExp(`(const\\s+cliVersion\\s*=\\s*["'])${oldVer}(["'])`, "g"),
];

/**
 * Handles version bumping.
 */
export async function bumpHandler(
  bumpMode: BumpMode,
  bumpDisable: boolean,
  commonPubPause: boolean,
  bumpFilter: BumpFilter[],
): Promise<void> {
  if (bumpDisable || commonPubPause) {
    relinka(
      "info",
      "Skipping version bump because it is either `bumpDisable: true` or `commonPubPause: true` in your relidler config.",
    );
    return;
  }

  const pkgPath = path.resolve("package.json");
  if (!(await fs.pathExists(pkgPath))) {
    throw new Error("package.json not found");
  }
  const pkgJson = await readPackageJSON();
  if (!pkgJson.version) {
    throw new Error("No version field found in package.json");
  }
  const oldVersion = pkgJson.version;

  if (!semver.valid(oldVersion)) {
    throw new Error(`Invalid existing version in package.json: ${oldVersion}`);
  }
  relinka(
    "info",
    `Auto-incrementing version from ${oldVersion} using "${bumpMode}"`,
  );
  const incremented = autoIncrementVersion(oldVersion, bumpMode);
  if (oldVersion !== incremented) {
    await bumpVersions(oldVersion, incremented, bumpFilter);
    await setBumpDisabled(true, commonPubPause);
  } else {
    relinka("info", `Version is already at ${oldVersion}, no bump needed.`);
  }
}

/**
 * Updates the "bumpDisable" flag in the build configuration file.
 */
export async function setBumpDisabled(
  value: boolean,
  commonPubPause: boolean,
): Promise<void> {
  if (commonPubPause && value) {
    // Skipping bumpDisable toggle due to `commonPubPause: true`
    return;
  }

  const relidlerCfgTs = path.join(PROJECT_ROOT, "relidler.cfg.ts");
  const relidlerCfgJs = path.join(PROJECT_ROOT, "relidler.cfg.js");
  const relidlerCfgPath = (await fs.pathExists(relidlerCfgTs))
    ? relidlerCfgTs
    : relidlerCfgJs;

  if (!(await fs.pathExists(relidlerCfgPath))) {
    relinka(
      "info",
      "No relidler.cfg.ts or relidler.cfg.js found to update bumpDisable",
    );
    return;
  }

  let content = await readFileSafe(relidlerCfgPath, "", "bumpDisable update");
  content = content.replace(
    /bumpDisable\s*:\s*(true|false)/,
    `bumpDisable: ${value}`,
  );
  await writeFileSafe(relidlerCfgPath, content, "bumpDisable update");
}

/**
 * Auto-increments a semantic version based on the specified bumpMode.
 */
function autoIncrementVersion(
  oldVersion: string,
  bumpMode: "autoMajor" | "autoMinor" | "autoPatch",
): string {
  if (!semver.valid(oldVersion)) {
    throw new Error(`Can't auto-increment invalid version: ${oldVersion}`);
  }
  const releaseTypeMap = {
    autoMajor: "major",
    autoMinor: "minor",
    autoPatch: "patch",
  } as const;
  const newVer = semver.inc(oldVersion, releaseTypeMap[bumpMode]);
  if (!newVer) {
    throw new Error(`semver.inc failed for ${oldVersion} and mode ${bumpMode}`);
  }
  return newVer;
}

/**
 * Updates version strings in files based on file type and relative paths.
 */
async function bumpVersions(
  oldVersion: string,
  newVersion: string,
  bumpFilter: BumpFilter[] = [
    "package.json",
    "reliverse.jsonc",
    "reliverse.ts",
  ],
): Promise<void> {
  relinka(
    "verbose",
    `Starting bumpVersions from ${oldVersion} to ${newVersion}`,
  );
  try {
    // Create glob patterns based on the bumpFilter
    const filePatterns: string[] = [];

    // Add patterns for each filter type in a dynamic way
    if (bumpFilter.length > 0) {
      // Process each filter
      for (const filter of bumpFilter) {
        // Case 1: Relative path with separators
        if (filter.includes("/") || filter.includes("\\")) {
          filePatterns.push(`**/${filter}`);
          continue;
        }

        // Case 2: File with extension
        if (filter.includes(".")) {
          filePatterns.push(`**/${filter}`);
          continue;
        }

        // Case 3: File without extension
        filePatterns.push(`**/${filter}.*`);
      }

      relinka(
        "verbose",
        `Generated patterns from filters: ${filePatterns.join(", ")}`,
      );
    } else {
      // If no specific filters were provided, only process package.json as fallback
      filePatterns.push("**/package.json");
      relinka(
        "verbose",
        "No filters provided, falling back to only process package.json",
      );
    }

    // Always ignore these directories
    const ignorePatterns = [
      "**/node_modules/**",
      "**/.git/**",
      ...IGNORE_PATTERNS,
    ];

    // Try to read .gitignore file and add its patterns to the ignore list
    try {
      const gitignorePath = path.join(PROJECT_ROOT, ".gitignore");
      if (await fs.pathExists(gitignorePath)) {
        const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
        const gitignorePatterns = gitignoreContent
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"))
          .map((pattern) => {
            // Convert .gitignore patterns to glob patterns
            if (pattern.startsWith("/")) {
              // Pattern starting with / in gitignore means root-relative
              // Convert to a relative pattern but ensure it doesn't start with /
              return pattern.substring(1);
            } else if (pattern.endsWith("/")) {
              // Pattern ending with / matches directories
              return `**/${pattern}**`;
            } else {
              // Regular pattern
              return `**/${pattern}`;
            }
          });

        if (gitignorePatterns.length > 0) {
          relinka(
            "verbose",
            `Bump will not process ${gitignorePatterns.length} patterns listed in .gitignore`,
          );
          ignorePatterns.push(...gitignorePatterns);
        }
      }
    } catch (err) {
      relinka("verbose", `Could not process .gitignore: ${err}`);
    }

    // Get all matching files using tinyglobby
    const matchedFiles = await glob(filePatterns, {
      absolute: true,
      cwd: PROJECT_ROOT,
      dot: false, // Skip hidden files
      ignore: ignorePatterns,
    });

    relinka(
      "verbose",
      `Found ${matchedFiles.length} files to check for version bumping`,
    );

    // Process each file to update version
    let modifiedCount = 0;

    await pMap(
      matchedFiles,
      async (file) => {
        try {
          if (!(await fs.pathExists(file))) {
            relinka("verbose", `File does not exist (skipped): ${file}`);
            return;
          }

          const content = await readFileSafe(file, "", "bumpVersions");
          const modified = await updateVersionInContent(
            file,
            content,
            oldVersion,
            newVersion,
          );

          if (modified) {
            modifiedCount++;
            relinka("verbose", `Updated version in: ${file}`);
          }
        } catch (err) {
          relinka("error", `Error processing file ${file}: ${err}`);
        }
      },
      { concurrency: CONCURRENCY_DEFAULT },
    );

    if (modifiedCount > 0) {
      relinka(
        "success",
        `Updated version from ${oldVersion} to ${newVersion} in ${modifiedCount} file(s)`,
      );
    } else {
      relinka("warn", "No files were updated with the new version");
    }
  } catch (error) {
    relinka("error", "Failed to bump versions:", error);
    throw error;
  }
  relinka("verbose", "Exiting bumpVersions");
}

/**
 * Updates version strings in a file's content.
 */
async function updateVersionInContent(
  filePath: string,
  content: string,
  oldVersion: string,
  newVersion: string,
): Promise<boolean> {
  let updatedContent = content;
  let changed = false;

  if (/\.(json|jsonc|json5)$/.test(filePath)) {
    if (content.includes(`"version": "${oldVersion}"`)) {
      updatedContent = content.replace(
        createJsonVersionRegex(oldVersion),
        `"version": "${newVersion}"`,
      );
      changed = true;
    }
  } else if (filePath.endsWith(".ts")) {
    for (const regexFactory of TS_VERSION_REGEXES) {
      const regex = regexFactory(oldVersion);
      if (regex.test(updatedContent)) {
        updatedContent = updatedContent.replace(regex, `$1${newVersion}$2`);
        changed = true;
      }
    }
  }
  if (changed) {
    await writeFileSafe(filePath, updatedContent, "version update");
  }
  return changed;
}
