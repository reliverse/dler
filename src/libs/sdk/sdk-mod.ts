import { re } from "@reliverse/relico";
import { build as bunBuild } from "bun";
import { execaCommand } from "execa";
import fs from "fs-extra";
import pAll from "p-all";
import pMap from "p-map";
import { resolve } from "pathe";
import path from "pathe";
import {
  readPackageJSON,
  defineTSConfig,
  definePackageJSON,
  type PackageJson,
} from "pkg-types";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import semver from "semver";
import { glob } from "tinyglobby";

import type {
  BumpFilter,
  BumpMode,
  ExcludeMode,
  Format,
  LibConfig,
  Sourcemap,
  Target,
} from "~/types.js";
import type { Timer } from "~/utils.js";

import {
  createTimer,
  getElapsedTime,
  pauseTimer,
  relinka,
  resumeTimer,
} from "~/utils.js";

import type { UnifiedBuildConfig } from "./sdk-main.js";

import { loadConfig } from "./sdk-load.js";
import { build as unifiedBuild } from "./sdk-utils/build.js";
import {
  convertImportExtensionsJsToTs,
  convertImportPaths,
  extractPackageName,
} from "./sdk-utils/paths.js";
import { ensuredir } from "./sdk-utils/utils.js";

// ============================
// Temporary Debug Helpers
// ============================

const SHOW_VERBOSE = {
  readFileSafe: false,
  getDirectorySize: false,
};

const DEBUG_DISABLE = {
  unstable_convertImportPathsToPkgNames: true,
  unstable_copyExternalFilesToAddonsDir: true,
};

function disableFunction(funcName: keyof typeof DEBUG_DISABLE) {
  relinka("verbose", `[DEBUG_DISABLE] Skipping ${funcName}...`);
}

// ============================
// Constants & Global Setup
// ============================

// Default concurrency for parallel tasks
// TODO: Implement dynamic concurrency based on CPU count
const CONCURRENCY_DEFAULT = 2;

const tsconfigJson = "tsconfig.json";
const cliDomainDocs = "https://docs.reliverse.org";

const PROJECT_ROOT = path.resolve(process.cwd());
const TEST_FILE_PATTERNS = [
  "**/*.test.js",
  "**/*.test.ts",
  "**/*.test.d.ts",
  "**/*-temp.js",
  "**/*-temp.ts",
  "**/*-temp.d.ts",
  "**/__snapshots__/**",
];
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

// ============================
// Helper Functions & Utilities
// ============================

/**
 * Handles errors during the build process.
 */
function handleBuildError(error: unknown, timer: Timer): never {
  // Calculate elapsed time
  const elapsedTime = getElapsedTime(timer);
  const formattedTime = prettyMilliseconds(elapsedTime, { verbose: true });

  // Log detailed error information
  const errorStack =
    error instanceof Error ? error.stack : "No stack trace available";

  relinka(
    "error",
    `An unexpected error occurred after ${formattedTime}:`,
    error,
  );
  relinka("verbose", `Error details: ${errorStack}`);

  // Exit with error code
  process.exit(1);
}

/**
 * Reads a file safely and returns its content.
 */
async function readFileSafe(
  filePath: string,
  isJsr: boolean | "",
  reason: string,
): Promise<string> {
  const distName = determineDistName(filePath, isJsr);
  try {
    const content = await fs.readFile(filePath, "utf8");
    if (SHOW_VERBOSE.readFileSafe) {
      relinka(
        "verbose",
        `[${distName}] Successfully read file: ${filePath} [Reason: ${reason}]`,
      );
    }
    return content;
  } catch (error) {
    relinka(
      "error",
      `[${distName}] Failed to read file: ${filePath} [Reason: ${reason}]`,
      error,
    );
    throw error;
  }
}

/**
 * Writes content to a file safely.
 */
async function writeFileSafe(
  filePath: string,
  content: string,
  reason: string,
): Promise<void> {
  relinka("verbose", `Attempting to write file: ${filePath}`);
  try {
    await fs.writeFile(filePath, content, "utf8");
    relinka(
      "verbose",
      `Successfully wrote file: ${filePath} [Reason: ${reason}]`,
    );
  } catch (error) {
    relinka(
      "error",
      `Failed to write file: ${filePath} [Reason: ${reason}]`,
      error,
    );
    throw error;
  }
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
  relinka(
    "verbose",
    `Entering updateVersionInContent for file: ${filePath} (old: ${oldVersion}, new: ${newVersion})`,
  );
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
    relinka("info", `Updated version in ${filePath}`);
  }
  return changed;
}

/**
 * Runs an async function within a given working directory,
 * ensuring that the original directory is restored afterward.
 */
async function withWorkingDirectory<T>(
  targetDir: string,
  fn: () => Promise<T>,
): Promise<T> {
  relinka("verbose", `Entering withWorkingDirectory, targetDir: ${targetDir}`);
  const originalDir = process.cwd();
  try {
    process.chdir(targetDir);
    relinka("verbose", `Changed working directory to: ${targetDir}`);
    const result = await fn();
    return result;
  } catch (error) {
    relinka("error", `Error in directory ${targetDir}:`, error);
    throw error;
  } finally {
    process.chdir(originalDir);
    relinka("verbose", `Restored working directory to: ${originalDir}`);
  }
}

// ============================
// File & Directory Utilities
// ============================

/**
 * Recursively removes any existing distribution folders.
 */
export async function removeDistFolders(
  npmDistDir: string,
  jsrDistDir: string,
  libsDistDir: string,
  libs: Record<string, LibConfig>,
): Promise<boolean> {
  relinka("verbose", "Starting removeDistFolders");

  // Determine folders to remove based on config or use defaults
  const foldersToRemove: string[] = [];
  foldersToRemove.push(npmDistDir);
  foldersToRemove.push(jsrDistDir);

  // Add libs dist dir if defined and at least one lib is configured
  if (libs && Object.keys(libs).length > 0) {
    foldersToRemove.push(libsDistDir);
  }

  const existingFolders: string[] = [];
  for (const folder of foldersToRemove) {
    const folderPath = path.resolve(PROJECT_ROOT, folder);
    if (await fs.pathExists(folderPath)) {
      existingFolders.push(folder);
    }
  }

  if (existingFolders.length > 0) {
    relinka(
      "verbose",
      `Found existing distribution folders: ${existingFolders.join(", ")}`,
    );
    await pMap(
      existingFolders,
      async (folder) => {
        const folderPath = path.resolve(PROJECT_ROOT, folder);
        if (await fs.pathExists(folderPath)) {
          await fs.remove(folderPath);
          relinka("verbose", `Removed: ${folderPath}`);
        }
      },
      { concurrency: 3 },
    );
    relinka("success", "Distribution folders removed successfully");
  }

  relinka("verbose", "Exiting removeDistFolders");
  return true;
}

/**
 * Finds a file in the current directory regardless of case.
 */
async function findFileCaseInsensitive(
  targetFile: string,
): Promise<string | null> {
  const files = await fs.readdir(".");
  const found = files.find(
    (file) => file.toLowerCase() === targetFile.toLowerCase(),
  );
  return found || null;
}

/**
 * Copies specified files from the root directory to the output directory.
 * Handles special cases for certain files and supports parallel processing.
 */
async function copyFileFromRoot(
  outdirRoot: string,
  fileNames: (
    | "README.md"
    | "LICENSE"
    | ".gitignore"
    | "drizzle.config.ts"
    | "schema.json"
    | "reliverse.jsonc"
  )[],
): Promise<void> {
  try {
    // Ensure output directory exists
    await fs.ensureDir(outdirRoot);

    // Define special file handling configurations
    const specialFileHandlers: Record<
      string,
      {
        variants?: string[];
        outputName?: string;
      }
    > = {
      "README.md": {},
      LICENSE: {
        variants: ["LICENSE", "LICENSE.md"],
        outputName: "LICENSE",
      },
    };

    // Process files in parallel with concurrency limit
    await pMap(
      fileNames,
      async (fileName) => {
        try {
          const specialConfig = specialFileHandlers[fileName];

          if (specialConfig?.variants) {
            // Handle files with variants (like LICENSE)
            for (const variant of specialConfig.variants) {
              const file = await findFileCaseInsensitive(variant);
              if (file) {
                const outputName = specialConfig.outputName || fileName;
                await fs.copy(file, path.join(outdirRoot, outputName));
                relinka(
                  "verbose",
                  `Copied ${file} to ${outdirRoot}/${outputName}`,
                );
                break;
              }
            }
          } else {
            // Handle standard files
            const file = await findFileCaseInsensitive(fileName);
            if (file) {
              await fs.copy(file, path.join(outdirRoot, fileName));
              relinka("verbose", `Copied ${file} to ${outdirRoot}/${fileName}`);
            }
          }
        } catch (fileError) {
          relinka("error", `Failed to copy ${fileName}: ${fileError}`);
        }
      },
      { concurrency: 4 }, // Process up to 4 files simultaneously
    );
  } catch (error) {
    relinka("error", `Failed to copy files: ${error}`);
    throw new Error(`File copying failed: ${error}`);
  }
}

/**
 * Deletes specific test and temporary files from a given directory.
 */
async function deleteSpecificFiles(outdirBin: string): Promise<void> {
  relinka("verbose", `Deleting test and temporary files in: ${outdirBin}`);
  const files = await glob(TEST_FILE_PATTERNS, {
    cwd: outdirBin,
    absolute: true,
  });
  const snapshotDirs = await glob("**/__snapshots__", {
    cwd: outdirBin,
    absolute: true,
    onlyDirectories: true,
  });
  const filesToDelete = files.filter((file) => {
    if (file.endsWith(".d.ts")) {
      return file.includes(".test.d.ts") || file.includes("-temp.d.ts");
    }
    return true;
  });
  if (filesToDelete.length > 0) {
    await pMap(filesToDelete, async (file) => fs.remove(file), {
      concurrency: CONCURRENCY_DEFAULT,
    });
    relinka("verbose", `Deleted files:\n${filesToDelete.join("\n")}`);
  }
  if (snapshotDirs.length > 0) {
    await pMap(snapshotDirs, async (dir) => fs.remove(dir), {
      concurrency: CONCURRENCY_DEFAULT,
    });
    relinka(
      "info",
      `Deleted snapshot directories:\n${snapshotDirs.join("\n")}`,
    );
  }
}

// ============================
// Version Bumping Functions
// ============================

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
    `Starting bumpVersions from ${oldVersion} to ${newVersion} with filters: ${bumpFilter.join(", ")}`,
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
      const gitignorePath = path.join(process.cwd(), ".gitignore");
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
            `Adding ${gitignorePatterns.length} patterns from .gitignore`,
          );
          ignorePatterns.push(...gitignorePatterns);
        }
      }
    } catch (err) {
      relinka("verbose", `Could not process .gitignore: ${err}`);
    }

    // Get all matching files using tinyglobby
    const matchedFiles = await glob(filePatterns, {
      cwd: process.cwd(),
      absolute: true,
      ignore: ignorePatterns,
      dot: false, // Skip hidden files
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
 * Auto-increments a semantic version based on the specified bumpMode.
 */
function autoIncrementVersion(
  oldVersion: string,
  bumpMode: "autoPatch" | "autoMinor" | "autoMajor",
): string {
  relinka(
    "verbose",
    `Auto incrementing version ${oldVersion} using mode: ${bumpMode}`,
  );
  if (!semver.valid(oldVersion)) {
    throw new Error(`Can't auto-increment invalid version: ${oldVersion}`);
  }
  const releaseTypeMap = {
    autoPatch: "patch",
    autoMinor: "minor",
    autoMajor: "major",
  } as const;
  const newVer = semver.inc(oldVersion, releaseTypeMap[bumpMode]);
  if (!newVer) {
    throw new Error(`semver.inc failed for ${oldVersion} and mode ${bumpMode}`);
  }
  relinka("verbose", `Auto incremented version: ${newVer}`);
  return newVer;
}

/**
 * Updates the "disableBump" flag in the build configuration file.
 */
export async function setBumpDisabled(
  value: boolean,
  pausePublish: boolean,
): Promise<void> {
  relinka("verbose", `Entering setBumpDisabled with value: ${value}`);

  if (pausePublish && value) {
    relinka(
      "verbose",
      "Skipping disableBump toggle due to `pausePublish: true`",
    );
    return;
  }

  const tsConfigPath = path.join(PROJECT_ROOT, "relidler.cfg.ts");
  const jsConfigPath = path.join(PROJECT_ROOT, "relidler.cfg.js");
  const configPath = (await fs.pathExists(tsConfigPath))
    ? tsConfigPath
    : jsConfigPath;

  if (!(await fs.pathExists(configPath))) {
    relinka(
      "info",
      "No relidler.cfg.ts or relidler.cfg.js found to update disableBump",
    );
    return;
  }

  let content = await readFileSafe(configPath, "", "disableBump update");
  content = content.replace(
    /disableBump\s*:\s*(true|false)/,
    `disableBump: ${value}`,
  );
  await writeFileSafe(configPath, content, "disableBump update");
}

/**
 * Handles version bumping.
 */
export async function bumpHandler(
  bumpMode: BumpMode,
  disableBump: boolean,
  pausePublish: boolean,
  bumpFilter: BumpFilter[],
): Promise<void> {
  if (disableBump || pausePublish) {
    relinka(
      "info",
      "Skipping version bump because it is either `disableBump: true` or `pausePublish: true` in your relidler config.",
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
    await setBumpDisabled(true, pausePublish);
  } else {
    relinka("info", `Version is already at ${oldVersion}, no bump needed.`);
  }
}

// ============================
// Package & TSConfig Generation
// ============================

/**
 * Creates common package.json fields based on the original package.json.
 */
async function createCommonPackageFields(
  isCLI: boolean,
): Promise<Partial<PackageJson>> {
  relinka("verbose", "Generating common package fields");
  const originalPkg = await readPackageJSON();
  const { name, author, version, license, description, keywords } = originalPkg;

  relinka("verbose", `Original package name: "${name}", version: "${version}"`);

  const pkgHomepage = cliDomainDocs;
  const commonPkg: Partial<PackageJson> = {
    name,
    version,
    license: license || "MIT",
    description,
    homepage: pkgHomepage,
    dependencies: originalPkg.dependencies || {},
    type: "module",
  };

  if (isCLI) {
    relinka(
      "verbose",
      "isCLI is true, adding CLI-specific fields to common package fields",
    );
    if (commonPkg.keywords) {
      const cliCommandName = name?.startsWith("@")
        ? name.split("/").pop() || "cli"
        : name || "relidler";
      relinka(
        "verbose",
        `Adding CLI keywords to existing keywords, CLI command name: "${cliCommandName}"`,
      );
      commonPkg.keywords = [
        ...new Set([
          ...commonPkg.keywords,
          "cli",
          "command-line",
          cliCommandName,
        ]),
      ];
      relinka(
        "verbose",
        `Updated keywords: ${JSON.stringify(commonPkg.keywords)}`,
      );
    } else if (name) {
      const cliCommandName = name.startsWith("@")
        ? name.split("/").pop() || "cli"
        : name;
      relinka(
        "verbose",
        `Setting new CLI keywords, CLI command name: "${cliCommandName}"`,
      );
      commonPkg.keywords = ["cli", "command-line", cliCommandName];
      relinka("verbose", `Set keywords: ${JSON.stringify(commonPkg.keywords)}`);
    }
  } else {
    relinka("verbose", "isCLI is false, skipping CLI-specific fields");
  }

  if (author) {
    const repoOwner = typeof author === "string" ? author : author.name;
    const repoName = name
      ? name.startsWith("@")
        ? name.split("/").pop() || name
        : name
      : "";
    Object.assign(commonPkg, {
      author,
      repository: {
        type: "git",
        url: `git+https://github.com/${repoOwner}/${repoName}.git`,
      },
      bugs: {
        url: `https://github.com/${repoOwner}/${repoName}/issues`,
        email: "blefnk@gmail.com",
      },
      keywords: [...new Set([...(commonPkg.keywords || []), repoOwner])],
    });
  } else if (keywords && keywords.length > 0 && !commonPkg.keywords) {
    commonPkg.keywords = keywords;
  }

  relinka("verbose", "Common package fields generated");
  return commonPkg;
}

/**
 * Filters out development dependencies from a dependency record.
 */
async function filterDeps(
  deps: Record<string, string> | undefined,
  clearUnused: boolean,
  outdirBin: string,
  isJsr: boolean,
  excludeMode: ExcludeMode,
  excludedDependencyPatterns: string[],
): Promise<Record<string, string>> {
  relinka("verbose", `Filtering dependencies (clearUnused=${clearUnused})`);
  if (!deps) return {};

  // Function to check if a dependency should be excluded based on patterns
  const shouldExcludeByPattern = (depName: string) => {
    return excludedDependencyPatterns.some((pattern) =>
      depName.toLowerCase().includes(pattern.toLowerCase()),
    );
  };

  // Read the original package.json to determine if we're dealing with devDependencies
  const originalPkg = await readPackageJSON();

  // Function to determine if a dependency should be excluded based on the excludeMode
  const shouldExcludeDep = (depName: string, isDev: boolean) => {
    if (excludeMode === "patterns-only") {
      // Only exclude dependencies matching patterns, regardless if they're dev dependencies
      return shouldExcludeByPattern(depName);
    }
    if (excludeMode === "patterns-and-devdeps") {
      // Exclude both dev dependencies and dependencies matching patterns
      return isDev || shouldExcludeByPattern(depName);
    }
    // Default fallback (should not happen with proper typing)
    return shouldExcludeByPattern(depName);
  };

  // Check if we're filtering dependencies or devDependencies
  // We assume if the deps object is from package.devDependencies, isDev should be true
  const isDev = deps === originalPkg.devDependencies;

  if (!clearUnused) {
    const filtered = Object.entries(deps).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        if (!shouldExcludeDep(k, isDev)) {
          acc[k] = v;
        }
        return acc;
      },
      {},
    );
    relinka(
      "verbose",
      `Filtered dependencies count: ${Object.keys(filtered).length}`,
    );
    return filtered;
  }

  const files = await glob("**/*.{js,ts}", {
    cwd: outdirBin,
    absolute: true,
  });
  const usedPackages = new Set<string>();
  for (const file of files) {
    const content = await readFileSafe(file, isJsr, "filterDeps");
    const importMatches = content.matchAll(
      /from\s+['"](\.|\.\/|\.\\)?src(\/|\\)/g,
    );
    for (const match of importMatches) {
      const importPath = match[1];
      const pkg = extractPackageName(importPath);
      if (pkg) {
        usedPackages.add(pkg);
      }
    }
  }
  const filtered = Object.entries(deps).reduce<Record<string, string>>(
    (acc, [k, v]) => {
      if (usedPackages.has(k) && !shouldExcludeDep(k, isDev)) {
        acc[k] = v;
      }
      return acc;
    },
    {},
  );
  relinka(
    "verbose",
    `Filtered dependencies count (after usage check): ${Object.keys(filtered).length}`,
  );
  return filtered;
}

/**
 * Gets dependencies for a lib based on the LibConfig dependencies field.
 *
 * @returns A filtered record of dependencies
 */
async function getLibDependencies(
  libName: string,
  originalDeps: Record<string, string> | undefined,
  outdirBin: string,
  isJsr: boolean,
  libConfig: LibConfig,
  excludeMode: ExcludeMode,
  excludedDependencyPatterns: string[],
): Promise<Record<string, string>> {
  relinka("verbose", `Getting lib dependencies for: ${libName}`);
  if (!originalDeps) return {};

  // Check if the lib has a dependencies configuration
  if (!libConfig) {
    // Default behavior - filter based on usage
    const result = await filterDeps(
      originalDeps,
      true,
      outdirBin,
      isJsr,
      excludeMode,
      excludedDependencyPatterns,
    );
    relinka(
      "verbose",
      `Lib ${libName} dependencies filtered by usage, count: ${Object.keys(result).length}`,
    );
    return result;
  }

  // If dependencies is true, include all dependencies from the original package.json
  if (libConfig.dependencies === true) {
    relinka("info", `Including all dependencies for lib ${libName}`);

    // Read the original package.json to determine if we're dealing with devDependencies
    const originalPkg = await readPackageJSON();
    const isDev = originalDeps === originalPkg.devDependencies;

    const result = Object.entries(originalDeps).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        // Determine if the dependency should be excluded based on the excludeMode
        let shouldExclude = false;

        if (excludeMode === "patterns-only") {
          // Only exclude dependencies matching patterns
          shouldExclude = excludedDependencyPatterns.some((pattern) =>
            k.toLowerCase().includes(pattern.toLowerCase()),
          );
        } else if (excludeMode === "patterns-and-devdeps") {
          // Exclude both dev dependencies and dependencies matching patterns
          shouldExclude =
            isDev ||
            excludedDependencyPatterns.some((pattern) =>
              k.toLowerCase().includes(pattern.toLowerCase()),
            );
        }

        if (!shouldExclude) {
          acc[k] = v;
        }
        return acc;
      },
      {},
    );
    return result;
  }

  // If dependencies is an array, only include those specific dependencies
  if (Array.isArray(libConfig.dependencies)) {
    relinka(
      "info",
      `Including specific dependencies for lib ${libName}: ${libConfig.dependencies.join(", ")}`,
    );
    const result = Object.entries(originalDeps).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        if (
          Array.isArray(libConfig.dependencies) &&
          libConfig.dependencies.includes(k)
        ) {
          acc[k] = v;
        }
        return acc;
      },
      {},
    );
    return result;
  }

  // Default behavior - filter based on usage
  const result = await filterDeps(
    originalDeps,
    true,
    outdirBin,
    isJsr,
    excludeMode,
    excludedDependencyPatterns,
  );
  relinka(
    "verbose",
    `Default filtering for lib ${libName} done, count: ${Object.keys(result).length}`,
  );
  return result;
}

/**
 * Creates a package.json for the main distribution.
 */
async function createPackageJSON(
  outdirRoot: string,
  isJsr: boolean,
  isCLI: boolean,
  npmOutFilesExt: string,
  excludeMode: ExcludeMode,
  excludedDependencyPatterns: string[],
): Promise<void> {
  relinka(
    "info",
    `Generating distribution package.json and tsconfig.json (isJsr=${isJsr})...`,
  );
  const commonPkg = await createCommonPackageFields(isCLI);
  const originalPkg = await readPackageJSON();
  const packageName = originalPkg.name || "";
  const cliCommandName = packageName.startsWith("@")
    ? packageName.split("/").pop() || "cli"
    : packageName;

  relinka(
    "verbose",
    `Package name: "${packageName}", CLI command name: "${cliCommandName}", isCLI: ${isCLI}`,
  );

  const outdirBin = path.join(outdirRoot, "bin");
  const outExt = npmOutFilesExt || "js";

  if (isJsr) {
    // For JSR, we need to handle bin entries with .ts extension
    const binEntry = isCLI ? { [cliCommandName]: "bin/main.ts" } : undefined;

    if (isCLI) {
      relinka(
        "verbose",
        `Adding CLI bin entry for JSR: { "${cliCommandName}": "bin/main.ts" }`,
      );
    }

    const jsrPkg = definePackageJSON({
      ...commonPkg,
      exports: {
        ".": "./bin/main.ts",
      },
      bin: binEntry,
      dependencies: await filterDeps(
        originalPkg.dependencies,
        false,
        outdirBin,
        isJsr,
        excludeMode,
        excludedDependencyPatterns,
      ),
      devDependencies: await filterDeps(
        originalPkg.devDependencies,
        false,
        outdirBin,
        isJsr,
        excludeMode,
        excludedDependencyPatterns,
      ),
    });
    await fs.writeJSON(path.join(outdirRoot, "package.json"), jsrPkg, {
      spaces: 2,
    });

    if (isCLI) {
      relinka(
        "verbose",
        `JSR package.json created with CLI bin entry: ${JSON.stringify(jsrPkg.bin)}`,
      );
    }
  } else {
    const binEntry = isCLI
      ? { [cliCommandName]: `bin/main.${outExt}` }
      : undefined;

    if (isCLI) {
      relinka(
        "verbose",
        `Adding CLI bin entry for NPM: { "${cliCommandName}": "bin/main.${outExt}" }`,
      );
    }

    const npmPkg = definePackageJSON({
      ...commonPkg,
      main: `./bin/main.${outExt}`,
      module: `./bin/main.${outExt}`,
      exports: {
        ".": `./bin/main.${outExt}`,
      },
      bin: binEntry,
      files: ["bin", "package.json", "README.md", "LICENSE"],
      publishConfig: { access: "public" },
      dependencies: await filterDeps(
        originalPkg.dependencies,
        false,
        outdirBin,
        isJsr,
        excludeMode,
        excludedDependencyPatterns,
      ),
      devDependencies: await filterDeps(
        originalPkg.devDependencies,
        false,
        outdirBin,
        isJsr,
        excludeMode,
        excludedDependencyPatterns,
      ),
    });
    await fs.writeJSON(path.join(outdirRoot, "package.json"), npmPkg, {
      spaces: 2,
    });

    if (isCLI) {
      relinka(
        "verbose",
        `NPM package.json created with CLI bin entry: ${JSON.stringify(npmPkg.bin)}`,
      );
    }
  }
  relinka("verbose", `Created package.json in ${outdirRoot}`);
}

/**
 * Creates a tsconfig.json file for the distribution.
 */
async function createTSConfig(
  outdirRoot: string,
  allowImportingTsExtensions: boolean,
): Promise<void> {
  relinka(
    "verbose",
    `Creating tsconfig.json in ${outdirRoot} (allowImportingTsExtensions=${allowImportingTsExtensions})`,
  );
  const tsConfig = defineTSConfig({
    compilerOptions: {
      allowImportingTsExtensions,
      esModuleInterop: true,
      skipLibCheck: true,
      target: "ESNext",
      lib: ["ESNext"],
      allowJs: true,
      resolveJsonModule: true,
      moduleDetection: "force",
      isolatedModules: true,
      verbatimModuleSyntax: true,
      strict: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
      module: "NodeNext",
      moduleResolution: "nodenext",
      noEmit: true,
      exactOptionalPropertyTypes: false,
      noFallthroughCasesInSwitch: false,
      noImplicitAny: false,
      noImplicitReturns: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      strictNullChecks: false,
    },
    include: ["./bin/**/*.ts"],
    exclude: ["**/node_modules"],
  });
  await fs.writeJSON(path.join(outdirRoot, tsconfigJson), tsConfig, {
    spaces: 2,
  });
  relinka("verbose", `Created tsconfig.json in ${outdirRoot}`);
}

/**
 * Determines the distribution name based on the file path and build type.
 * This function is used for logging and determining output paths.
 *
 * @returns The distribution name in the format of:
 *   - For empty isJsr: "root"
 *   - For regular builds: "dist-jsr" or "dist-npm"
 *   - For library builds: "dist-libs/{lib-name}/jsr" or "dist-libs/{lib-name}/npm"
 */
function determineDistName(filePath: string, isJsr: boolean | ""): string {
  // If isJsr is an empty string, return "root"
  if (isJsr === "") {
    return "root";
  }

  // First determine the base distribution type based on isJsr flag
  const baseDistName = isJsr ? "dist-jsr" : "dist-npm";

  // Check if this is a library path by looking for "/libs/" or "\libs\" in the path
  const isLibraryPath =
    filePath.includes("/libs/") || filePath.includes("\\libs\\");

  if (!isLibraryPath) {
    // For non-library paths, just return the base distribution name
    return baseDistName;
  }

  // For library paths, extract the library name and create a specialized path
  const libPathRegex = /[/\\]libs[/\\]([^/\\]+)/;
  const libPathResult = libPathRegex.exec(filePath);
  const libName = libPathResult?.[1];

  if (!libName) {
    // If we couldn't extract a library name for some reason, fall back to the base name
    return baseDistName;
  }

  // Return the specialized library distribution path
  return isJsr ? `dist-libs/${libName}/jsr` : `dist-libs/${libName}/npm`;
}

/**
 * Renames .tsx files by replacing the .tsx extension with -tsx.txt.
 */
async function renameTsxFiles(dir: string): Promise<void> {
  relinka("verbose", `Renaming .tsx files in directory: ${dir}`);
  const files = await glob(["**/*.tsx"], {
    cwd: dir,
    absolute: true,
  });
  await pMap(
    files,
    async (filePath) => {
      const newPath = filePath.replace(/\.tsx$/, "-tsx.txt");
      await fs.rename(filePath, newPath);
      relinka("verbose", `Renamed: ${filePath} -> ${newPath}`);
    },
    { concurrency: 10 },
  );
  relinka("verbose", `Completed renaming .tsx files in ${dir}`);
}

/**
 * Generates a jsr.jsonc configuration file for JSR distributions.
 */
async function createJsrJSONC(
  outdirRoot: string,
  isLib: boolean,
  projectName?: string,
): Promise<void> {
  relinka(
    "verbose",
    `Creating jsr.jsonc configuration (project: ${projectName}, isLib: ${isLib})`,
  );
  const originalPkg = await readPackageJSON();
  let { name, description } = originalPkg;
  const { author, version, license } = originalPkg;
  if (isLib) {
    name = projectName;
    description = "A helper lib for the Reliverse CLI";
  }
  const pkgHomepage = cliDomainDocs;
  const jsrConfig = {
    name,
    author,
    version,
    license: license || "MIT",
    description,
    homepage: pkgHomepage,
    exports: "./bin/main.ts",
    publish: {
      exclude: ["!.", "node_modules/**", ".env"],
    },
  };
  await fs.writeJSON(path.join(outdirRoot, "jsr.jsonc"), jsrConfig, {
    spaces: 2,
  });
  relinka("verbose", "Generated jsr.jsonc file");
}

/**
 * Calculates the total size (in bytes) of a directory.
 */
async function getDirectorySize(
  outdirRoot: string,
  isDev: boolean,
): Promise<number> {
  if (SHOW_VERBOSE.getDirectorySize) {
    relinka("verbose", `Calculating directory size for: ${outdirRoot}`);
  }
  try {
    const files = await fs.readdir(outdirRoot);
    const sizes = await pMap(
      files,
      async (file) => {
        const fp = path.join(outdirRoot, file);
        const stats = await fs.stat(fp);
        return stats.isDirectory() ? getDirectorySize(fp, isDev) : stats.size;
      },
      { concurrency: CONCURRENCY_DEFAULT },
    );
    const totalSize = sizes.reduce((total, s) => total + s, 0);
    if (SHOW_VERBOSE.getDirectorySize) {
      relinka(
        "verbose",
        `Calculated directory size: ${totalSize} bytes for ${outdirRoot}`,
      );
    }
    return totalSize;
  } catch (error) {
    relinka(
      "error",
      `Failed to calculate directory size for ${outdirRoot}`,
      error,
    );
    return 0;
  }
}

function logFoundImport(
  importPath: string,
  libName: string,
  isJsr: boolean,
  processedFilePath: string,
) {
  // Determine the distribution type based on the file path
  const distName = determineDistName(processedFilePath, isJsr);
  // Log the import found
  relinka(
    "verbose",
    `[${distName}] Found import from another lib: ${importPath} -> ${libName} (in ${processedFilePath})`,
  );
}

/**
 * Process files in a directory with a transformation function.
 * @returns Number of files modified
 */
async function processFilesInDirectory(
  isJsr: boolean | "",
  dir: string,
  filePatterns: string[],
  processFileFn: (
    file: string,
    content: string,
  ) => Promise<{ modified: boolean; newContent?: string }>,
  options: { concurrency?: number; ignore?: string[] } = {},
): Promise<number> {
  if (!(await fs.pathExists(dir))) {
    relinka("verbose", `Directory does not exist (skipped): ${dir}`);
    return 0;
  }

  const files = await glob(filePatterns, {
    cwd: dir,
    absolute: true,
    ignore: options.ignore,
  });

  if (files.length === 0) {
    relinka("verbose", `No matching files found in: ${dir}`);
    return 0;
  }

  const concurrency = options.concurrency || CONCURRENCY_DEFAULT;

  const modifiedResults = await pMap(
    files,
    async (file) => {
      try {
        if (!(await fs.pathExists(file))) {
          relinka("verbose", `File does not exist (skipped): ${file}`);
          return 0;
        }

        const content = await readFileSafe(
          file,
          isJsr,
          "processFilesInDirectory",
        );
        const { modified, newContent } = await processFileFn(file, content);

        if (modified && newContent) {
          await writeFileSafe(file, newContent, "processFilesInDirectory");
          relinka("verbose", `Processed file: ${file}`);
          return 1;
        }
        return 0;
      } catch (error: any) {
        if (error.code === "ENOENT") {
          relinka(
            "info",
            `File not found during processing (skipped): ${file}`,
          );
          return 0;
        }
        relinka(
          "error",
          `Error processing file ${file}: ${error.message || String(error)}`,
        );
        return 0;
      }
    },
    { concurrency },
  );

  return modifiedResults.reduce<number>((acc, curr) => acc + curr, 0);
}

/**
 * Recursively counts the number of files in a directory.
 */
export async function outdirBinFilesCount(outdirBin: string): Promise<number> {
  relinka("verbose", `Counting files in directory: ${outdirBin}`);
  let fileCount = 0;
  if (!(await fs.pathExists(outdirBin))) {
    relinka(
      "error",
      `[outdirBinFilesCount] Directory does not exist: ${outdirBin}`,
    );
    return fileCount;
  }
  async function traverse(dir: string) {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        await traverse(fullPath);
      } else if (stats.isFile()) {
        fileCount++;
      }
    }
  }
  await traverse(outdirBin);
  relinka("verbose", `Total file count in ${outdirBin}: ${fileCount}`);
  return fileCount;
}

/**
 * Converts the sourcemap option to a Bun-friendly value.
 * @returns "none", "inline", or "external".
 */
export function getBunSourcemapOption(
  sourcemap: boolean | "inline" | "none" | "linked" | "external",
): "none" | "inline" | "external" {
  if (sourcemap === "none" || sourcemap === false) return "none";
  if (sourcemap === "inline") return "inline";
  // For "linked", "external", or boolean true, return "external"
  return "external";
}

// ============================
// Bundling Functions
// ============================

/**
 * Bundles using Bun for regular (non-library) projects.
 */
async function regular_bundleUsingBun(
  entryFile: string,
  outdirBin: string,
  target: Target,
  format: Format,
  splitting: boolean,
  minify: boolean,
  sourcemap: Sourcemap,
  publicPath: string,
  packageName = "",
): Promise<void> {
  const startTime = performance.now();
  relinka(
    "verbose",
    `Bundling regular project using Bun for ${packageName || "main project"} (entry: ${entryFile}, outdir: ${outdirBin})`,
  );

  if (!(await fs.pathExists(entryFile))) {
    relinka("error", `Could not find entry file at: ${entryFile}`);
    throw new Error(`Entry file not found: ${entryFile}`);
  }

  try {
    const buildResult = await bunBuild({
      entrypoints: [entryFile],
      outdir: outdirBin,
      target: target,
      format: format,
      splitting: splitting,
      minify: minify,
      sourcemap: getBunSourcemapOption(sourcemap),
      throw: true,
      naming: {
        entry: "[dir]/[name]-[hash].[ext]",
        chunk: "[name]-[hash].[ext]",
        asset: "[name]-[hash].[ext]",
      },
      publicPath: publicPath || "/",
      define: {
        "process.env.NODE_ENV": JSON.stringify(
          process.env.NODE_ENV || "production",
        ),
      },
      banner: "/* Bundled by @reliverse/relidler */",
      footer: "/* End of bundle */",
      drop: ["debugger"],
    });

    const duration = performance.now() - startTime;
    const formattedDuration = prettyMilliseconds(duration, { verbose: true });
    relinka(
      "success",
      `Regular bun build completed in ${formattedDuration} with ${buildResult.outputs.length} output file(s).`,
    );

    if (buildResult.logs && buildResult.logs.length > 0) {
      buildResult.logs.forEach((log, index) => {
        relinka("verbose", `Log ${index + 1}: ${JSON.stringify(log)}`);
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `Regular build failed while using bun bundler: ${errorMessage}`,
    );

    // Provide more context in the error message
    const enhancedError = new Error(
      `Regular bundle failed for ${outdirBin}: ${errorMessage}`,
    );
    if (error instanceof Error && error.stack) {
      enhancedError.stack = error.stack;
    }

    throw enhancedError;
  }
}

/**
 * Bundles using Bun for library projects.
 */
async function library_bundleUsingBun(
  entryFile: string,
  outdirBin: string,
  libName: string,
  target: Target,
  format: Format,
  splitting: boolean,
  minify: boolean,
  sourcemap: Sourcemap,
  publicPath: string,
): Promise<void> {
  const startTime = performance.now();
  relinka(
    "verbose",
    `Bundling library using Bun for ${libName} (entry: ${entryFile}, outdir: ${outdirBin})`,
  );

  if (!(await fs.pathExists(entryFile))) {
    relinka("error", `Could not find library entry file at: ${entryFile}`);
    throw new Error(`Library entry file not found: ${entryFile}`);
  }

  try {
    const buildResult = await bunBuild({
      entrypoints: [entryFile],
      outdir: outdirBin,
      target,
      format,
      splitting,
      minify,
      sourcemap: getBunSourcemapOption(sourcemap),
      throw: true,
      naming: {
        entry: "[dir]/[name]-[hash].[ext]",
        chunk: "[name]-[hash].[ext]",
        asset: "[name]-[hash].[ext]",
      },
      publicPath,
      define: {
        "process.env.NODE_ENV": JSON.stringify(
          process.env.NODE_ENV || "production",
        ),
      },
      banner: `/* Library: ${libName} - Bundled by @reliverse/relidler */`,
      footer: "/* End of bundle */",
      drop: ["debugger"],
    });

    const duration = performance.now() - startTime;
    const formattedDuration = prettyMilliseconds(duration, { verbose: true });
    relinka(
      "success",
      `Library bun build completed in ${formattedDuration} for ${libName} with ${buildResult.outputs.length} output file(s).`,
    );

    if (buildResult.logs && buildResult.logs.length > 0) {
      buildResult.logs.forEach((log, index) => {
        relinka("verbose", `Log ${index + 1}: ${JSON.stringify(log)}`);
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `Library build failed for ${libName} while using bun bundler: ${errorMessage}`,
    );

    // Provide more context in the error message
    const enhancedError = new Error(
      `Library bundle failed for ${libName} (${outdirBin}): ${errorMessage}`,
    );
    if (error instanceof Error && error.stack) {
      enhancedError.stack = error.stack;
    }

    throw enhancedError;
  }
}

// ============================
// Distribution Publish Functions
// ============================

/**
 * Publishes the JSR distribution.
 */
export async function regular_pubToJsr(
  dryRun: boolean,
  isDev: boolean,
  pausePublish: boolean,
  jsrDistDir: string,
  jsrAllowDirty: boolean,
  jsrSlowTypes: boolean,
  timer: Timer,
): Promise<void> {
  try {
    if (isDev) {
      relinka("info", "Skipping JSR publish in development mode");
      return;
    }
    if (!pausePublish) {
      relinka("info", "Publishing to JSR...");
      const jsrDistDirResolved = resolve(PROJECT_ROOT, jsrDistDir);

      // Pause the timer before publishing (interactive)
      if (timer) pauseTimer(timer);

      await withWorkingDirectory(jsrDistDirResolved, async () => {
        const command = [
          "bun x jsr publish",
          dryRun ? "--dry-run" : "",
          jsrAllowDirty ? "--allow-dirty" : "",
          jsrSlowTypes ? "--allow-slow-types" : "",
        ]
          .filter(Boolean)
          .join(" ");
        relinka("verbose", `Running publish command: ${command}`);
        await execaCommand(command, { stdio: "inherit" });
        relinka(
          "success",
          `Successfully ${dryRun ? "validated" : "published"} to JSR registry`,
        );
      });

      // Resume the timer after publishing is complete
      if (timer) resumeTimer(timer);
    }
  } catch (error) {
    // Resume timer even on error
    if (timer) resumeTimer(timer);
    relinka("error", "Failed to publish to JSR:", error);
    throw error;
  }
}

/**
 * Publishes the NPM distribution.
 */
export async function regular_pubToNpm(
  dryRun: boolean,
  isDev: boolean,
  pausePublish: boolean,
  npmDistDir: string,
  timer: Timer,
): Promise<void> {
  try {
    if (isDev) {
      relinka("info", "Skipping NPM publish in development mode");
      return;
    }
    if (!pausePublish) {
      relinka("info", "Publishing to NPM...");
      const npmDistDirResolved = resolve(PROJECT_ROOT, npmDistDir);

      // Pause the timer before publishing (non-interactive)
      if (timer) pauseTimer(timer);

      await withWorkingDirectory(npmDistDirResolved, async () => {
        const command = ["bun publish", dryRun ? "--dry-run" : ""]
          .filter(Boolean)
          .join(" ");
        relinka("verbose", `Running publish command: ${command}`);
        await execaCommand(command, { stdio: "inherit" });
        relinka(
          "success",
          `Successfully ${dryRun ? "validated" : "published"} to NPM registry`,
        );
      });

      // Resume the timer after publishing is complete
      if (timer) resumeTimer(timer);
    }
  } catch (error) {
    // Resume timer even on error
    if (timer) resumeTimer(timer);
    relinka("error", "Failed to publish to NPM:", error);
    throw error;
  }
}

// ============================
// Library Helper Functions
// ============================

/**
 * Writes a package.json for a JSR lib distribution.
 */
async function writeJsrLibPackageJSON(
  libName: string,
  outdirBin: string,
  outdirRoot: string,
  originalPkg: PackageJson,
  commonPkg: Partial<PackageJson>,
  isCLI: boolean,
  libs: Record<string, LibConfig>,
  excludeMode: ExcludeMode,
  excludedDependencyPatterns: string[],
): Promise<void> {
  relinka("verbose", `Writing package.json for JSR lib: ${libName}`);

  // For JSR packages, we need to handle bin entries differently
  // JSR uses TypeScript files directly
  const binEntry = commonPkg.bin;
  if (binEntry) {
    relinka(
      "verbose",
      `Found bin entry in commonPkg: ${JSON.stringify(binEntry)}`,
    );
    // Convert bin paths to .ts extension for JSR
    const updatedBin: Record<string, string> = {};
    Object.entries(binEntry).forEach(([key, value]) => {
      updatedBin[key] = value.replace(/\.js$/, ".ts");
    });
    commonPkg.bin = updatedBin;
    relinka(
      "verbose",
      `Updated bin entry for JSR: ${JSON.stringify(updatedBin)}`,
    );
  }

  const jsrPkg = definePackageJSON({
    ...commonPkg,
    exports: {
      ".": "./bin/main.ts",
    },
    dependencies: await getLibDependencies(
      libName,
      originalPkg.dependencies,
      outdirBin,
      true,
      libs?.[libName],
      excludeMode,
      excludedDependencyPatterns,
    ),
    devDependencies: await filterDeps(
      originalPkg.devDependencies,
      true,
      outdirBin,
      true,
      excludeMode,
      excludedDependencyPatterns,
    ),
  });

  if (isCLI) {
    relinka(
      "verbose",
      `JSR lib package.json for ${libName} has CLI-specific fields:`,
    );
    if (jsrPkg.bin) relinka("verbose", `  bin: ${JSON.stringify(jsrPkg.bin)}`);
  }

  await fs.writeJSON(path.join(outdirRoot, "package.json"), jsrPkg, {
    spaces: 2,
  });
  relinka("verbose", `Completed writing package.json for JSR lib: ${libName}`);
}

/**
 * Writes a package.json for a NPM lib distribution.
 */
async function writeNpmLibPackageJSON(
  libName: string,
  outdirBin: string,
  outdirRoot: string,
  originalPkg: PackageJson,
  commonPkg: Partial<PackageJson>,
  isCLI: boolean,
  libs: Record<string, LibConfig>,
  excludeMode: ExcludeMode,
  excludedDependencyPatterns: string[],
  npmOutFilesExt: string,
): Promise<void> {
  relinka("verbose", `Writing package.json for NPM lib: ${libName}`);

  // If bin is already set in commonPkg (from createLibPackageJSON), use that
  // Otherwise, set it based on isCLI
  const binEntry =
    commonPkg.bin ||
    (isCLI
      ? { [libName.split("/").pop() || ""]: `bin/main.${npmOutFilesExt}` }
      : undefined);

  if (binEntry) {
    relinka(
      "verbose",
      `Using bin entry for NPM lib: ${JSON.stringify(binEntry)}`,
    );
  }

  const npmPkg = definePackageJSON({
    ...commonPkg,
    main: `./bin/main.${npmOutFilesExt}`,
    module: `./bin/main.${npmOutFilesExt}`,
    exports: {
      ".": `./bin/main.${npmOutFilesExt}`,
    },
    bin: binEntry,
    files: ["bin", "package.json", "README.md", "LICENSE"],
    publishConfig: { access: "public" },
    dependencies: await getLibDependencies(
      libName,
      originalPkg.dependencies,
      outdirBin,
      false,
      libs?.[libName],
      excludeMode,
      excludedDependencyPatterns,
    ),
    devDependencies: await filterDeps(
      originalPkg.devDependencies,
      true,
      outdirBin,
      false,
      excludeMode,
      excludedDependencyPatterns,
    ),
  });

  if (isCLI) {
    relinka(
      "verbose",
      `NPM lib package.json for ${libName} has CLI-specific fields:`,
    );
    if (npmPkg.bin) relinka("verbose", `  bin: ${JSON.stringify(npmPkg.bin)}`);
  }

  await fs.writeJSON(path.join(outdirRoot, "package.json"), npmPkg, {
    spaces: 2,
  });
  relinka("verbose", `Completed writing package.json for NPM lib: ${libName}`);
}

/**
 * Creates a package.json for a lib distribution.
 */
async function createLibPackageJSON(
  libName: string,
  outdirRoot: string,
  isJsr: boolean,
  isCLI: boolean,
  libs: Record<string, LibConfig>,
  excludeMode: ExcludeMode,
  excludedDependencyPatterns: string[],
  npmOutFilesExt: string,
): Promise<void> {
  relinka(
    "verbose",
    `Generating package.json for lib ${libName} (isJsr=${isJsr}, isCLI=${isCLI})...`,
  );
  const originalPkg = await readPackageJSON();
  let { description } = originalPkg;
  const { version, license, keywords, author } = originalPkg;

  // Set description based on config
  if (libs?.[libName]?.description) {
    description = libs[libName].description;
    relinka(
      "verbose",
      `Using lib-specific description from config: "${description}"`,
    );
  } else if (!isCLI) {
    description = "A helper lib for the Reliverse CLI";
    relinka(
      "verbose",
      `Using default helper lib description: "${description}"`,
    );
  } else {
    description = description || `CLI tool for ${libName}`;
    relinka("verbose", `Using CLI description: "${description}"`);
  }

  // Get the root package name for CLI command
  const rootPackageName = originalPkg.name || "relidler";
  const cliCommandName = rootPackageName.startsWith("@")
    ? rootPackageName.split("/").pop() || "cli"
    : rootPackageName;

  relinka(
    "verbose",
    `Root package name: "${rootPackageName}", CLI command name: "${cliCommandName}"`,
  );

  const commonPkg: Partial<PackageJson> = {
    name: libName,
    version,
    license: license || "MIT",
    description,
    type: "module",
  };

  if (isCLI) {
    relinka("verbose", `Adding CLI-specific fields for lib ${libName}...`);
    const binPath = "bin/main.js";
    Object.assign(commonPkg, {
      bin: { [cliCommandName]: binPath },
    });
    relinka(
      "verbose",
      `Added bin entry: { "${cliCommandName}": "${binPath}" }`,
    );
  }

  if (author) {
    const repoOwner = typeof author === "string" ? author : author.name;
    const repoName = originalPkg.name
      ? originalPkg.name.startsWith("@")
        ? originalPkg.name.split("/").pop() || originalPkg.name
        : originalPkg.name
      : "";
    Object.assign(commonPkg, {
      author,
      repository: {
        type: "git",
        url: `git+https://github.com/${repoOwner}/${repoName}.git`,
      },
      bugs: {
        url: `https://github.com/${repoOwner}/${repoName}/issues`,
        email: "blefnk@gmail.com",
      },
      keywords: [...new Set([...(keywords || []), author])],
    });
  } else if (keywords && keywords.length > 0 && !commonPkg.keywords) {
    commonPkg.keywords = keywords;
  }

  if (isCLI && commonPkg.keywords) {
    const cliKeywords = ["cli", "command-line", cliCommandName];
    relinka("verbose", `Adding CLI keywords: ${JSON.stringify(cliKeywords)}`);
    commonPkg.keywords = [...new Set([...commonPkg.keywords, ...cliKeywords])];
    relinka(
      "verbose",
      `Updated keywords: ${JSON.stringify(commonPkg.keywords)}`,
    );
  }

  const outdirBin = path.join(outdirRoot, "bin");
  if (isJsr) {
    relinka("verbose", `Creating JSR package.json for lib ${libName}...`);
    await writeJsrLibPackageJSON(
      libName,
      outdirBin,
      outdirRoot,
      originalPkg,
      commonPkg,
      isCLI,
      libs,
      excludeMode,
      excludedDependencyPatterns,
    );
  } else {
    relinka("verbose", `Creating NPM package.json for lib ${libName}...`);
    await writeNpmLibPackageJSON(
      libName,
      outdirBin,
      outdirRoot,
      originalPkg,
      commonPkg,
      isCLI,
      libs,
      excludeMode,
      excludedDependencyPatterns,
      npmOutFilesExt,
    );
  }
  relinka("verbose", `Completed creation of package.json for lib: ${libName}`);
}

// ===========================
// Bundling Helper Functions
// ===========================

/**
 * Identifies and copies external imports (imports outside the lib's source directory)
 * to an "addons" directory in the output directory.
 */
async function unstable_copyExternalFilesToAddonsDir(
  entryDir: string,
  outdirBin: string,
  isDev: boolean,
  isJsr: boolean,
  libs: Record<string, LibConfig>,
): Promise<void> {
  if (DEBUG_DISABLE.unstable_copyExternalFilesToAddonsDir) {
    disableFunction("unstable_copyExternalFilesToAddonsDir");
    return;
  }

  const distName = determineDistName(outdirBin, isJsr);
  relinka("info", `[${distName}] Handling external imports...`);

  // Check if the directory exists
  if (!(await fs.pathExists(outdirBin))) {
    relinka("error", `[${distName}] Directory does not exist: ${outdirBin}`);
    return;
  }

  // Create addons directory
  const addonsDir = path.join(outdirBin, "_addons");
  await ensuredir(addonsDir);

  // Process all files in the output directory
  const processedFiles = new Set<string>();
  const copiedExternalFiles = new Map<string, string>();

  // Get all JavaScript files in the output directory
  const files = await glob("**/*.{js,ts,jsx,tsx,mjs,cjs}", {
    cwd: outdirBin,
    absolute: true,
    ignore: ["**/node_modules/**", "**/_addons/**"],
  });

  if (files.length === 0) {
    relinka("info", `[${distName}] No matching files found in: ${outdirBin}`);
    return;
  }

  relinka(
    "info",
    `[${distName}] Found ${files.length} files to process for external imports`,
  );

  // Process each file
  await pMap(
    files,
    async (file) => {
      await processFileForExternalImports(
        file,
        entryDir,
        outdirBin,
        addonsDir,
        processedFiles,
        copiedExternalFiles,
        isDev,
        isJsr,
        libs,
      );
    },
    { concurrency: CONCURRENCY_DEFAULT },
  );

  relinka(
    "info",
    `[${distName}] Processed ${processedFiles.size} files for external imports, copied ${copiedExternalFiles.size} external files`,
  );

  // After handling external imports, also convert any library imports
  // This ensures that both external imports and library imports are properly handled
  await unstable_convertImportPathsToPkgNames(outdirBin, isJsr, libs);
}

/**
 * Process a file to convert library imports to package names.
 * @returns Modified content and modification status
 */
async function processLibraryImportsInFile(
  file: string,
  content: string,
  isJsr: boolean,
  libs: Record<string, LibConfig>,
  currentLibName?: string,
): Promise<{ modified: boolean; newContent?: string }> {
  const importRegex =
    /(?:import|export)(?:(?:[\s\S]*?from\s+)|(?:(?:[\s\S]|(?:\n))+?=\s+require\(\s*))["']([^"']+)["']/g;

  // Extract all imports
  const imports: {
    importPath: string;
    matchStart: number;
    importPathIndex: number;
  }[] = [];

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (
      !importPath.startsWith(".") &&
      !importPath.startsWith("/") &&
      !importPath.startsWith("~")
    ) {
      // Skip npm package imports
      continue;
    }
    imports.push({
      importPath,
      matchStart: match.index,
      importPathIndex: match[0].indexOf(importPath),
    });
  }

  if (imports.length === 0) return { modified: false };

  // Process imports to find those from other libs
  const replacements = await pMap(
    imports,
    async (importInfo) => {
      const { importPath, matchStart, importPathIndex } = importInfo;

      // Skip imports that already reference dist-libs to prevent nested paths
      if (importPath.includes("dist-libs")) {
        relinka(
          "verbose",
          `Skipping import that already references dist-libs: ${importPath}`,
        );
        return null;
      }

      // Check if this import is from another library defined in the config
      if (importPath.startsWith("~/") || importPath.startsWith(".")) {
        let subPath = importPath;
        let isSymbolPath = false;

        // Handle symbol paths (~/...)
        if (importPath.startsWith("~/")) {
          subPath = importPath.slice(2);
          isSymbolPath = true;
        }

        // For relative paths, resolve to absolute path relative to the current file
        const absolutePath = isSymbolPath
          ? path.join(process.cwd(), subPath)
          : path.resolve(path.dirname(file), importPath);

        // Get the path relative to the project root
        const relativeToRoot = path.relative(process.cwd(), absolutePath);

        for (const [libName, libConfig] of Object.entries(libs || {})) {
          // Skip if this is the current library
          if (currentLibName && libName === currentLibName) {
            continue;
          }

          const libMainPath = libConfig.main;
          const libDirPath = path.dirname(libMainPath);

          // Check if this import points to a file in another library
          if (
            relativeToRoot.startsWith(libDirPath) ||
            // Also check for imports like "../cfg/cfg-mod.ts" or "libs/cfg/cfg-mod.js"
            path.basename(path.dirname(relativeToRoot)) ===
              path.basename(libDirPath)
          ) {
            logFoundImport(importPath, libName, isJsr, file);

            // Return replacement info
            const importPathStart =
              Number(matchStart) + Number(importPathIndex);
            const importPathEnd =
              Number(importPathStart) + Number(importPath.length);

            return {
              start: importPathStart,
              end: importPathEnd,
              replacement: libName,
            };
          }
        }
      }

      return null;
    },
    {
      concurrency: CONCURRENCY_DEFAULT,
      stopOnError: false,
    },
  );

  // Filter out null values and apply replacements
  const validReplacements = replacements.filter(
    (r): r is { start: number; end: number; replacement: string } => r !== null,
  );

  if (validReplacements.length === 0) {
    return { modified: false };
  }

  // Sort replacements in reverse order to avoid offset issues
  validReplacements.sort((a, b) => b.start - a.start);

  let newContent = content;
  for (const { start, end, replacement } of validReplacements) {
    newContent =
      newContent.substring(0, start) + replacement + newContent.substring(end);
  }

  return { modified: true, newContent };
}

/**
 * Converts imports from other libs to package names based on the configuration.
 */
async function unstable_convertImportPathsToPkgNames(
  outdirBin: string,
  isJsr: boolean,
  libs: Record<string, LibConfig>,
): Promise<void> {
  if (DEBUG_DISABLE.unstable_convertImportPathsToPkgNames) {
    disableFunction("unstable_convertImportPathsToPkgNames");
    return;
  }

  const distName = determineDistName(outdirBin, isJsr);
  relinka(
    "info",
    `[${distName}] Converting library imports to package names...`,
  );

  if (!libs || Object.keys(libs).length === 0) {
    relinka(
      "info",
      `[${distName}] No libs defined in configuration, skipping library import conversion.`,
    );
    return;
  }

  // Determine the current library name from the outdirBin path
  let currentLibName: string | undefined;
  for (const [libName, libConfig] of Object.entries(libs)) {
    const libDirName = path.basename(path.dirname(libConfig.main));
    if (
      outdirBin.includes(`/dist-libs/${libDirName}/`) ||
      outdirBin.includes(`\\dist-libs\\${libDirName}\\`)
    ) {
      currentLibName = libName;
      relinka(
        "verbose",
        `[${distName}] Detected current library: ${currentLibName} for path: ${outdirBin}`,
      );
      break;
    }
  }

  const filePatterns = ["**/*.{js,ts,jsx,tsx,mjs,cjs}"];
  const ignorePatterns = ["**/node_modules/**", "**/_addons/**"];

  const filesModified = await processFilesInDirectory(
    isJsr,
    outdirBin,
    filePatterns,
    async (file, content) =>
      processLibraryImportsInFile(file, content, isJsr, libs, currentLibName),
    { ignore: ignorePatterns },
  );

  relinka(
    "info",
    `[${distName}] Converted library imports in ${filesModified} files.`,
  );
}

/**
 * Processes a file to handle external imports, replacing them with appropriate paths.
 * This function:
 * 1. Finds all imports in the file
 * 2. Identifies imports from other libs and replaces them with package names
 * 3. Identifies external imports (outside the entry directory) and copies them to the addons directory
 * 4. Updates import paths in the file to point to the correct locations
 */
async function processFileForExternalImports(
  filePath: string,
  entryDir: string,
  outdirBin: string,
  addonsDir: string,
  processedFiles: Set<string>,
  copiedExternalFiles: Map<string, string>,
  isDev: boolean,
  isJsr: boolean,
  libs: Record<string, LibConfig>,
): Promise<void> {
  // Skip already processed files to avoid circular dependencies
  if (processedFiles.has(filePath)) return;
  processedFiles.add(filePath);

  try {
    const content = await fs.readFile(filePath, "utf8");
    const distName = determineDistName(outdirBin, isJsr);

    // Extract all local imports (not npm packages)
    const imports = extractLocalImports(content);
    if (imports.length === 0) return;

    // Get the config and determine the current library
    const currentLibName = detectCurrentLibrary(outdirBin, distName, libs);

    // Process each import and generate replacements
    const replacements = await processImports(
      imports,
      filePath,
      entryDir,
      outdirBin,
      addonsDir,
      processedFiles,
      copiedExternalFiles,
      currentLibName,
      isDev,
      isJsr,
      distName,
      libs,
    );

    // Apply the replacements to the file content
    await applyReplacements(filePath, content, replacements);
  } catch (error) {
    relinka(
      "error",
      `Error processing file for external imports: ${filePath}\n${error}`,
    );
  }
}

/**
 * Extracts all local imports (not npm packages) from file content.
 */
function extractLocalImports(content: string): ImportInfo[] {
  const importRegex =
    /(?:import|export)(?:(?:[\s\S]*?from\s+)|(?:(?:[\s\S]|(?:\n))+?=\s+require\(\s*))["']([^"']+)["']/g;

  const imports: ImportInfo[] = [];
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];

    // Skip npm package imports
    if (!isLocalImport(importPath)) {
      continue;
    }

    imports.push({
      importPath,
      matchStart: match.index,
      importPathIndex: match[0].indexOf(importPath),
    });
  }

  return imports;
}

/**
 * Type definition for import information.
 */
type ImportInfo = {
  importPath: string;
  matchStart: number;
  importPathIndex: number;
};

/**
 * Type definition for replacement information.
 */
type Replacement = {
  start: number;
  end: number;
  replacement: string;
};

/**
 * Processes imports to generate replacement information.
 */
async function processImports(
  imports: ImportInfo[],
  filePath: string,
  entryDir: string,
  outdirBin: string,
  addonsDir: string,
  processedFiles: Set<string>,
  copiedExternalFiles: Map<string, string>,
  currentLibName: string | undefined,
  isDev: boolean,
  isJsr: boolean,
  distName: string,
  libs: Record<string, LibConfig>,
): Promise<Replacement[]> {
  return pMap(
    imports,
    async (importInfo) => {
      const { importPath, matchStart, importPathIndex } = importInfo;

      // Skip imports that already reference dist-libs to prevent nested paths
      if (importPath.includes("dist-libs")) {
        relinka(
          "verbose",
          `[${distName}] Skipping import that already references dist-libs: ${importPath}`,
        );
        return null;
      }

      // Check if this is a cross-library import
      const libraryReplacement = findCrossLibraryReplacement(
        importPath,
        filePath,
        currentLibName,
        isJsr,
        matchStart,
        importPathIndex,
        libs,
      );

      if (libraryReplacement) {
        return libraryReplacement;
      }

      // Normalize the import path
      const normalizedPath = normalizeImportPath(importPath, filePath);

      // Resolve the import path to an actual file
      const resolvedPath = await resolveImportToFile(normalizedPath, filePath);
      if (!resolvedPath) {
        return null;
      }

      // Handle external imports (outside the entry directory)
      return handleExternalImport(
        resolvedPath,
        importPath,
        filePath,
        entryDir,
        outdirBin,
        addonsDir,
        processedFiles,
        copiedExternalFiles,
        isDev,
        isJsr,
        matchStart,
        importPathIndex,
        distName,
        libs,
      );
    },
    {
      concurrency: CONCURRENCY_DEFAULT,
      stopOnError: false,
    },
  );
}

/**
 * Finds a replacement for cross-library imports.
 */
function findCrossLibraryReplacement(
  importPath: string,
  filePath: string,
  currentLibName: string | undefined,
  isJsr: boolean,
  matchStart: number,
  importPathIndex: number,
  libs: Record<string, LibConfig>,
): Replacement | null {
  if (!libs || (!importPath.startsWith("~/") && !importPath.startsWith("."))) {
    return null;
  }

  let subPath = importPath;
  let isSymbolPath = false;

  // Handle symbol paths (~/...)
  if (importPath.startsWith("~/")) {
    subPath = importPath.slice(2);
    isSymbolPath = true;
  }

  // For relative paths, resolve to absolute path relative to the current file
  const absolutePath = isSymbolPath
    ? path.join(process.cwd(), subPath)
    : path.resolve(path.dirname(filePath), importPath);

  // Get the path relative to the project root
  const relativeToRoot = path.relative(process.cwd(), absolutePath);

  for (const [libName, libConfig] of Object.entries(libs)) {
    // Skip if this is the current library
    if (currentLibName && libName === currentLibName) {
      continue;
    }

    const libMainPath = libConfig.main;
    const libDirPath = path.dirname(libMainPath);

    // Check if this import points to a file in another library
    if (
      relativeToRoot.startsWith(libDirPath) ||
      // Also check for imports like "../cfg/cfg-mod.ts" or "libs/cfg/cfg-mod.js"
      (isSymbolPath && subPath.includes(`/${path.basename(libDirPath)}/`)) ||
      (!isSymbolPath &&
        path.basename(path.dirname(relativeToRoot)) ===
          path.basename(libDirPath))
    ) {
      logFoundImport(importPath, libName, isJsr, filePath);

      // Calculate replacement positions
      const importPathStart = Number(matchStart) + Number(importPathIndex);
      const importPathEnd = Number(importPathStart) + Number(importPath.length);

      return {
        start: importPathStart,
        end: importPathEnd,
        replacement: libName,
      };
    }
  }

  return null;
}

/**
 * Resolves an import path to an actual file on disk.
 */
async function resolveImportToFile(
  importPath: string,
  filePath: string,
): Promise<string | null> {
  // Resolve the absolute path of the imported file
  let resolvedImportPath: string;
  if (importPath.startsWith("/")) {
    resolvedImportPath = path.join(PROJECT_ROOT, importPath.slice(1));
  } else if (importPath.startsWith("~/")) {
    resolvedImportPath = path.join(process.cwd(), importPath.slice(2));
  } else {
    resolvedImportPath = path.resolve(path.dirname(filePath), importPath);
  }

  // Inject extension if needed
  let foundFile = false;
  let resolvedFullPath = resolvedImportPath;

  if (!path.extname(resolvedImportPath)) {
    // Try adding various extensions
    for (const ext of [".ts", ".tsx", ".js", ".jsx", ".json"]) {
      const withExt = `${resolvedImportPath}${ext}`;
      if (await fs.pathExists(withExt)) {
        resolvedFullPath = withExt;
        foundFile = true;
        break;
      }
    }
  } else if (await fs.pathExists(resolvedImportPath)) {
    foundFile = true;
  }

  // Check for directory with index file
  if (
    !foundFile &&
    (await fs.pathExists(resolvedImportPath)) &&
    (await fs.stat(resolvedImportPath)).isDirectory()
  ) {
    // Try to find a main file in the directory
    const mainFilePath = await findMainFileInDirectory(resolvedImportPath);
    if (mainFilePath) {
      resolvedFullPath = mainFilePath;
      foundFile = true;
    }
  }

  if (!foundFile) {
    relinka("warn", `Could not resolve import: ${importPath} in ${filePath}`);
    return null;
  }

  return resolvedFullPath;
}

/**
 * Finds a main file in a directory using a flexible pattern-based approach.
 * This replaces the hardcoded list of index file names.
 */
async function findMainFileInDirectory(
  dirPath: string,
): Promise<string | null> {
  // Extract the directory name to look for potential lib-specific main files
  const dirName = path.basename(dirPath);

  // Define patterns for main files in order of priority
  const mainFilePatterns = [
    // Standard index files
    "index.ts",
    "index.js",

    // Generic main files
    "main.ts",
    "main.js",

    // Library-specific main files with format: [lib-name]-main.ts/js
    `${dirName}-main.ts`,
    `${dirName}-main.js`,

    // Other common patterns
    "*-main.ts",
    "*-main.js",
    "*.mod.ts",
    "*.mod.js",
  ];

  // Try exact matches first
  for (const pattern of mainFilePatterns) {
    if (!pattern.includes("*")) {
      const filePath = path.join(dirPath, pattern);
      if (await fs.pathExists(filePath)) {
        return filePath;
      }
    }
  }

  // Then try glob patterns
  for (const pattern of mainFilePatterns) {
    if (pattern.includes("*")) {
      const files = await glob(path.join(dirPath, pattern));
      if (files.length > 0) {
        return files[0];
      }
    }
  }

  return null;
}

/**
 * Handles external imports by copying them to the addons directory and updating import paths.
 */
async function handleExternalImport(
  resolvedFullPath: string,
  importPath: string,
  filePath: string,
  entryDir: string,
  outdirBin: string,
  addonsDir: string,
  processedFiles: Set<string>,
  copiedExternalFiles: Map<string, string>,
  isDev: boolean,
  isJsr: boolean,
  matchStart: number,
  importPathIndex: number,
  _distName: string,
  libs: Record<string, LibConfig>,
): Promise<Replacement | null> {
  // Check if this is an external import (outside the lib's source directory)
  const normalizedEntryDir = path.resolve(process.cwd(), entryDir);
  const isExternal = !resolvedFullPath.startsWith(normalizedEntryDir);

  // Check if this is an import from a dist-libs directory (another library's build output)
  const isFromDistLibs = resolvedFullPath.includes("dist-libs");

  // Skip copying files from dist-libs directories to prevent nested dist-libs paths
  if (isExternal && isFromDistLibs) {
    relinka(
      "info",
      `[${_distName}] Skipping external import from dist-libs: ${importPath} -> ${resolvedFullPath}`,
    );
    return null;
  }

  if (isExternal && !isFromDistLibs) {
    relinka(
      "info",
      `[${_distName}] Found external import: ${importPath} -> ${resolvedFullPath}`,
    );

    // Copy the external file if not already copied
    const targetPath = await copyExternalFile(
      resolvedFullPath,
      addonsDir,
      copiedExternalFiles,
      entryDir,
      outdirBin,
      processedFiles,
      isDev,
      isJsr,
      libs,
    );

    // Calculate the relative path from the current file to the copied file
    const relativeImportPath = path
      .relative(path.dirname(filePath), targetPath)
      .replace(/\\/g, "/");

    // Ensure the path starts with ./ or ../
    const formattedRelativePath = relativeImportPath.startsWith(".")
      ? relativeImportPath
      : `./${relativeImportPath}`;

    // Calculate replacement positions
    const importPathStart = Number(matchStart) + Number(importPathIndex);
    const importPathEnd = Number(importPathStart) + Number(importPath.length);

    return {
      start: importPathStart,
      end: importPathEnd,
      replacement: formattedRelativePath,
    };
  }

  return null;
}

/**
 * Copies an external file to the addons directory and processes its imports.
 */
async function copyExternalFile(
  resolvedFullPath: string,
  addonsDir: string,
  copiedExternalFiles: Map<string, string>,
  entryDir: string,
  outdirBin: string,
  processedFiles: Set<string>,
  isDev: boolean,
  isJsr: boolean,
  libs: Record<string, LibConfig>,
): Promise<string> {
  // Return existing copy if already copied
  if (copiedExternalFiles.has(resolvedFullPath)) {
    return copiedExternalFiles.get(resolvedFullPath)!;
  }

  // Create a path in the addons directory that preserves some structure
  const fileBaseName = path.basename(resolvedFullPath);
  const fileDir = path.dirname(resolvedFullPath);
  const lastDirName = path.basename(fileDir);

  // Use a combination of the last directory name and file name to avoid collisions
  const targetPath = path.join(addonsDir, `${lastDirName}_${fileBaseName}`);

  // Copy the file
  await fs.copyFile(resolvedFullPath, targetPath);
  copiedExternalFiles.set(resolvedFullPath, targetPath);
  relinka(
    "verbose",
    `Copied external file: ${resolvedFullPath} -> ${targetPath}`,
  );

  // Process the copied file for its own imports
  await processFileForExternalImports(
    targetPath,
    entryDir,
    outdirBin,
    addonsDir,
    processedFiles,
    copiedExternalFiles,
    isDev,
    isJsr,
    libs,
  );

  return targetPath;
}

/**
 * Applies replacements to file content and writes it back to the file.
 */
async function applyReplacements(
  filePath: string,
  content: string,
  replacements: (Replacement | null)[],
): Promise<void> {
  // Filter out null values
  const validReplacements = replacements.filter(
    (r): r is Replacement => r !== null,
  );

  if (validReplacements.length === 0) return;

  // Sort replacements in reverse order to avoid offset issues
  validReplacements.sort((a, b) => b.start - a.start);

  // Apply replacements
  let newContent = content;
  for (const { start, end, replacement } of validReplacements) {
    newContent =
      newContent.substring(0, start) + replacement + newContent.substring(end);
  }

  // Write the modified content back to the file
  await writeFileSafe(filePath, newContent, "processFileForExternalImports");
}

/**
 * Renames the entry file to a standard name (main.js or main.ts).
 */
async function renameEntryFile(
  isJsr: boolean,
  outdirBin: string,
  entryDir: string,
  entryFile: string,
  npmOutFilesExt: string,
): Promise<{ updatedEntryFile: string }> {
  relinka(
    "verbose",
    `Renaming entry file. Original: ${entryFile} (isJsr=${isJsr})`,
  );
  if (!isJsr) {
    const outExt = npmOutFilesExt || "js";
    entryFile = entryFile.replace(".ts", `.${outExt}`);
    const entryFileNoExt = entryFile.split(".").slice(0, -1).join(".");
    if (await fs.pathExists(path.join(outdirBin, `${entryFileNoExt}.d.ts`))) {
      await fs.rename(
        path.join(outdirBin, `${entryFileNoExt}.d.ts`),
        path.join(outdirBin, "main.d.ts"),
      );
    }
  }
  if (!isJsr) {
    const outExt = npmOutFilesExt || "js";
    await fs.rename(
      path.join(outdirBin, entryFile),
      path.join(outdirBin, `main.${outExt}`),
    );
    entryFile = `main.${outExt}`;
  } else if (entryFile.endsWith(".ts")) {
    await fs.rename(
      path.join(outdirBin, entryFile),
      path.join(outdirBin, "main.ts"),
    );
    entryFile = "main.ts";
  }
  relinka("info", `Renamed entry file to ${entryDir + entryFile}`);
  return { updatedEntryFile: entryFile };
}

/**
 * Detects the current library name based on the baseDir path.
 */
function detectCurrentLibrary(
  baseDir: string,
  distName: string,
  libs: Record<string, LibConfig>,
): string | undefined {
  if (!libs) return undefined;

  for (const [libName, libConfig] of Object.entries(libs)) {
    const libDirName = path.basename(path.dirname(libConfig.main));
    if (
      baseDir.includes(`/dist-libs/${libDirName}/`) ||
      baseDir.includes(`\\dist-libs\\${libDirName}\\`)
    ) {
      relinka(
        "verbose",
        `[${distName}] Detected current library for import analysis: ${libName} for path: ${baseDir}`,
      );
      return libName;
    }
  }
  return undefined;
}

/**
 * Checks if an import is a local file (not an npm package).
 */
function isLocalImport(importPath: string): boolean {
  return (
    importPath.startsWith(".") ||
    importPath.startsWith("/") ||
    importPath.startsWith("~")
  );
}

/**
 * Normalizes an import path by removing extensions.
 */
function normalizeImportPath(importPath: string, filePath: string): string {
  let normalizedPath = importPath;

  // Remove .js or .ts extensions
  if (normalizedPath.endsWith(".js") || normalizedPath.endsWith(".ts")) {
    normalizedPath = normalizedPath.replace(/\.(js|ts)$/, "");
  }

  // Extract library name pattern from path
  const libsPattern = /libs\/([^/]+)\//;
  const libMatch = libsPattern.exec(normalizedPath);

  // Check if this is a file in a subdirectory that imports from a library
  if (libMatch && isInSubdirectory(filePath)) {
    // Get the library name from the match
    const libName = libMatch[1];

    // Simplify to just use the filename for imports from libs
    const pathComponents = normalizedPath.split(/[/\\]/);
    const fileName = pathComponents[pathComponents.length - 1];

    // Use a relative path that points to the parent directory
    normalizedPath = `../${fileName}`;

    // Log the normalization for debugging
    relinka(
      "verbose",
      `Normalized library import from ${importPath} to ${normalizedPath} (lib: ${libName})`,
    );
  }

  return normalizedPath;
}

/**
 * Checks if a file is in a subdirectory of a library.
 * This replaces the hardcoded check for "funcs" directory.
 */
function isInSubdirectory(filePath: string): boolean {
  // Check if the file is in a subdirectory structure
  // This generalizes the previous check for "/funcs/" or "\\funcs\\"
  const pathParts = filePath.split(/[/\\]/);

  // Find the "libs" directory index
  const libsIndex = pathParts.findIndex((part) => part === "libs");
  if (libsIndex === -1) return false;

  // Check if there's a subdirectory after the library name
  // Format: libs/[lib-name]/[subdirectory]/...
  return libsIndex + 2 < pathParts.length;
}

/**
 * Computes the Rollup sourcemap option based on the given configuration.
 * @returns "inline" if inline is specified; true for linked/external or boolean true; otherwise false.
 */
function getRollupSourcemap(
  sourcemap: boolean | "inline" | "none" | "linked" | "external",
): boolean | "inline" {
  relinka("verbose", `Converting rollup sourcemap option: ${sourcemap}`);
  switch (sourcemap) {
    case "none":
      return false;
    case "inline":
      return "inline";
    case "linked":
    case "external":
      return true;
    default:
      return !!sourcemap;
  }
}

// ============================
// Bundling Functions
// ============================

/**
 * Bundles a regular (non-library) project using JSR by copying the source directory.
 */
async function regular_bundleUsingJsr(
  src: string,
  dest: string,
): Promise<void> {
  relinka("info", `Starting regular JSR bundle: ${src} -> ${dest}`);
  await ensuredir(path.dirname(dest));

  // Validate source is a directory
  const stats = await fs.stat(src);
  if (!stats.isDirectory()) {
    throw new Error(
      "You are using the 'jsr' builder, but path to file was provided. Please provide path to directory instead.",
    );
  }

  try {
    await fs.copy(src, dest);
    relinka("verbose", `Copied directory from ${src} to ${dest}`);
    relinka("success", "Completed regular JSR bundling");
  } catch (error) {
    // Handle errors gracefully with fallback to original source
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka("warn", `${errorMessage}, falling back to copying ${src}`);
    await fs.copy(src, dest);
  }
}

/**
 * Bundles a library project using JSR by copying the appropriate library directory.
 */
async function library_bundleUsingJsr(
  src: string,
  dest: string,
): Promise<void> {
  relinka("info", `Starting regular JSR bundle: ${src} -> ${dest}`);
  await ensuredir(path.dirname(dest));

  // Validate source is a directory
  const stats = await fs.stat(src);
  if (!stats.isDirectory()) {
    throw new Error(
      "You are using the 'jsr' builder, but path to file was provided. Please provide path to directory instead.",
    );
  }

  try {
    await fs.copy(src, dest);
    relinka("verbose", `Copied directory from ${src} to ${dest}`);
    relinka("success", "Completed regular JSR bundling");
  } catch (error) {
    // Handle errors gracefully with fallback to original source
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka("warn", `${errorMessage}, falling back to copying ${src}`);
    await fs.copy(src, dest);
  }
}

// TODO: remove
async function _library_bundleUsingJsr2(
  src: string,
  dest: string,
  baseDir: string,
  isJsr: boolean,
  libs: Record<string, LibConfig>,
): Promise<void> {
  relinka("info", `Starting library JSR bundle: ${src} -> ${dest}`);
  relinka("verbose", `Base directory: ${baseDir}`);
  await ensuredir(path.dirname(dest));

  // Validate source is a directory
  const stats = await fs.stat(src);
  if (!stats.isDirectory()) {
    throw new Error(
      "You are using the 'jsr' builder, but path to file was provided. Please provide path to directory instead.",
    );
  }

  // Determine if this is a library build
  const distName = determineDistName(src, isJsr);

  try {
    const libNameMatch = /dist-libs\/([^/]+)\//.exec(distName);
    if (!libNameMatch?.[1]) {
      throw new Error(`Could not determine library name from ${distName}`);
    }

    const libName = libNameMatch[1];
    const libConfig = libs?.[`@reliverse/${libName}`];

    if (!libConfig?.main) {
      throw new Error(`No main file defined for library ${libName}`);
    }

    // Extract the directory from the main file path
    const mainFilePath = libConfig.main;
    const libDirMatch = /src\/libs\/([^/]+)\//.exec(mainFilePath);

    if (!libDirMatch?.[1]) {
      throw new Error(
        `Could not determine library directory from ${mainFilePath}`,
      );
    }

    const actualLibDir = libDirMatch[1];
    const libPath = path.join(baseDir, "libs", actualLibDir);

    if (await fs.pathExists(libPath)) {
      relinka("info", `Library build detected. Copying ${libPath} to ${dest}`);
      await fs.copy(libPath, dest);
    } else {
      relinka(
        "warn",
        `Library directory ${libPath} not found, falling back to copying ${src}`,
      );
      await fs.copy(src, dest);
    }
    relinka("success", "Completed library JSR bundling");
  } catch (error) {
    // Handle errors gracefully with fallback to original source
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka("warn", `${errorMessage}, falling back to copying ${src}`);
    await fs.copy(src, dest);
  }
}

/**
 * Builds using a unified builder for main project.
 */
async function regular_bundleUsingUnified(
  entryFile: string,
  outdirBin: string,
  builder: "rollup" | "untyped" | "mkdist" | "copy",
  npmOutFilesExt: string,
  entrySrcDir: string,
  stub: boolean,
  watch: boolean,
  esbuild: string,
  minify: boolean,
  sourcemap: Sourcemap,
): Promise<void> {
  try {
    relinka(
      "verbose",
      `Starting regular_bundleUsingUnified with builder: ${builder}`,
    );
    const rootDir = resolve(process.cwd(), entrySrcDir || ".");
    const startTime = performance.now();

    // Validate and normalize the output file extension
    const validExtensions = ["cjs", "js", "mjs", "ts", "mts", "cts"];
    if (!validExtensions.includes(npmOutFilesExt)) {
      relinka(
        "warn",
        `Invalid output extension: ${npmOutFilesExt}, defaulting to 'js'`,
      );
      npmOutFilesExt = "js";
    }

    // Determine source directory and input path
    const srcDir = entrySrcDir || "src";
    const resolvedSrcDir = resolve(process.cwd(), srcDir);

    // For mkdist, we need to use the directory containing the entry file, not the file itself
    const input = builder === "mkdist" ? path.dirname(entryFile) : entryFile;

    // Determine optimal concurrency based on configuration and system resources
    const concurrency = CONCURRENCY_DEFAULT;
    relinka("verbose", `Using concurrency level: ${concurrency}`);

    const unifiedBuildConfig = {
      declaration: false,
      clean: false,
      entries: [
        {
          input: builder === "mkdist" ? resolvedSrcDir : input,
          builder,
          outDir: outdirBin,
          ext: npmOutFilesExt,
        },
      ],
      stub: stub,
      watch: watch ?? false,
      showOutLog: true,
      concurrency,
      rollup: {
        emitCJS: false,
        inlineDependencies: true,
        esbuild: {
          target: esbuild,
          minify: minify,
        },
        output: {
          sourcemap: getRollupSourcemap(sourcemap),
        },
      },
    } satisfies UnifiedBuildConfig & { concurrency?: number };

    await unifiedBuild(rootDir, stub, unifiedBuildConfig, outdirBin);

    const duration = performance.now() - startTime;
    const formattedDuration = prettyMilliseconds(duration, { verbose: true });
    relinka(
      "success",
      `Regular bundle completed in ${formattedDuration} using ${builder} builder`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `Failed to bundle regular project using ${builder}: ${errorMessage}`,
    );

    // Provide more context in the error message
    const enhancedError = new Error(
      `Regular bundle failed for ${outdirBin}: ${errorMessage}`,
    );
    if (error instanceof Error && error.stack) {
      enhancedError.stack = error.stack;
    }

    throw enhancedError;
  }
}

/**
 * Builds using a unified builder for library projects.
 */
async function library_bundleUsingUnified(
  entryFile: string,
  outdirBin: string,
  builder: "rollup" | "untyped" | "mkdist" | "copy",
  isJsr: boolean,
  entrySrcDir: string,
  npmOutFilesExt: string,
  stub: boolean,
  watch: boolean,
  esbuild: string,
  minify: boolean,
  sourcemap: Sourcemap,
): Promise<void> {
  try {
    relinka(
      "verbose",
      `Starting library_bundleUsingUnified with builder: ${builder}`,
    );
    const rootDir = resolve(process.cwd(), entrySrcDir || ".");
    const startTime = performance.now();

    // Extract the library name from the distName
    const distName = determineDistName(outdirBin, isJsr);
    const libNameMatch = /dist-libs\/([^/]+)\//.exec(distName);

    if (!libNameMatch?.[1]) {
      throw new Error(
        `Could not determine library name from path: ${outdirBin}`,
      );
    }

    const libName = libNameMatch[1];

    // Construct the full path to the library directory
    const entrySrcDirResolved = resolve(process.cwd(), entrySrcDir);
    const libSrcDir = path.join(entrySrcDirResolved, "libs", libName);

    relinka(
      "info",
      `Library build detected for ${libName}. Using source directory: ${libSrcDir}`,
    );

    // Validate and normalize the output file extension
    const validExtensions = ["cjs", "js", "mjs", "ts", "mts", "cts"];
    if (!validExtensions.includes(npmOutFilesExt)) {
      relinka(
        "warn",
        `Invalid output extension: ${npmOutFilesExt}, defaulting to 'js'`,
      );
      npmOutFilesExt = "js";
    }

    // For mkdist, we need to use the directory containing the entry file, not the file itself
    const input = builder === "mkdist" ? libSrcDir : entryFile;

    // Determine optimal concurrency based on configuration and system resources
    const concurrency = CONCURRENCY_DEFAULT;
    relinka("verbose", `Using concurrency level: ${concurrency}`);

    const unifiedBuildConfig = {
      declaration: false,
      clean: false,
      entries: [
        {
          input: builder === "mkdist" ? libSrcDir : input,
          builder,
          outDir: outdirBin,
          ext: npmOutFilesExt,
        },
      ],
      stub: stub,
      watch: watch ?? false,
      showOutLog: true,
      concurrency,
      rollup: {
        emitCJS: false,
        inlineDependencies: true,
        esbuild: {
          target: esbuild,
          minify: minify,
        },
        output: {
          sourcemap: getRollupSourcemap(sourcemap),
        },
      },
    } satisfies UnifiedBuildConfig & { concurrency?: number };

    await unifiedBuild(rootDir, stub, unifiedBuildConfig, outdirBin);

    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    relinka(
      "success",
      `Library bundle completed in ${duration}s using ${builder} builder for library ${libName}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `Failed to bundle library using ${builder}: ${errorMessage}`,
    );

    // Provide more context in the error message
    const enhancedError = new Error(
      `Library bundle failed for ${outdirBin}: ${errorMessage}`,
    );
    if (error instanceof Error && error.stack) {
      enhancedError.stack = error.stack;
    }

    throw enhancedError;
  }
}

// ============================
// Main Build/Publish Functions
// ============================

/**
 * Common build steps shared between JSR and NPM distributions
 */
async function regular_performCommonBuildSteps({
  outdirBinResolved,
  outdirRoot,
  entryFile,
  entrySrcDir,
  isJsr,
  deleteFiles = true,
}: {
  outdirBinResolved: string;
  outdirRoot: string;
  entryFile: string;
  entrySrcDir: string;
  isJsr: boolean;
  deleteFiles?: boolean;
}): Promise<void> {
  await convertImportPaths({
    baseDir: outdirBinResolved,
    fromType: "alias",
    toType: "relative",
    aliasPrefix: "~/",
  });

  // Handle entry file
  await renameEntryFile(isJsr, outdirBinResolved, entrySrcDir, entryFile);

  // Clean up files if needed
  if (deleteFiles) {
    await deleteSpecificFiles(outdirBinResolved);
  }

  // Generate package.json
  await createPackageJSON(
    outdirRoot,
    isJsr,
    isCLI,
    npmOutFilesExt,
    excludeMode,
    excludedDependencyPatterns,
  );

  // Copy files from the root directory
  await copyFileFromRoot(outdirRoot, ["README.md", "LICENSE"]);
  if (isJsr && isCLI) {
    await copyFileFromRoot(outdirRoot, [
      ".gitignore",
      "reliverse.jsonc",
      "drizzle.config.ts",
      "schema.json",
    ]);
  }
}

/**
 * Common library build steps shared between JSR and NPM distributions
 */
async function library_performCommonBuildSteps({
  libName,
  entryDir,
  outdirRoot,
  isDev,
  isJsr,
  deleteFiles = true,
  isCLI,
  libs,
  excludeMode,
  excludedDependencyPatterns,
  npmOutFilesExt,
}: {
  libName: string;
  entryDir: string;
  outdirRoot: string;
  isDev: boolean;
  isJsr: boolean;
  deleteFiles?: boolean;
  isCLI: boolean;
  libs: Record<string, LibConfig>;
  excludeMode: ExcludeMode;
  excludedDependencyPatterns: string[];
  npmOutFilesExt: string;
}): Promise<void> {
  const outdirBinResolved = path.resolve(outdirRoot, "bin");

  // First convert library imports to package names
  await unstable_convertImportPathsToPkgNames(outdirBinResolved, isJsr);

  // Then handle external imports
  await unstable_copyExternalFilesToAddonsDir(
    entryDir,
    outdirBinResolved,
    isDev,
    isJsr,
  );

  // Create library package.json
  await createLibPackageJSON(
    libName,
    outdirRoot,
    isJsr,
    isCLI,
    libs,
    excludeMode,
    excludedDependencyPatterns,
    npmOutFilesExt,
  );

  // Clean up files
  if (deleteFiles) {
    await deleteSpecificFiles(outdirBinResolved);
  }

  // Copy documentation files
  await copyFileFromRoot(outdirRoot, ["README.md", "LICENSE"]);

  // Convert alias import paths to relative paths
  await convertImportPaths({
    baseDir: outdirBinResolved,
    fromType: "alias",
    toType: "relative",
    aliasPrefix: "~/",
  });
}

/**
 * Builds a regular JSR distribution.
 */
async function regular_buildJsrDist(
  isDev: boolean,
  isJsr: boolean,
  entrySrcDir: string,
  jsrDistDir: string,
  jsrBuilder: string,
  entryFile: string,
  target: Target,
  format: Format,
  splitting: boolean,
  minify: boolean,
  sourcemap: Sourcemap,
  publicPath: string,
  npmOutFilesExt: string,
): Promise<void> {
  // =====================================================
  // [dist-jsr] 1. Initialize
  // =====================================================
  relinka("info", "Building JSR distribution...");
  const entrySrcDirResolved = resolve(process.cwd(), entrySrcDir);
  const entryFilePath = path.join(entrySrcDirResolved, entryFile);
  const jsrDistDirResolved = resolve(process.cwd(), jsrDistDir);
  const outdirBinResolved = path.resolve(jsrDistDirResolved, "bin");
  await ensuredir(jsrDistDirResolved);
  await ensuredir(outdirBinResolved);
  relinka("info", `Using JSR builder: ${jsrBuilder}`);

  // =====================================================
  // [dist-jsr] 2. Build using the appropriate builder
  // =====================================================
  if (jsrBuilder === "jsr") {
    await regular_bundleUsingJsr(entrySrcDirResolved, outdirBinResolved);
  } else if (jsrBuilder === "bun") {
    await regular_bundleUsingBun(
      entryFilePath,
      outdirBinResolved,
      target,
      format,
      splitting,
      minify,
      sourcemap,
      publicPath,
    );
  } else {
    await regular_bundleUsingUnified(
      entryFilePath,
      outdirBinResolved,
      "mkdist",
      npmOutFilesExt,
      entrySrcDir,
    );
  }

  // =====================================================
  // [dist-jsr] 3. Perform common build steps
  // =====================================================
  await regular_performCommonBuildSteps({
    outdirBinResolved,
    outdirRoot: jsrDistDirResolved,
    entryFile,
    entrySrcDir,
    isJsr,
  });

  // =====================================================
  // [dist-jsr] 4. Perform additional steps
  // =====================================================
  await convertImportExtensionsJsToTs(outdirBinResolved);
  await renameTsxFiles(outdirBinResolved);
  await createJsrJSONC(jsrDistDirResolved, false);
  if (isCLI) {
    await createTSConfig(jsrDistDirResolved, true);
  }

  // =====================================================
  // [dist-jsr] 5. Finalize
  // =====================================================
  const dirSize = await getDirectorySize(jsrDistDirResolved, isDev);
  const filesCount = await outdirBinFilesCount(outdirBinResolved);
  relinka(
    "success",
    `JSR distribution built successfully (${filesCount} files, ${prettyBytes(dirSize)})`,
  );
}

/**
 * Builds a regular NPM distribution.
 */
export async function regular_buildNpmDist(
  isDev: boolean,
  entrySrcDir: string,
  npmDistDir: string,
  npmBuilder: string,
  entryFile: string,
): Promise<void> {
  // =====================================================
  // [dist-npm] 1. Initialize
  // =====================================================
  relinka("info", "Building NPM distribution...");
  const entrySrcDirResolved = resolve(process.cwd(), entrySrcDir);
  const entryFilePath = path.join(entrySrcDirResolved, entryFile);
  const npmDistDirResolved = resolve(process.cwd(), npmDistDir);
  const outdirBinResolved = path.resolve(npmDistDirResolved, "bin");
  await ensuredir(npmDistDirResolved);
  await ensuredir(outdirBinResolved);
  relinka("info", `Using NPM builder: ${npmBuilder}`);

  // =====================================================
  // [dist-npm] 2. Build using the appropriate builder
  // =====================================================
  if (npmBuilder === "jsr") {
    await regular_bundleUsingJsr(entrySrcDirResolved, outdirBinResolved);
  } else if (npmBuilder === "bun") {
    await regular_bundleUsingBun(entryFilePath, outdirBinResolved, "");
  } else {
    await regular_bundleUsingUnified(
      entryFilePath,
      outdirBinResolved,
      npmBuilder,
    );
  }

  // =====================================================
  // [dist-npm] 3. Perform common build steps
  // =====================================================
  await regular_performCommonBuildSteps({
    outdirBinResolved,
    outdirRoot: npmDistDirResolved,
    entryFile,
    entrySrcDir,
    isJsr: false,
  });

  // =====================================================
  // [dist-npm] 4. Perform additional steps
  // =====================================================
  const dirSize = await getDirectorySize(npmDistDirResolved, isDev);
  const filesCount = await outdirBinFilesCount(outdirBinResolved);
  relinka(
    "success",
    `NPM distribution built successfully (${filesCount} files, ${prettyBytes(dirSize)})`,
  );
}

/**
 * Builds a lib distribution for JSR.
 */
async function library_buildJsrDist(
  isDev: boolean,
  libName: string,
  entrySrcDir: string,
  jsrDistDir: string,
  jsrBuilder: string,
  entryFile: string,
  isCLI: boolean,
  libs: Record<string, LibConfig>,
  excludeMode: ExcludeMode,
  excludedDependencyPatterns: string[],
  npmOutFilesExt: string,
  target: Target,
  format: Format,
  splitting: boolean,
  minify: boolean,
  sourcemap: Sourcemap,
  publicPath: string,
  outdirBin: string,
): Promise<void> {
  // =====================================================
  // [dist-jsr] 1. Initialize
  // =====================================================
  relinka("info", "Building JSR distribution...");
  const entrySrcDirResolved = resolve(process.cwd(), entrySrcDir);
  const entryFilePath = path.join(entrySrcDirResolved, entryFile);
  const jsrDistDirResolved = resolve(process.cwd(), jsrDistDir);
  const outdirBinResolved = path.resolve(jsrDistDirResolved, "bin");
  await ensuredir(jsrDistDirResolved);
  await ensuredir(outdirBinResolved);
  relinka("info", `Using JSR builder: ${jsrBuilder}`);

  // =====================================================
  // [dist-jsr] 2. Build using the appropriate builder
  // =====================================================
  if (jsrBuilder === "jsr") {
    await library_bundleUsingJsr(entrySrcDirResolved, outdirBinResolved);
  } else if (jsrBuilder === "bun") {
    await library_bundleUsingBun(
      entryFile,
      outdirBin,
      libName,
      target,
      format,
      splitting,
      minify,
      sourcemap,
      publicPath,
    );
  } else {
    await library_bundleUsingUnified(
      entryFilePath,
      outdirBinResolved,
      "mkdist",
      true,
    );
  }

  // =====================================================
  // [dist-jsr] 3. Perform common build steps
  // =====================================================
  await library_performCommonBuildSteps({
    libName,
    entryDir: entrySrcDirResolved,
    outdirRoot: jsrDistDirResolved,
    isDev,
    isJsr: true,
    isCLI,
    libs,
    excludeMode,
    excludedDependencyPatterns,
    npmOutFilesExt,
  });

  // =====================================================
  // [dist-jsr] 4. Perform additional steps
  // =====================================================
  await convertImportExtensionsJsToTs(outdirBinResolved);
  await renameTsxFiles(outdirBinResolved);
  await createJsrJSONC(jsrDistDirResolved, false);
  if (isCLI) {
    await createTSConfig(jsrDistDirResolved, true);
  }

  // =====================================================
  // [dist-jsr] 5. Finalize
  // =====================================================
  const dirSize = await getDirectorySize(jsrDistDirResolved, isDev);
  const filesCount = await outdirBinFilesCount(outdirBinResolved);
  relinka(
    "success",
    `JSR distribution built successfully (${filesCount} files, ${prettyBytes(dirSize)})`,
  );
}

/**
 * Builds a lib distribution for JSR.
 * @deprecated TODO: remove
 */
async function _library_buildJsrDist2(
  libName: string,
  libEntryDir: string,
  libOutdirRoot: string,
  libEntryFile: string,
  isDev: boolean,
  entrySrcDir: string,
  jsrBuilder: string,
  libs: Record<string, LibConfig>,
  isCLI: boolean,
): Promise<void> {
  // =====================================================
  // [dist-libs/jsr] 1. Initialize
  // =====================================================
  const distName = determineDistName(libOutdirRoot, true);
  relinka(
    "verbose",
    `[${distName}] Starting library_buildJsrDist for lib: ${libName}`,
  );
  const libOutdirBinResolved = path.resolve(libOutdirRoot, "bin");
  relinka("info", `[${distName}] Building JSR dist for lib: ${libName}...`);
  const entrySrcDirResolved = resolve(process.cwd(), entrySrcDir);
  // Get the library-specific source directory
  const libNameSimple = libName.split("/").pop() || libName;
  // Extract the actual directory from the main file path in the config
  let libSrcDir = path.join(entrySrcDirResolved, "libs", libNameSimple);
  // Check if we have a main file path in the config
  const libConfig = libs?.[libName];
  if (libConfig?.main) {
    const mainFilePath = libConfig.main;
    const libDirMatch = /src\/libs\/([^/]+)\//.exec(mainFilePath);
    if (libDirMatch?.[1]) {
      // Use the directory from the main file path
      const actualLibDir = libDirMatch[1];
      libSrcDir = path.join(entrySrcDirResolved, "libs", actualLibDir);
    }
  }

  // =====================================================
  // [dist-libs/jsr] 2. Build using the appropriate builder
  // =====================================================
  if (jsrBuilder === "jsr") {
    await library_bundleUsingJsr(
      libSrcDir,
      libOutdirBinResolved,
      // entrySrcDirResolved,
      // isDev,
      // true,
    );
  } else if (jsrBuilder === "bun") {
    await library_bundleUsingBun(libEntryFile, libOutdirBinResolved, libName);
  } else {
    // Construct the full path to the entry file
    // For library builds, we need to use the library-specific entry file path
    const libEntryFilePath = path.join(libSrcDir, path.basename(libEntryFile));
    relinka("verbose", `[${distName}] libEntryFilePath: ${libEntryFilePath}`);
    relinka(
      "verbose",
      `[${distName}] libOutdirBinResolved: ${libOutdirBinResolved}`,
    );
    await library_bundleUsingUnified(
      libEntryFilePath,
      libOutdirBinResolved,
      "mkdist",
      true,
    );
  }

  // =====================================================
  // [dist-libs/jsr] 3. Perform common library build steps
  // =====================================================
  await library_performCommonBuildSteps({
    libName,
    entryDir: libEntryDir,
    outdirRoot: libOutdirRoot,
    isDev,
    isJsr: true,
  });

  // =====================================================
  // [dist-libs/jsr] 4. Perform additional steps
  // =====================================================
  await convertImportExtensionsJsToTs(libOutdirBinResolved);
  const { updatedEntryFile } = await renameEntryFile(
    true,
    libOutdirBinResolved,
    libEntryDir,
    libEntryFile,
  );
  await createJsrJSONC(libOutdirRoot, true, libName);
  await renameTsxFiles(libOutdirBinResolved);
  if (isCLI) {
    await createTSConfig(libOutdirRoot, true);
  }

  // =====================================================
  // [dist-libs/jsr] 5. Finalize
  // =====================================================
  const size = await getDirectorySize(libOutdirRoot, isDev);
  relinka(
    "success",
    `[${distName}] Successfully created JSR distribution for ${libName} (${updatedEntryFile}) (${prettyBytes(size)})`,
  );
  relinka(
    "verbose",
    `[${distName}] Exiting library_buildJsrDist for lib: ${libName}`,
  );
}

/**
 * Builds a lib distribution for NPM.
 */
async function library_buildNpmDist(
  libName: string,
  libEntryDir: string,
  libOutdirRoot: string,
  libEntryFile: string,
  isDev: boolean,
  entrySrcDir: string,
  npmBuilder: string,
  libs: Record<string, LibConfig>,
): Promise<void> {
  // =====================================================
  // [dist-libs/npm] 1. Initialize
  // =====================================================
  const distName = determineDistName(libOutdirRoot, false);
  relinka(
    "verbose",
    `[${distName}] Starting library_buildNpmDist for lib: ${libName}`,
  );
  const libOutdirBinResolved = path.resolve(libOutdirRoot, "bin");
  relinka("info", `[${distName}] Building NPM dist for lib: ${libName}...`);
  const entrySrcDirResolved = resolve(process.cwd(), entrySrcDir);
  // Get the library-specific source directory
  const libNameSimple = libName.split("/").pop() || libName;
  // Extract the actual directory from the main file path in the config
  let libSrcDir = path.join(entrySrcDirResolved, "libs", libNameSimple);
  // Check if we have a main file path in the config
  const libConfig = libs?.[libName];
  if (libConfig?.main) {
    const mainFilePath = libConfig.main;
    const libDirMatch = /src\/libs\/([^/]+)\//.exec(mainFilePath);
    if (libDirMatch?.[1]) {
      // Use the directory from the main file path
      const actualLibDir = libDirMatch[1];
      libSrcDir = path.join(entrySrcDirResolved, "libs", actualLibDir);
    }
  }

  // =====================================================
  // [dist-libs/npm] 2. Build using the appropriate builder
  // =====================================================
  if (npmBuilder === "jsr") {
    await library_bundleUsingJsr(
      libSrcDir,
      libOutdirBinResolved,
      // entrySrcDirResolved,
      // isDev,
      // false,
    );
  } else if (npmBuilder === "bun") {
    await library_bundleUsingBun(libEntryFile, libOutdirBinResolved, libName);
  } else {
    // Construct the full path to the entry file
    // For library builds, we need to use the library-specific entry file path
    const libEntryFilePath = path.join(libSrcDir, path.basename(libEntryFile));
    relinka("verbose", `[${distName}] libEntryFilePath: ${libEntryFilePath}`);
    relinka(
      "verbose",
      `[${distName}] libOutdirBinResolved: ${libOutdirBinResolved}`,
    );
    await library_bundleUsingUnified(
      libEntryFilePath,
      libOutdirBinResolved,
      npmBuilder,
      false,
    );
  }

  // =====================================================
  // [dist-libs/npm] 3. Perform common library build steps
  // =====================================================
  await library_performCommonBuildSteps({
    libName,
    entryDir: libEntryDir,
    outdirRoot: libOutdirRoot,
    isDev,
    isJsr: false,
  });

  // =====================================================
  // [dist-libs/npm] 4. Perform additional steps
  // =====================================================
  const { updatedEntryFile } = await renameEntryFile(
    false,
    libOutdirBinResolved,
    libEntryDir,
    libEntryFile,
  );

  // =====================================================
  // [dist-libs/npm] 5. Finalize
  // =====================================================
  const size = await getDirectorySize(libOutdirRoot, isDev);
  relinka(
    "success",
    `[${distName}] Successfully created NPM distribution for ${libName} (${updatedEntryFile}) (${prettyBytes(size)})`,
  );
  relinka(
    "verbose",
    `[${distName}] Exiting library_buildNpmDist for lib: ${libName}`,
  );
}

/**
 * Publishes a lib to JSR.
 */
async function library_pubToJsr(
  libOutDir: string,
  dryRun: boolean,
  libName: string,
  isDev: boolean,
  timer: Timer,
): Promise<void> {
  relinka("verbose", `Starting library_pubToJsr for lib: ${libName}`);
  if (isDev) {
    relinka("info", `Skipping lib ${libName} JSR publish in development mode`);
    return;
  }
  try {
    // Pause the timer before publishing (interactive)
    if (timer) pauseTimer(timer);

    await withWorkingDirectory(libOutDir, async () => {
      relinka("info", `Publishing lib ${libName} to JSR from ${libOutDir}`);
      const command = [
        "bun x jsr publish",
        dryRun ? "--dry-run" : "",
        jsrAllowDirty ? "--allow-dirty" : "",
        jsrSlowTypes ? "--allow-slow-types" : "",
      ]
        .filter(Boolean)
        .join(" ");
      await execaCommand(command, { stdio: "inherit" });
      relinka(
        "success",
        `Successfully ${dryRun ? "validated" : "published"} lib ${libName} to JSR`,
      );
    });

    // Resume the timer after publishing is complete
    if (timer) resumeTimer(timer);
  } catch (error) {
    // Resume timer even on error
    if (timer) resumeTimer(timer);
    relinka("error", `Failed to publish lib ${libName} to JSR`, error);
    throw error;
  } finally {
    relinka("verbose", `Exiting library_pubToJsr for lib: ${libName}`);
  }
}

/**
 * Publishes a lib to NPM.
 */
async function library_pubToNpm(
  libOutDir: string,
  dryRun: boolean,
  libName: string,
  isDev: boolean,
  timer: Timer,
): Promise<void> {
  relinka("verbose", `Starting library_pubToNpm for lib: ${libName}`);
  if (isDev) {
    relinka("info", `Skipping lib ${libName} NPM publish in development mode`);
    return;
  }
  try {
    // Pause the timer before publishing (non-interactive)
    if (timer) pauseTimer(timer);

    await withWorkingDirectory(libOutDir, async () => {
      relinka("info", `Publishing lib ${libName} to NPM from ${libOutDir}`);
      const command = ["bun publish", dryRun ? "--dry-run" : ""]
        .filter(Boolean)
        .join(" ");
      await execaCommand(command, { stdio: "inherit" });
      relinka(
        "success",
        `Successfully ${dryRun ? "validated" : "published"} lib ${libName} to NPM`,
      );
    });

    // Resume the timer after publishing is complete
    if (timer) resumeTimer(timer);
  } catch (error) {
    // Resume timer even on error
    if (timer) resumeTimer(timer);
    relinka("error", `Failed to publish lib ${libName} to NPM`, error);
    throw error;
  } finally {
    relinka("verbose", `Exiting library_pubToNpm for lib: ${libName}`);
  }
}

/**
 * Extracts folder name from library name, handling scoped packages.
 */
function extractFolderName(libName: string): string {
  if (libName.startsWith("@")) {
    const parts = libName.split("/");
    if (parts.length > 1) return parts[1]!;
  }
  return libName;
}

/**
 * Publishes a library to the specified registry.
 */
async function publishLibrary(
  registry: string | undefined,
  libName: string,
  npmOutDir: string,
  jsrOutDir: string,
  dryRun: boolean,
  isDev: boolean,
  timer: Timer,
): Promise<void> {
  // Skip publishing in development mode
  if (isDev) {
    relinka(
      "info",
      `Skipping publishing for lib ${libName} in development mode`,
    );
    return;
  }

  switch (registry) {
    case "npm-jsr": {
      relinka("info", `Publishing lib ${libName} to both NPM and JSR...`);

      // Create publish tasks
      const publishTasks = [
        () => library_pubToNpm(npmOutDir, dryRun, libName, isDev, timer),
        () => library_pubToJsr(jsrOutDir, dryRun, libName, isDev, timer),
      ];

      // Run publish tasks
      await pAll(publishTasks, { concurrency: 2 });
      break;
    }

    case "npm":
      relinka("info", `Publishing lib ${libName} to NPM only...`);
      await library_pubToNpm(npmOutDir, dryRun, libName, isDev, timer);
      break;

    case "jsr":
      relinka("info", `Publishing lib ${libName} to JSR only...`);
      await library_pubToJsr(jsrOutDir, dryRun, libName, isDev, timer);
      break;

    default:
      relinka(
        "info",
        `Registry "${registry}" not recognized for lib ${libName}. Skipping publishing for this lib.`,
      );
  }
}

/**
 * Builds a library for the specified registry.
 */
async function buildLibrary(
  registry: string | undefined,
  libName: string,
  mainDir: string,
  npmOutDir: string,
  mainFile: string,
  isDev: boolean,
): Promise<void> {
  switch (registry) {
    case "npm-jsr": {
      relinka("info", `Building lib ${libName} for NPM and JSR...`);

      // Create build tasks
      const buildTasks = [
        () =>
          library_buildNpmDist(libName, mainDir, npmOutDir, mainFile, isDev),
        () => library_buildJsrDist(isDev, libName),
      ];

      // Run build tasks
      await pAll(buildTasks, {
        concurrency: 2,
      });
      break;
    }

    case "npm":
      relinka("info", `Building lib ${libName} for NPM-only...`);
      await library_buildNpmDist(libName, mainDir, npmOutDir, mainFile, isDev);
      break;

    case "jsr":
      relinka("info", `Building lib ${libName} for JSR-only...`);
      await library_buildJsrDist(
        isDev,
        libName,
        // mainDir,
        // jsrOutDir,
        // mainFile,
      );
      break;

    default:
      relinka(
        "warn",
        `Unknown registry "${registry}" for lib ${libName}. Skipping build.`,
      );
  }
}

/**
 * Processes all libs defined in config.libs.
 * Builds and optionally publishes each library based on configuration.
 */
export async function libraries_buildPublish(
  isDev: boolean,
  timer: Timer,
): Promise<void> {
  relinka("verbose", "Starting libraries_buildPublish");

  if (!libs || Object.keys(libs).length === 0) {
    relinka("info", "No lib configs found in config, skipping libs build.");
    return;
  }

  relinka("verbose", `libs: ${JSON.stringify(libs, null, 2)}`);
  relinka(
    "verbose",
    "Library configurations detected in config, processing libs...",
  );
  const libs = Object.entries(libs);
  const dry = !!dryRun;

  // Get the configured directories or use defaults
  const libsDistDir = libsDistDir || "dist-libs";
  const libsSrcDir = libsSrcDir || "src/libs";

  // Create tasks for each library
  const tasks = libs.map(([libName, libConfig]) => async () => {
    try {
      if (!libConfig.main) {
        relinka(
          "info",
          `Library ${libName} is missing "main" property. Skipping...`,
        );
        return;
      }

      // Extract folder name from library name
      const folderName = extractFolderName(libName);

      // Setup base output directory
      const libBaseDir = path.resolve(PROJECT_ROOT, libsDistDir, folderName);
      const npmOutDir = path.join(libBaseDir, "npm");
      const jsrOutDir = path.join(libBaseDir, "jsr");

      // Parse main file path and determine if it's already a full path
      const libMainPath = path.parse(libConfig.main);
      const libMainFile = libMainPath.base;

      // Determine the main directory
      let libMainDir: string;

      // If main path already starts with libsSrcDir, use it directly
      if (libConfig.main.startsWith(libsSrcDir)) {
        libMainDir = libMainPath.dir || ".";
      } else {
        // Otherwise, compose the path by joining libsSrcDir with the main path's directory
        // This handles cases where main is just the relative path within libsSrcDir
        libMainDir = path.join(libsSrcDir, libMainPath.dir || ".");
      }

      relinka(
        "verbose",
        `Processing library ${libName}: libMainDir=${libMainDir}, libMainFile=${libMainFile}`,
      );

      // Build phase
      await buildLibrary(
        registry,
        libName,
        libMainDir,
        npmOutDir,
        libMainFile,
        isDev,
      );

      // Publish phase (if not paused)
      if (!pausePublish) {
        await publishLibrary(
          registry,
          libName,
          npmOutDir,
          jsrOutDir,
          dry,
          isDev,
          timer,
        );
      }
    } catch (error) {
      relinka(
        "error",
        `Failed to process library ${libName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (isDev) {
        relinka(
          "verbose",
          `Error details: ${error instanceof Error ? error.stack : "No stack trace available"}`,
        );
      }
      // Re-throw to allow pAll to handle the error based on stopOnError option
      throw error;
    }
  });

  // Determine optimal concurrency based on configuration and system
  const concurrency = CONCURRENCY_DEFAULT;

  try {
    // Run tasks with concurrency control and error handling
    await pAll(tasks, {
      concurrency,
    });
    relinka("verbose", "Completed libraries_buildPublish");
  } catch (error) {
    if (error instanceof AggregateError) {
      relinka(
        "error",
        "Multiple libraries failed to process. See above for details.",
      );
    } else {
      relinka("error", "Library processing stopped due to an error.");
    }
    throw error;
  }
}

/**
 * Processes libraries based on build mode.
 */
async function processLibraries(
  timer: Timer,
  isDev: boolean,
  buildPublishMode: string,
): Promise<void> {
  // Skip if not building libraries
  if (
    buildPublishMode !== "libs-only" &&
    buildPublishMode !== "main-and-libs"
  ) {
    relinka(
      "verbose",
      "Skipping libs build/publish as buildPublishMode is set to 'main-project-only'",
    );
    return;
  }

  // Process libraries with timer
  await libraries_buildPublish(isDev, timer);
}

/**
 * Processes the main project based on build mode and registry.
 */
async function processMainProject(
  timer: Timer,
  isDev: boolean,
  buildPublishMode: string,
  registry: string,
  entrySrcDir: string,
  npmDistDir: string,
  npmBuilder: string,
  entryFile: string,
  dryRun: boolean,
  pausePublish: boolean,
  jsrDistDir: string,
  jsrAllowDirty: boolean,
  jsrSlowTypes: boolean,
): Promise<void> {
  // Skip if not building main project
  if (
    buildPublishMode !== "main-project-only" &&
    buildPublishMode !== "main-and-libs"
  ) {
    relinka(
      "info",
      "Skipping main project build/publish as buildPublishMode is set to 'libs-only'",
    );
    return;
  }

  // Build and publish based on registry type
  switch (registry) {
    case "npm-jsr": {
      relinka(
        "info",
        "Initializing build process for main project to both NPM and JSR...",
      );

      // Create build tasks
      const buildTasks = [
        () => regular_buildJsrDist(isDev, true),
        () =>
          regular_buildNpmDist(
            isDev,
            entrySrcDir,
            npmDistDir,
            npmBuilder,
            entryFile,
          ),
      ];

      // Run build tasks
      await pAll(buildTasks, {
        concurrency: 2,
      });

      if (!isDev) {
        // Create publish tasks with timer
        const publishTasks = [
          () =>
            regular_pubToJsr(
              dryRun,
              isDev,
              pausePublish,
              jsrDistDir,
              jsrAllowDirty,
              jsrSlowTypes,
              timer,
            ),
          () =>
            regular_pubToNpm(dryRun, isDev, pausePublish, npmDistDir, timer),
        ];

        // Run publish tasks
        await pAll(publishTasks, { concurrency: 2 });
      }
      break;
    }

    case "npm":
      relinka(
        "info",
        "Initializing build process for main project to NPM only...",
      );
      await regular_buildNpmDist(isDev);

      if (!isDev) {
        await regular_pubToNpm(dryRun, isDev, pausePublish, npmDistDir, timer);
      }
      break;

    case "jsr":
      relinka(
        "info",
        "Initializing build process for main project to JSR only...",
      );
      await regular_buildJsrDist(isDev, true);

      if (!isDev) {
        await regular_pubToJsr(
          dryRun,
          isDev,
          pausePublish,
          jsrDistDir,
          jsrAllowDirty,
          jsrSlowTypes,
          timer,
        );
      }
      break;

    default: {
      relinka(
        "warn",
        `Registry "${registry}" not recognized. Building main project only...`,
      );

      // Create build tasks for unknown registry
      const fallbackBuildTasks = [
        () =>
          regular_buildNpmDist(
            isDev,
            entrySrcDir,
            npmDistDir,
            npmBuilder,
            entryFile,
          ),
        () => regular_buildJsrDist(isDev, true),
      ];

      // Run build tasks
      await pAll(fallbackBuildTasks, {
        concurrency: 2,
      });
    }
  }
}

/**
 * Finalizes the build process and reports completion.
 */
async function finalizeBuild(
  timer: Timer,
  pausePublish: boolean,
  libs: Record<string, any>,
  npmDistDir: string,
  jsrDistDir: string,
  libsDistDir: string,
): Promise<void> {
  if (!pausePublish) {
    // Clean up after successful publish
    await removeDistFolders(npmDistDir, jsrDistDir, libsDistDir, libs);
    await setBumpDisabled(false, pausePublish);
  }

  // Calculate and report elapsed time
  const elapsedTime = getElapsedTime(timer);
  const formattedTime = prettyMilliseconds(elapsedTime, { verbose: true });

  // Report success message
  if (!pausePublish) {
    relinka(
      "success",
      `🎉 ${re.bold("Build and publishing completed")} successfully in ${re.bold(formattedTime)}!`,
    );
  } else {
    relinka(
      "success",
      `🎉 ${re.bold("Test build completed")} successfully in ${re.bold(formattedTime)}!`,
    );
    relinka("info", "📝 Publish process is paused in the config file.");
  }
}

// ============================
// Relidler Main Function
// ============================

/**
 * Main entry point for the relidler build and publish process.
 * Handles building and publishing for both main project and libraries.
 */
export async function relidler(isDev: boolean) {
  // Create a performance timer
  const timer = createTimer();

  try {
    // Load config with defaults and user overrides
    // This config load is a single source of truth
    const config = await loadConfig();

    // Prepare environment
    if (isDev) {
      config.pausePublish = true;
      config.disableBump = true;
      relinka(
        "info",
        "Development mode: Publishing paused and version bumping disabled.",
      );
    }

    // Clean up previous run artifacts
    if (config.freshLogFile) {
      await fs.remove(path.join(process.cwd(), config.logFile));
    }
    await removeDistFolders(
      config.npmDistDir,
      config.jsrDistDir,
      config.libsDistDir,
      config.libs,
    );

    // Handle version bumping if enabled
    if (!config.disableBump) {
      await bumpHandler(
        config.bumpMode,
        config.disableBump,
        config.pausePublish,
        config.bumpFilter,
      );
    }

    // Pass the timer to the process functions
    await processMainProject(timer, isDev);
    await processLibraries(timer, isDev);

    // Finalize the build process
    await finalizeBuild(
      timer,
      config.pausePublish,
      config.libs,
      config.npmDistDir,
      config.jsrDistDir,
      config.libsDistDir,
    );
  } catch (error) {
    handleBuildError(error, timer);
  }
}
