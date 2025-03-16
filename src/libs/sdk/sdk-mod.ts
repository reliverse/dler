import { re } from "@reliverse/relico";
import { build as bunBuild } from "bun";
import { execaCommand } from "execa";
import fs from "fs-extra";
import pAll from "p-all";
import pMap from "p-map";
import pRetry from "p-retry";
import pTimeout from "p-timeout";
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

import type { BuildPublishConfig } from "~/types.js";

import { relinka } from "~/utils.js";

import type { UnifiedBuildConfig } from "./sdk-main.js";

import { loadConfig } from "./sdk-load.js";
import { build as unifiedBuild } from "./sdk-utils/build.js";
import { convertImportPaths, extractPackageName } from "./sdk-utils/paths.js";
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
  unstable_copyFileWithImports: true,
};

function disableFunction(funcName: keyof typeof DEBUG_DISABLE) {
  relinka("verbose", `[DEBUG_DISABLE] Skipping ${funcName}...`);
}

// ============================
// Constants & Global Setup
// ============================

const tsconfigJson = "tsconfig.json";
const cliDomainDocs = "https://docs.reliverse.org";

const PROJECT_ROOT = path.resolve(process.cwd());
const DIST_FOLDERS = ["dist-npm", "dist-jsr", "dist-libs"];
const JSON_FILE_PATTERN = "**/*.{ts,json,jsonc,json5}";
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

// Default concurrency for parallel tasks
const CONCURRENCY_DEFAULT = 5;

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
// CLI Flags Parsing & Help
// ============================

/**
 * Get a configuration merged with CLI flags.
 * This applies CLI flags on top of the user's loaded configuration.
 */
export async function getConfigWithCliFlags(
  isDev: boolean,
  flags?: {
    bump?: string;
    registry?: string;
    verbose?: boolean;
    dryRun?: boolean;
    jsrAllowDirty?: boolean;
    jsrSlowTypes?: boolean;
  },
): Promise<BuildPublishConfig> {
  relinka(
    "verbose",
    `Entering getConfigWithCliFlags with flags: ${JSON.stringify(flags)}`,
  );
  // First load the user's configuration
  const userConfig = await loadConfig();
  relinka("verbose", "User config loaded");

  // Clone the config to avoid modifying the original
  const config = { ...userConfig };

  // Override with CLI flags if provided
  if (flags) {
    if (flags.verbose !== undefined) {
      config.verbose = flags.verbose;
    }
    if (flags.dryRun !== undefined) {
      config.dryRun = flags.dryRun;
    }
    if (flags.registry) {
      if (["npm", "jsr", "npm-jsr"].includes(flags.registry)) {
        config.registry = flags.registry as "npm" | "jsr" | "npm-jsr";
      } else {
        relinka(
          "warn",
          `Warning: Unrecognized registry "${flags.registry}". Using config value: ${config.registry}`,
        );
      }
    }
    if (flags.jsrAllowDirty !== undefined) {
      config.jsrAllowDirty = flags.jsrAllowDirty;
    }
    if (flags.jsrSlowTypes !== undefined) {
      config.jsrSlowTypes = flags.jsrSlowTypes;
    }
  }

  // Always set pausePublish and disableBump to true in development mode
  if (isDev) {
    config.pausePublish = true;
    config.disableBump = true;
    relinka(
      "info",
      "Development mode: Publishing paused and version bumping disabled.",
    );
  }
  relinka(
    "verbose",
    `Exiting getConfigWithCliFlags with config: ${JSON.stringify(config)}`,
  );
  return config;
}

// ============================
// Helper Functions & Utilities
// ============================

/**
 * Executes a shell command with retries and a timeout.
 */
async function runCommand(command: string): Promise<void> {
  relinka("verbose", `Entering runCommand with command: ${command}`);
  try {
    relinka("verbose", `Executing command: ${command}`);
    await pRetry(
      () =>
        pTimeout(execaCommand(command, { stdio: "inherit" }), {
          milliseconds: 60000,
          message: `Command timed out after 60 seconds: ${command}`,
        }),
      {
        retries: 3,
        onFailedAttempt: (error) =>
          relinka(
            "warn",
            `Command attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left. ${String(error)}`,
          ),
      },
    );
    relinka("verbose", `Command executed successfully: ${command}`);
  } catch (error) {
    relinka("error", `Command failed: ${command}`, error);
    throw error;
  } finally {
    relinka("verbose", `Exiting runCommand for command: ${command}`);
  }
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
export async function removeDistFolders(): Promise<boolean> {
  relinka("verbose", "Starting removeDistFolders");
  const existingFolders: string[] = [];
  for (const folder of DIST_FOLDERS) {
    const folderPath = path.resolve(PROJECT_ROOT, folder);
    if (await fs.pathExists(folderPath)) {
      existingFolders.push(folder);
    }
  }
  if (existingFolders.length > 0) {
    relinka(
      "info",
      `Found existing distribution folders: ${existingFolders.join(", ")}`,
    );
    await pMap(
      DIST_FOLDERS,
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
  relinka("verbose", `Searching for file (case-insensitive): ${targetFile}`);
  const files = await fs.readdir(".");
  const found = files.find(
    (file) => file.toLowerCase() === targetFile.toLowerCase(),
  );
  relinka("verbose", `findFileCaseInsensitive result: ${found}`);
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

// ============================
// Version Bumping Functions
// ============================

/**
 * Updates version strings in files based on file type.
 */
async function bumpVersions(
  oldVersion: string,
  newVersion: string,
): Promise<void> {
  relinka(
    "verbose",
    `Starting bumpVersions from ${oldVersion} to ${newVersion}`,
  );
  try {
    const modifiedCount = await processFilesInDirectory(
      "",
      process.cwd(),
      [JSON_FILE_PATTERN],
      async (file, content) => {
        const modified = await updateVersionInContent(
          file,
          content,
          oldVersion,
          newVersion,
        );
        // updateVersionInContent returns a boolean and handles file writing internally
        return { modified, newContent: undefined };
      },
      { concurrency: CONCURRENCY_DEFAULT, ignore: IGNORE_PATTERNS },
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
 * Auto-increments a semantic version based on the specified bump mode.
 */
function autoIncrementVersion(
  oldVersion: string,
  mode: "autoPatch" | "autoMinor" | "autoMajor",
): string {
  relinka(
    "verbose",
    `Auto incrementing version ${oldVersion} using mode: ${mode}`,
  );
  if (!semver.valid(oldVersion)) {
    throw new Error(`Can't auto-increment invalid version: ${oldVersion}`);
  }
  const releaseTypeMap = {
    autoPatch: "patch",
    autoMinor: "minor",
    autoMajor: "major",
  } as const;
  const newVer = semver.inc(oldVersion, releaseTypeMap[mode]);
  if (!newVer) {
    throw new Error(`semver.inc failed for ${oldVersion} and mode ${mode}`);
  }
  relinka("verbose", `Auto incremented version: ${newVer}`);
  return newVer;
}

/**
 * Updates the "disableBump" flag in the build configuration file.
 */
export async function setBumpDisabled(
  value: boolean,
  isDev: boolean,
): Promise<void> {
  relinka("verbose", `Entering setBumpDisabled with value: ${value}`);
  const config = await getConfigWithCliFlags(isDev);

  if (config.pausePublish && value) {
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
  relinka("info", `Updated disableBump to ${value}`);
}

/**
 * Handles version bumping.
 */
export async function bumpHandler(
  isDev: boolean,
  flags?: {
    bump?: string;
  },
): Promise<void> {
  relinka(
    "verbose",
    `Entering bumpHandler with flags: ${JSON.stringify(flags)}`,
  );
  const config = await getConfigWithCliFlags(isDev, flags);

  if (config.disableBump || config.pausePublish) {
    relinka(
      "info",
      "Skipping version bump because it is either `disableBump: true` or `pausePublish: true` in your relidler config.",
    );
    return;
  }

  const bumpVersion = flags?.bump;

  const pkgPath = path.resolve("package.json");
  if (!(await fs.pathExists(pkgPath))) {
    throw new Error("package.json not found");
  }
  const pkgJson = await readPackageJSON();
  if (!pkgJson.version) {
    throw new Error("No version field found in package.json");
  }
  const oldVersion = pkgJson.version;

  if (bumpVersion) {
    if (!semver.valid(bumpVersion)) {
      throw new Error(`Invalid version format for --bump: "${bumpVersion}"`);
    }
    if (oldVersion !== bumpVersion) {
      await bumpVersions(oldVersion, bumpVersion);
      await setBumpDisabled(true, isDev);
    } else {
      relinka("info", `Version is already at ${oldVersion}, no bump needed.`);
    }
  } else {
    if (!semver.valid(oldVersion)) {
      throw new Error(
        `Invalid existing version in package.json: ${oldVersion}`,
      );
    }
    relinka(
      "info",
      `Auto-incrementing version from ${oldVersion} using "${config.bump}"`,
    );
    const incremented = autoIncrementVersion(oldVersion, config.bump);
    if (oldVersion !== incremented) {
      await bumpVersions(oldVersion, incremented);
      await setBumpDisabled(true, isDev);
    } else {
      relinka("info", `Version is already at ${oldVersion}, no bump needed.`);
    }
  }
  relinka("verbose", "Exiting bumpHandler");
}

// ============================
// Package & TSConfig Generation
// ============================

/**
 * Creates common package.json fields based on the original package.json.
 */
async function createCommonPackageFields(): Promise<Partial<PackageJson>> {
  relinka("verbose", "Generating common package fields");
  const originalPkg = await readPackageJSON();
  const { name, author, version, license, description, keywords } = originalPkg;
  const config = await loadConfig();
  const isCLI = config.isCLI;

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
      `isCLI is true, adding CLI-specific fields to common package fields`,
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
    relinka("verbose", `isCLI is false, skipping CLI-specific fields`);
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
  config?: BuildPublishConfig,
): Promise<Record<string, string>> {
  relinka("verbose", `Filtering dependencies (clearUnused=${clearUnused})`);
  if (!deps) return {};

  // Load config if not provided
  if (!config) {
    config = await loadConfig();
  }

  // Get excluded dependency patterns from config
  const excludedPatterns = config.excludedDependencyPatterns;

  if (!clearUnused) {
    const filtered = Object.entries(deps).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        // Check if the dependency name matches any of the excluded patterns
        const shouldExclude = excludedPatterns.some((pattern) =>
          k.toLowerCase().includes(pattern.toLowerCase()),
        );

        if (!shouldExclude) {
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
      // Check if the dependency name matches any of the excluded patterns
      const shouldExclude = excludedPatterns.some((pattern) =>
        k.toLowerCase().includes(pattern.toLowerCase()),
      );

      if (usedPackages.has(k) && !shouldExclude) {
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
 * @param libName - The name of the lib
 * @param originalDeps - The original dependencies from package.json
 * @param outdirBin - The output directory for the lib
 * @returns A filtered record of dependencies
 */
async function getLibDependencies(
  libName: string,
  originalDeps: Record<string, string> | undefined,
  outdirBin: string,
  isJsr: boolean,
): Promise<Record<string, string>> {
  relinka("verbose", `Getting lib dependencies for: ${libName}`);
  if (!originalDeps) return {};

  // Load the config to get the latest libs configuration
  const config = await loadConfig();

  // Check if the lib has a dependencies configuration
  const libConfig = config.libs?.[libName];
  if (!libConfig) {
    // Default behavior - filter based on usage
    const result = await filterDeps(
      originalDeps,
      true,
      outdirBin,
      isJsr,
      config,
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

    // Get excluded dependency patterns from config
    const excludedPatterns = config.excludedDependencyPatterns;

    const result = Object.entries(originalDeps).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        // Check if the dependency name matches any of the excluded patterns
        const shouldExclude = excludedPatterns.some((pattern) =>
          k.toLowerCase().includes(pattern.toLowerCase()),
        );

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
  const result = await filterDeps(originalDeps, true, outdirBin, isJsr, config);
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
): Promise<void> {
  relinka(
    "info",
    `Generating distribution package.json and tsconfig.json (isJsr=${isJsr})...`,
  );
  const commonPkg = await createCommonPackageFields();
  const originalPkg = await readPackageJSON();
  const packageName = originalPkg.name || "";
  const cliCommandName = packageName.startsWith("@")
    ? packageName.split("/").pop() || "cli"
    : packageName;

  const config = await loadConfig();
  const isCLI = config.isCLI;

  relinka(
    "verbose",
    `Package name: "${packageName}", CLI command name: "${cliCommandName}", isCLI: ${isCLI}`,
  );

  const outdirBin = path.join(outdirRoot, "bin");
  const outExt = config.npmOutFilesExt || "js";

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
        config,
      ),
      devDependencies: await filterDeps(
        originalPkg.devDependencies,
        false,
        outdirBin,
        isJsr,
        config,
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
        config,
      ),
      devDependencies: await filterDeps(
        originalPkg.devDependencies,
        false,
        outdirBin,
        isJsr,
        config,
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
 * @param filePath The path of the file being processed
 * @param isJsr Whether the build is for JSR (true) or NPM (false), or "" for root
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
 * Replaces import extensions in files within the given directory.
 * @param outdirBin Directory to process
 * @param fromExt Extension to replace (e.g., '.js')
 * @param toExt Extension to replace with (e.g., '.ts')
 * @param options Additional options for processing
 */
async function replaceImportsExt(
  outdirBin: string,
  fromExt: string,
  toExt: string,
  options: {
    isJsr?: boolean;
    replaceSrcWithBin?: boolean;
    concurrency?: number;
    skipTemplates?: boolean;
  } = {},
): Promise<void> {
  const {
    isJsr = false,
    replaceSrcWithBin = false,
    concurrency = 10,
    skipTemplates = true,
  } = options;

  relinka(
    "verbose",
    `Starting conversion of ${fromExt} imports to ${toExt} in ${outdirBin} (isJsr=${isJsr})`,
  );

  const entries = await fs.readdir(outdirBin);
  await pMap(
    entries,
    async (entry) => {
      const filePath = path.join(outdirBin, entry);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        await replaceImportsExt(filePath, fromExt, toExt, options);
      } else if (
        stat.isFile() &&
        /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(entry)
      ) {
        if (skipTemplates && filePath.includes("template/")) return;

        const content = await readFileSafe(
          filePath,
          isJsr,
          "replaceImportsExt",
        );
        let finalContent = content;
        let modified = false;

        // Replace src with bin if requested
        if (replaceSrcWithBin) {
          const prevContent = finalContent;
          finalContent = finalContent.replace(
            /(from\s*['"])(\.|\.\/|\.\\)?src(\/|\\)/g,
            "$1$2bin$3",
          );
          modified = modified || prevContent !== finalContent;
        }

        // Replace extensions
        if (fromExt && toExt) {
          const prevContent = finalContent;
          const fromExtRegex = new RegExp(
            `(from\\s*['"].*?)\\${fromExt}(['"]\\s*;?)`,
            "g",
          );
          finalContent = finalContent.replace(fromExtRegex, `$1\\${toExt}$2`);
          modified = modified || prevContent !== finalContent;
        }

        // Determine the distribution type based on the file path
        const distName = determineDistName(filePath, isJsr);

        // Throw an error if unsupported subdirectory structures are detected
        if (isJsr) {
          const relativePath = path.relative(outdirBin, filePath);
          if (
            (filePath.includes("/bin/") || filePath.includes("\\bin\\")) &&
            relativePath.includes(path.sep) &&
            (finalContent.includes("../libs/") ||
              finalContent.includes("../libs\\")) &&
            (filePath.includes("/libs/") || filePath.includes("\\libs\\"))
          ) {
            throw new Error(
              `Subdirectories in libs are not currently supported. Found subdirectory in: ${filePath}`,
            );
          }
        }

        if (modified) {
          relinka(
            "verbose",
            `[${distName}] Converted ${fromExt} imports to ${toExt} (file: ${filePath})`,
          );
          await writeFileSafe(filePath, finalContent, "imports ext conversion");
        } else {
          relinka(
            "verbose",
            `[${distName}] No changes needed for imports (file: ${filePath})`,
          );
        }
      }
    },
    { concurrency },
  );

  relinka(
    "verbose",
    `Completed conversion of ${fromExt} to ${toExt} imports in ${outdirBin}`,
  );
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
 * @param dir Directory to process files in
 * @param filePatterns Glob patterns to match files
 * @param processFileFn Function to process each file
 * @param isDev Development mode flag
 * @param options Additional options
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
 * Convert src paths to bin paths in content.
 * @param content File content to process
 * @param file File path
 * @param outdirRoot Output root directory
 * @param isJsr JSR mode flag
 * @returns Modified content and modification status
 */
function convertSrcToBinPathsInContent(
  content: string,
  file: string,
  outdirRoot: string,
  isJsr: boolean,
): { modified: boolean; newContent: string } {
  // First, handle any nested dist-libs paths by removing duplicated segments
  const cleanedContent = content.replace(
    /(["'])(.*?dist-libs\/.*?\/(?:npm|jsr)\/bin\/.*?dist-libs\/.*?)(['"])/g,
    (match, quote1, path, quote2) => {
      // Extract the first dist-libs path
      const firstDistLibsPath = path.match(
        /(dist-libs\/[^/]+\/(?:npm|jsr)\/bin)/,
      )?.[0];
      if (firstDistLibsPath) {
        // Remove any subsequent dist-libs paths
        const cleanedPath = path.replace(
          new RegExp(`${firstDistLibsPath}.*?dist-libs`),
          "dist-libs",
        );
        return `${quote1}${cleanedPath}${quote2}`;
      }
      return match;
    },
  );

  // Then apply the regular src to bin conversions
  let newContent = cleanedContent
    .replace(/(from\s*['"])(\.|\.\/|\.\\)?src(\/|\\)/g, "$1$2bin$3")
    .replace(/(import\s*\(\s*['"])(\.|\.\/|\.\\)?src(\/|\\)/g, "$1$2bin$3")
    .replace(/(require\s*\(\s*['"])(\.|\.\/|\.\\)?src(\/|\\)/g, "$1$2bin$3")
    .replace(/(['"])(\/src\/|\\src\\)/g, "$1/bin/");

  if (isJsr && !file.includes(path.join(outdirRoot, "bin"))) {
    newContent = newContent.replace(
      /(from\s*['"])([^'"]+?)\.js(?=['"])/g,
      "$1$2.ts$3",
    );
  }

  return {
    modified: content !== newContent,
    newContent,
  };
}

/**
 * Converts src paths to bin paths in built files.
 */
async function convertSrcToBinPaths(
  outdirRoot: string,
  isJsr = false,
): Promise<void> {
  relinka("info", "Converting src paths to bin paths in built files...");
  if (!(await fs.pathExists(outdirRoot))) {
    relinka(
      "error",
      `[convertSrcToBinPaths] Directory does not exist: ${outdirRoot}`,
    );
    return;
  }

  const dirsToProcess = [outdirRoot, path.join(outdirRoot, "bin")];
  const filePatterns = ["**/*.{js,ts,jsx,tsx,mjs,cjs}"];
  let filesModified = 0;

  for (const dir of dirsToProcess) {
    const modifiedCount = await processFilesInDirectory(
      isJsr,
      dir,
      filePatterns,
      async (file, content) =>
        convertSrcToBinPathsInContent(content, file, outdirRoot, isJsr),
    );

    filesModified += modifiedCount;
  }

  relinka("info", `Converted paths in ${filesModified} files.`);
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
 * @param sourcemap - Sourcemap configuration.
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
 * Bundles using Bun's bundler.
 */
async function bundleUsingBun(
  cfg: BuildPublishConfig,
  entryFile: string,
  outdirBin: string,
  packageName = "",
): Promise<void> {
  relinka(
    "verbose",
    `Bundling using Bun for ${packageName} (entry: ${entryFile}, outdir: ${outdirBin})`,
  );
  if (!(await fs.pathExists(entryFile))) {
    relinka("error", `Could not find entry file at: ${entryFile}`);
    throw new Error(`Entry file not found: ${entryFile}`);
  }
  try {
    const buildResult = await bunBuild({
      entrypoints: [entryFile],
      outdir: outdirBin,
      target: cfg.target,
      format: cfg.format,
      splitting: cfg.splitting,
      minify: cfg.shouldMinify,
      sourcemap: getBunSourcemapOption(cfg.sourcemap),
      throw: true,
      naming: {
        entry: "[dir]/[name]-[hash].[ext]",
        chunk: "[name]-[hash].[ext]",
        asset: "[name]-[hash].[ext]",
      },
      publicPath: cfg.publicPath || "/",
      define: {
        "process.env.NODE_ENV": JSON.stringify(
          process.env.NODE_ENV || "production",
        ),
      },
      banner: "/* Bundled by @reliverse/relidler */",
      footer: "/* End of bundle */",
      drop: ["debugger"],
    });
    relinka(
      "info",
      `${packageName} bun build completed with ${buildResult.outputs.length} output file(s).`,
    );
    if (buildResult.logs && buildResult.logs.length > 0) {
      buildResult.logs.forEach((log, index) => {
        relinka("verbose", `Log ${index + 1}: ${JSON.stringify(log)}`);
      });
    }
  } catch (error) {
    relinka(
      "error",
      `${packageName} build failed while using bun bundler:`,
      error,
    );
    throw error;
  }
  relinka("verbose", `Exiting bundleUsingBun for ${packageName}`);
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
): Promise<void> {
  try {
    const config = await loadConfig();
    if (isDev) {
      relinka("info", "Skipping JSR publish in development mode");
      return;
    }
    if (!config.pausePublish) {
      relinka("info", "Publishing to JSR...");
      const jsrDistDirResolved = resolve(PROJECT_ROOT, config.jsrDistDir);
      await withWorkingDirectory(jsrDistDirResolved, async () => {
        const command = [
          "bunx jsr publish",
          dryRun ? "--dry-run" : "",
          config.jsrAllowDirty ? "--allow-dirty" : "",
          config.jsrSlowTypes ? "--allow-slow-types" : "",
        ]
          .filter(Boolean)
          .join(" ");
        relinka("verbose", `Running publish command: ${command}`);
        await runCommand(command);
        relinka(
          "success",
          `Successfully ${dryRun ? "validated" : "published"} to JSR registry`,
        );
      });
    }
  } catch (error) {
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
): Promise<void> {
  try {
    const config = await loadConfig();
    if (isDev) {
      relinka("info", "Skipping NPM publish in development mode");
      return;
    }
    if (!config.pausePublish) {
      relinka("info", "Publishing to NPM...");
      const npmDistDirResolved = resolve(PROJECT_ROOT, config.npmDistDir);
      await withWorkingDirectory(npmDistDirResolved, async () => {
        const command = ["bun publish", dryRun ? "--dry-run" : ""]
          .filter(Boolean)
          .join(" ");
        relinka("verbose", `Running publish command: ${command}`);
        await runCommand(command);
        relinka(
          "success",
          `Successfully ${dryRun ? "validated" : "published"} to NPM registry`,
        );
      });
    }
  } catch (error) {
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
): Promise<void> {
  relinka("verbose", `Writing package.json for JSR lib: ${libName}`);
  const config = await loadConfig();
  const isCLI = config.isCLI;

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
    ),
    devDependencies: await filterDeps(
      originalPkg.devDependencies,
      true,
      outdirBin,
      true,
      await loadConfig(),
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
): Promise<void> {
  relinka("verbose", `Writing package.json for NPM lib: ${libName}`);
  const config = await loadConfig();
  const outExt = config.npmOutFilesExt || "js";
  const isCLI = config.isCLI;

  // If bin is already set in commonPkg (from createLibPackageJSON), use that
  // Otherwise, set it based on config.isCLI
  const binEntry =
    commonPkg.bin ||
    (isCLI
      ? { [libName.split("/").pop() || ""]: `bin/main.${outExt}` }
      : undefined);

  if (binEntry) {
    relinka(
      "verbose",
      `Using bin entry for NPM lib: ${JSON.stringify(binEntry)}`,
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
    dependencies: await getLibDependencies(
      libName,
      originalPkg.dependencies,
      outdirBin,
      false,
    ),
    devDependencies: await filterDeps(
      originalPkg.devDependencies,
      true,
      outdirBin,
      false,
      await loadConfig(),
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
): Promise<void> {
  const config = await loadConfig();
  const isCLI = config.isCLI;

  relinka(
    "verbose",
    `Generating package.json for lib ${libName} (isJsr=${isJsr}, isCLI=${isCLI})...`,
  );
  const originalPkg = await readPackageJSON();
  let { description } = originalPkg;
  const { version, license, keywords, author } = originalPkg;

  // Set description based on config
  if (config.libs?.[libName]?.description) {
    description = config.libs[libName].description;
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
    const binPath = `bin/main.js`;
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
    );
  } else {
    relinka("verbose", `Creating NPM package.json for lib ${libName}...`);
    await writeNpmLibPackageJSON(
      libName,
      outdirBin,
      outdirRoot,
      originalPkg,
      commonPkg,
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
  await unstable_convertImportPathsToPkgNames(outdirBin, isJsr);
}

/**
 * Process a file to convert library imports to package names.
 * @param file File path
 * @param content File content
 * @param config Build config
 * @param isJsr Boolean indicating if this is a JSR build
 * @param currentLibName Optional name of the current library being processed
 * @returns Modified content and modification status
 */
async function processLibraryImportsInFile(
  file: string,
  content: string,
  config: BuildPublishConfig,
  isJsr: boolean,
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

        for (const [libName, libConfig] of Object.entries(config.libs || {})) {
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

  // Get the config to access library definitions
  const config = await loadConfig();

  if (!config.libs || Object.keys(config.libs).length === 0) {
    relinka(
      "info",
      `[${distName}] No libs defined in configuration, skipping library import conversion.`,
    );
    return;
  }

  // Determine the current library name from the outdirBin path
  let currentLibName: string | undefined;
  for (const [libName, libConfig] of Object.entries(config.libs)) {
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
      processLibraryImportsInFile(file, content, config, isJsr, currentLibName),
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
    const config = await loadConfig();
    const currentLibName = detectCurrentLibrary(outdirBin, config, distName);

    // Process each import and generate replacements
    const replacements = await processImports(
      imports,
      filePath,
      entryDir,
      outdirBin,
      addonsDir,
      processedFiles,
      copiedExternalFiles,
      config,
      currentLibName,
      isDev,
      isJsr,
      distName,
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
  config: BuildPublishConfig,
  currentLibName: string | undefined,
  isDev: boolean,
  isJsr: boolean,
  distName: string,
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
        config,
        currentLibName,
        isJsr,
        matchStart,
        importPathIndex,
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
  config: BuildPublishConfig,
  currentLibName: string | undefined,
  isJsr: boolean,
  matchStart: number,
  importPathIndex: number,
): Replacement | null {
  if (
    !config?.libs ||
    (!importPath.startsWith("~/") && !importPath.startsWith("."))
  ) {
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

  for (const [libName, libConfig] of Object.entries(config.libs)) {
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
  config?: BuildPublishConfig,
): Promise<{ updatedEntryFile: string }> {
  relinka(
    "verbose",
    `Renaming entry file. Original: ${entryFile} (isJsr=${isJsr})`,
  );
  if (!isJsr) {
    const outExt = config?.npmOutFilesExt || "js";
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
    const outExt = config?.npmOutFilesExt || "js";
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
 * Analyzes TypeScript imports in a file and returns a list of imported files.
 */
async function analyzeImports(
  filePath: string,
  baseDir: string,
  processedFiles = new Set<string>(),
  isDev: boolean,
  isJsr: boolean,
): Promise<string[]> {
  const distName = determineDistName(baseDir, isJsr);
  relinka("verbose", `[${distName}] Analyzing imports in file: ${filePath}`);

  // Skip already processed files to avoid circular dependencies
  if (processedFiles.has(filePath)) {
    return [];
  }
  processedFiles.add(filePath);

  try {
    const content = await readFileSafe(filePath, isJsr, "analyzeImports");
    const importRegex =
      /(?:import|export)(?:(?:[\s\S]*?from\s+)|(?:(?:[\s\S]|(?:\n))+?=\s+require\(\s*))["']([^"']+)["']/g;

    const importPaths: string[] = [];
    const config = await loadConfig();
    const currentLibName = detectCurrentLibrary(baseDir, config, distName);

    // Process each import statement in the file
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      relinka("info", `[${distName}] Found import path: ${importPath}`);

      // Skip if this is a cross-library import that will be handled separately
      if (
        isExternalLibraryImport(
          importPath,
          filePath,
          config,
          currentLibName,
          isJsr,
          distName,
        )
      ) {
        continue;
      }

      // Skip non-relative, non-absolute imports (npm packages)
      if (!isLocalImport(importPath)) {
        relinka(
          "info",
          `[${distName}] Skipping npm package import: ${importPath}`,
        );
        continue;
      }

      // Normalize and resolve the import path
      const normalizedPath = normalizeImportPath(importPath, filePath);

      // Use resolveImportToFile function to find the actual file
      const resolvedPath = await resolveImportToFile(normalizedPath, filePath);
      if (!resolvedPath) {
        relinka(
          "warn",
          `[${distName}] Could not resolve import: ${importPath}`,
        );
        continue;
      }

      // Inject the resolved path to the list and process its imports recursively
      importPaths.push(resolvedPath);
      const nestedImports = await analyzeImports(
        resolvedPath,
        baseDir,
        processedFiles,
        isDev,
        isJsr,
      );
      importPaths.push(...nestedImports);
    }

    relinka(
      "info",
      `[${distName}] Completed import analysis for ${filePath}, found ${importPaths.length} imports`,
    );
    return importPaths;
  } catch (error) {
    relinka(
      "error",
      `[${distName}] Error analyzing imports in ${filePath}:`,
      error,
    );
    return [];
  }
}

/**
 * Detects the current library name based on the baseDir path.
 */
function detectCurrentLibrary(
  baseDir: string,
  config: BuildPublishConfig,
  distName: string,
): string | undefined {
  if (!config.libs) return undefined;

  for (const [libName, libConfig] of Object.entries(config.libs)) {
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
 * Checks if an import is from another library defined in the config.
 */
function isExternalLibraryImport(
  importPath: string,
  filePath: string,
  config: BuildPublishConfig,
  currentLibName: string | undefined,
  isJsr: boolean,
  _distName: string,
): boolean {
  if (
    !config?.libs ||
    (!importPath.startsWith("~/") && !importPath.startsWith("."))
  ) {
    return false;
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

  for (const [libName, libConfig] of Object.entries(config.libs)) {
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
      return true;
    }
  }

  return false;
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
 * Normalizes an import path by removing extensions and simplifying SDK imports.
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
 * Copies a file with all its imports to the output directory.
 */
async function unstable_copyFileWithImports(
  sourcePath: string,
  outputDir: string,
  baseDir: string,
  isDev: boolean,
  isJsr: boolean,
): Promise<void> {
  if (DEBUG_DISABLE.unstable_copyFileWithImports) {
    disableFunction("unstable_copyFileWithImports");
    return;
  }

  relinka(
    "info",
    `Starting to copy file with imports: ${sourcePath} -> ${outputDir}`,
  );
  relinka("info", `Base directory for relative paths: ${baseDir}`);
  const imports = await analyzeImports(
    sourcePath,
    baseDir,
    new Set<string>(),
    isDev,
    isJsr,
  );
  relinka("info", `Found ${imports.length} imports to copy`);
  const allFiles = [sourcePath, ...imports];
  relinka("info", `Total files to copy (including source): ${allFiles.length}`);
  await pMap(
    allFiles,
    async (file) => {
      const relativePath = path.relative(baseDir, file);
      const targetPath = path.join(outputDir, relativePath);
      relinka("info", `Copying file: ${file} -> ${targetPath}`);
      await ensuredir(path.dirname(targetPath));
      await fs.copyFile(file, targetPath);
      relinka("verbose", `Copied ${file} to ${targetPath}`);
    },
    { concurrency: CONCURRENCY_DEFAULT },
  );
  relinka("success", `Completed copying ${allFiles.length} files`);
}

/**
 * Computes the Rollup sourcemap option based on the given configuration.
 * @param sourcemap - Sourcemap configuration.
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
 * Bundles source files by copying them with all imports.
 * JSR registry requires *.ts files instead of *.js ones.
 */
async function bundleUsingJsr(
  src: string,
  dest: string,
  baseDir: string,
  isDev: boolean,
  isJsr: boolean,
): Promise<void> {
  relinka("info", `Starting bundleUsingJsr: ${src} -> ${dest}`);
  relinka("info", `Base directory: ${baseDir}`);
  await ensuredir(path.dirname(dest));
  const stats = await fs.stat(src);

  // Determine if this is a library build
  const distName = determineDistName(src, isJsr);
  const isLibBuild = distName.includes("dist-libs");

  if (stats.isFile()) {
    relinka("info", "Source is a file, using unstable_copyFileWithImports");
    await unstable_copyFileWithImports(
      src,
      path.dirname(dest),
      baseDir,
      isDev,
      isJsr,
    );
    relinka("verbose", `Copied file with imports from ${src} to ${dest}`);
  } else {
    relinka("info", "Source is a directory, using fs.copy");

    // For library builds, we need to ensure we're only copying the specific library directory
    if (isLibBuild) {
      // Extract the library name from the distName
      const libNameMatch = /dist-libs\/([^/]+)\//.exec(distName);
      if (libNameMatch?.[1]) {
        const libName = libNameMatch[1];

        // Get the config to find the actual directory path
        const config = await getConfigWithCliFlags(isDev);
        const libConfig = config.libs?.[`@reliverse/${libName}`];

        if (libConfig?.main) {
          // Extract the directory from the main file path
          const mainFilePath = libConfig.main;
          const libDirMatch = /src\/libs\/([^/]+)\//.exec(mainFilePath);

          if (libDirMatch?.[1]) {
            const actualLibDir = libDirMatch[1];
            // Construct the full path to the library directory
            const libPath = path.join(baseDir, "libs", actualLibDir);

            if (await fs.pathExists(libPath)) {
              relinka(
                "info",
                `Library build detected. Copying ${libPath} to ${dest}`,
              );
              await fs.copy(libPath, dest);
            } else {
              relinka(
                "warn",
                `Library directory ${libPath} not found, falling back to copying ${src}`,
              );
              await fs.copy(src, dest);
            }
          } else {
            relinka(
              "warn",
              `Could not determine library directory from ${mainFilePath}, falling back to copying ${src}`,
            );
            await fs.copy(src, dest);
          }
        } else {
          relinka(
            "warn",
            `No main file defined for library ${libName}, falling back to copying ${src}`,
          );
          await fs.copy(src, dest);
        }
      } else {
        relinka(
          "warn",
          `Could not determine library name from ${distName}, falling back to copying ${src}`,
        );
        await fs.copy(src, dest);
      }
    } else {
      // For non-library builds, copy as before
      await fs.copy(src, dest);
    }

    relinka("verbose", `Copied directory from ${src} to ${dest}`);
  }
  relinka("success", "Completed bundling with imports");
}

/**
 * Builds using a unified builder.
 */
async function bundleUsingUnified(
  config: BuildPublishConfig,
  entryFile: string,
  outdirBin: string,
  argsBuilderConfig: {
    config?: string;
    dir?: string;
    minify?: boolean;
    parallel?: boolean;
    sourcemap?: boolean;
    stub?: boolean;
    watch?: boolean;
    ext?: string;
  },
  builder: "rollup" | "untyped" | "mkdist" | "copy",
  isJsr = false,
): Promise<void> {
  relinka("verbose", `Starting bundleUsingUnified with builder: ${builder}`);
  const rootDir = resolve(process.cwd(), argsBuilderConfig.dir || ".");

  // Determine if this is a library build
  const distName = determineDistName(outdirBin, isJsr);
  const isLibBuild = distName.includes("dist-libs");
  let libSrcDir = "";

  if (isLibBuild) {
    // Extract the library name from the distName
    const libNameMatch = /dist-libs\/([^/]+)\//.exec(distName);
    if (libNameMatch?.[1]) {
      const libName = libNameMatch[1];
      // Construct the full path to the library directory
      const entrySrcDirResolved = resolve(process.cwd(), config.entrySrcDir);
      libSrcDir = path.join(entrySrcDirResolved, "libs", libName);
      relinka(
        "info",
        `Library build detected for ${libName}. Using source directory: ${libSrcDir}`,
      );
    }
  }

  // For mkdist, we need to use the directory containing the entry file, not the file itself
  const input =
    builder === "mkdist"
      ? isLibBuild && libSrcDir
        ? libSrcDir
        : path.dirname(entryFile) // Use the library directory for mkdist if it's a library build
      : entryFile; // Use the file for other builders

  if (
    config.npmOutFilesExt !== "cjs" &&
    config.npmOutFilesExt !== "js" &&
    config.npmOutFilesExt !== "mjs" &&
    config.npmOutFilesExt !== "ts" &&
    config.npmOutFilesExt !== "mts" &&
    config.npmOutFilesExt !== "cts"
  ) {
    config.npmOutFilesExt = "js";
  }

  // Ensure we're only using the src directory for mkdist, or the library directory for library builds
  const srcDir = config.entrySrcDir || "src";
  const resolvedSrcDir =
    isLibBuild && libSrcDir ? libSrcDir : resolve(process.cwd(), srcDir);

  const unifiedBuildConfig = {
    config: argsBuilderConfig.config
      ? resolve(argsBuilderConfig.config)
      : undefined,
    declaration: false,
    clean: false,
    entries: [
      {
        input: builder === "mkdist" ? resolvedSrcDir : input,
        builder,
        outDir: outdirBin,
        ext: config.npmOutFilesExt,
      },
    ],
    stub: argsBuilderConfig.stub,
    watch: argsBuilderConfig.watch ?? false,
    showOutLog: true, // Hide file listing when not in verbose mode
    rollup: {
      emitCJS: false,
      inlineDependencies: true,
      esbuild: {
        target: config.esbuild,
        minify: argsBuilderConfig.minify ?? config.shouldMinify,
      },
      output: {
        sourcemap:
          argsBuilderConfig.sourcemap ?? getRollupSourcemap(config.sourcemap),
      },
    },
    sourcemap: argsBuilderConfig.sourcemap ?? false,
  } satisfies UnifiedBuildConfig & { config?: string };

  await unifiedBuild(
    rootDir,
    argsBuilderConfig.stub,
    unifiedBuildConfig,
    outdirBin,
  ).catch((error) => {
    relinka("error", `Error building ${rootDir}: ${error}`);
    throw error;
  });

  relinka("verbose", "Exiting bundleUsingUnified");
}

// ============================
// Main Build/Publish Functions
// ============================

/**
 * Common build steps shared between JSR and NPM distributions
 */
async function performCommonBuildSteps({
  outdirBinResolved,
  outdirRoot,
  entryFile,
  entrySrcDir,
  isJsr,
  config,
  deleteFiles = true,
}: {
  outdirBinResolved: string;
  outdirRoot: string;
  entryFile: string;
  entrySrcDir: string;
  isJsr: boolean;
  config: BuildPublishConfig;
  deleteFiles?: boolean;
}): Promise<void> {
  // Convert paths and imports
  await convertSrcToBinPaths(outdirRoot, isJsr);
  await convertImportPaths({
    baseDir: outdirBinResolved,
    fromType: "alias",
    toType: "relative",
    aliasPrefix: "~/",
  });

  // Handle entry file
  await renameEntryFile(
    isJsr,
    outdirBinResolved,
    entrySrcDir,
    entryFile,
    config,
  );

  // Clean up files if needed
  if (deleteFiles) {
    await deleteSpecificFiles(outdirBinResolved);
  }

  // Generate package.json
  await createPackageJSON(outdirRoot, isJsr);

  // Copy files from the root directory
  await copyFileFromRoot(outdirRoot, ["README.md", "LICENSE"]);
  if (isJsr && config.isCLI) {
    await copyFileFromRoot(outdirRoot, [
      ".gitignore",
      "reliverse.jsonc",
      "drizzle.config.ts",
      "schema.json",
    ]);
  }
}

/**
 * Builds a regular JSR distribution.
 */
export async function regular_buildJsrDist(
  isDev: boolean,
  argsBuilderConfig: {
    config?: string;
    dir?: string;
    minify?: boolean;
    parallel?: boolean;
    sourcemap?: boolean;
    stub?: boolean;
    watch?: boolean;
    ext?: string;
  },
  isJsr: boolean,
): Promise<void> {
  relinka("info", "Building JSR distribution...");
  const config = await loadConfig();
  const { entrySrcDir, jsrDistDir, jsrBuilder, entryFile } = config;

  // Construct the full path to the entry file
  const entrySrcDirResolved = resolve(process.cwd(), entrySrcDir);
  const entryFilePath = path.join(entrySrcDirResolved, entryFile);

  const jsrDistDirResolved = resolve(process.cwd(), jsrDistDir);
  const outdirBinResolved = path.resolve(jsrDistDirResolved, "bin");
  await ensuredir(jsrDistDirResolved);
  await ensuredir(outdirBinResolved);
  relinka("info", `Using JSR builder: ${jsrBuilder}`);

  // Build using the appropriate builder
  if (jsrBuilder === "jsr") {
    await bundleUsingJsr(
      entrySrcDirResolved,
      outdirBinResolved,
      entrySrcDirResolved,
      isDev,
      isJsr,
    );
  } else if (jsrBuilder === "bun") {
    await bundleUsingBun(config, entryFilePath, outdirBinResolved, "");
  } else {
    await bundleUsingUnified(
      config,
      entryFilePath,
      outdirBinResolved,
      argsBuilderConfig,
      "mkdist",
      isJsr,
    );
  }

  // Perform common build steps
  await performCommonBuildSteps({
    outdirBinResolved,
    outdirRoot: jsrDistDirResolved,
    entryFile,
    entrySrcDir,
    isJsr,
    config,
  });

  await renameTsxFiles(outdirBinResolved);
  await createJsrJSONC(jsrDistDirResolved, false);

  if (config.isCLI) {
    await createTSConfig(jsrDistDirResolved, true);
  }

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
  argsBuilderConfig: {
    config?: string;
    dir?: string;
    minify?: boolean;
    parallel?: boolean;
    sourcemap?: boolean;
    stub?: boolean;
    watch?: boolean;
    ext?: string;
  },
): Promise<void> {
  relinka("info", "Building NPM distribution...");
  const config = await loadConfig();
  const { entrySrcDir, npmDistDir, npmBuilder, entryFile } = config;

  // Construct the full path to the entry file
  const entrySrcDirResolved = resolve(process.cwd(), entrySrcDir);
  const entryFilePath = path.join(entrySrcDirResolved, entryFile);

  const npmDistDirResolved = resolve(process.cwd(), npmDistDir);
  const outdirBinResolved = path.resolve(npmDistDirResolved, "bin");
  await ensuredir(npmDistDirResolved);
  await ensuredir(outdirBinResolved);
  relinka("info", `Using NPM builder: ${npmBuilder}`);

  // Validate and build using the appropriate builder
  if (npmBuilder === "jsr") {
    await bundleUsingJsr(
      entrySrcDirResolved,
      outdirBinResolved,
      entrySrcDirResolved,
      isDev,
      false,
    );
  } else if (npmBuilder === "bun") {
    await bundleUsingBun(config, entryFilePath, outdirBinResolved, "");
  } else {
    await bundleUsingUnified(
      config,
      entryFilePath,
      outdirBinResolved,
      argsBuilderConfig,
      npmBuilder,
      false,
    );
  }

  // Perform common build steps
  await performCommonBuildSteps({
    outdirBinResolved,
    outdirRoot: npmDistDirResolved,
    entryFile,
    entrySrcDir,
    isJsr: false,
    config,
  });

  const dirSize = await getDirectorySize(npmDistDirResolved, isDev);
  const filesCount = await outdirBinFilesCount(outdirBinResolved);
  relinka(
    "success",
    `NPM distribution built successfully (${filesCount} files, ${prettyBytes(dirSize)})`,
  );
}

/**
 * Common library build steps shared between JSR and NPM distributions
 */
async function performCommonLibBuildSteps({
  libName,
  entryDir,
  outdirRoot,
  outdirBinResolved,
  isDev,
  isJsr,
  deleteFiles = true,
}: {
  libName: string;
  entryDir: string;
  outdirRoot: string;
  outdirBinResolved: string;
  isDev: boolean;
  isJsr: boolean;
  deleteFiles?: boolean;
}): Promise<void> {
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
  await createLibPackageJSON(libName, outdirRoot, isJsr);

  // Clean up files
  if (deleteFiles) {
    await deleteSpecificFiles(outdirBinResolved);
  }

  // Copy documentation files
  await copyFileFromRoot(outdirRoot, ["README.md", "LICENSE"]);
}

/**
 * Builds a lib distribution for JSR.
 */
async function library_buildJsrDist(
  libName: string,
  entryDir: string,
  outdirRoot: string,
  entryFile: string,
  isDev: boolean,
  argsBuilderConfig: {
    config?: string;
    dir?: string;
    minify?: boolean;
    parallel?: boolean;
    sourcemap?: boolean;
    stub?: boolean;
    watch?: boolean;
    ext?: string;
  },
  isJsr: boolean,
): Promise<void> {
  const distName = determineDistName(outdirRoot, isJsr);
  relinka(
    "verbose",
    `[${distName}] Starting library_buildJsrDist for lib: ${libName}`,
  );
  const userConfig = await loadConfig();
  const config = { ...userConfig };
  const outdirBinResolved = path.resolve(outdirRoot, "bin");
  relinka("info", `[${distName}] Building JSR dist for lib: ${libName}...`);
  const entrySrcDirResolved = resolve(process.cwd(), config.entrySrcDir);

  // Get the library-specific source directory
  const libNameSimple = libName.split("/").pop() || libName;

  // Extract the actual directory from the main file path in the config
  let libSrcDir = path.join(entrySrcDirResolved, "libs", libNameSimple);

  // Check if we have a main file path in the config
  const libConfig = config.libs?.[libName];
  if (libConfig?.main) {
    const mainFilePath = libConfig.main;
    const libDirMatch = /src\/libs\/([^/]+)\//.exec(mainFilePath);

    if (libDirMatch?.[1]) {
      // Use the directory from the main file path
      const actualLibDir = libDirMatch[1];
      libSrcDir = path.join(entrySrcDirResolved, "libs", actualLibDir);
    }
  }

  // Build using the appropriate builder
  if (config.jsrBuilder === "jsr") {
    await bundleUsingJsr(
      libSrcDir,
      outdirBinResolved,
      entrySrcDirResolved,
      isDev,
      isJsr,
    );
  } else if (config.jsrBuilder === "bun") {
    await bundleUsingBun(config, entryFile, outdirBinResolved, libName);
  } else {
    // Construct the full path to the entry file
    // For library builds, we need to use the library-specific entry file path
    const libEntryFilePath = path.join(libSrcDir, path.basename(entryFile));
    await bundleUsingUnified(
      config,
      libEntryFilePath,
      outdirBinResolved,
      argsBuilderConfig,
      "mkdist",
      isJsr,
    );
  }

  // Perform common library build steps
  await performCommonLibBuildSteps({
    libName,
    entryDir,
    outdirRoot,
    outdirBinResolved,
    isDev,
    isJsr,
  });

  // JSR-specific steps
  if (config.isCLI) {
    await createTSConfig(outdirRoot, true);
  }
  await createJsrJSONC(outdirRoot, true, libName);
  await renameTsxFiles(outdirBinResolved);

  const { updatedEntryFile } = await renameEntryFile(
    true,
    outdirBinResolved,
    entryDir,
    entryFile,
    config,
  );

  await replaceImportsExt(outdirBinResolved, ".js", ".ts", {
    isJsr: true,
    replaceSrcWithBin: true,
  });

  await convertImportPaths({
    baseDir: outdirBinResolved,
    fromType: "alias",
    toType: "relative",
    aliasPrefix: "~/",
  });

  await convertSrcToBinPaths(outdirRoot, true);

  const size = await getDirectorySize(outdirRoot, isDev);

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
  entryDir: string,
  outdirRoot: string,
  entryFile: string,
  isDev: boolean,
  argsBuilderConfig: {
    config?: string;
    dir?: string;
    minify?: boolean;
    parallel?: boolean;
    sourcemap?: boolean;
    stub?: boolean;
    watch?: boolean;
    ext?: string;
  },
  isJsr: boolean,
): Promise<void> {
  const distName = determineDistName(outdirRoot, isJsr);
  relinka(
    "verbose",
    `[${distName}] Starting library_buildNpmDist for lib: ${libName}`,
  );
  const userConfig = await loadConfig();
  const config = { ...userConfig };
  const outdirBinResolved = path.resolve(outdirRoot, "bin");
  relinka("info", `[${distName}] Building NPM dist for lib: ${libName}...`);
  const entrySrcDirResolved = resolve(process.cwd(), config.entrySrcDir);

  // Get the library-specific source directory
  const libNameSimple = libName.split("/").pop() || libName;

  // Extract the actual directory from the main file path in the config
  let libSrcDir = path.join(entrySrcDirResolved, "libs", libNameSimple);

  // Check if we have a main file path in the config
  const libConfig = config.libs?.[libName];
  if (libConfig?.main) {
    const mainFilePath = libConfig.main;
    const libDirMatch = /src\/libs\/([^/]+)\//.exec(mainFilePath);

    if (libDirMatch?.[1]) {
      // Use the directory from the main file path
      const actualLibDir = libDirMatch[1];
      libSrcDir = path.join(entrySrcDirResolved, "libs", actualLibDir);
    }
  }

  // Build using the appropriate builder
  if (config.npmBuilder === "jsr") {
    await bundleUsingJsr(
      libSrcDir,
      outdirBinResolved,
      entrySrcDirResolved,
      isDev,
      false,
    );
  } else if (config.npmBuilder === "bun") {
    await bundleUsingBun(config, entryFile, outdirBinResolved, libName);
  } else {
    // Construct the full path to the entry file
    // For library builds, we need to use the library-specific entry file path
    const libEntryFilePath = path.join(libSrcDir, path.basename(entryFile));
    await bundleUsingUnified(
      config,
      libEntryFilePath,
      outdirBinResolved,
      argsBuilderConfig,
      "mkdist",
      isJsr,
    );
  }

  // Perform common library build steps
  await performCommonLibBuildSteps({
    libName,
    entryDir,
    outdirRoot,
    outdirBinResolved,
    isDev,
    isJsr: false,
  });

  // NPM-specific steps
  const { updatedEntryFile } = await renameEntryFile(
    false,
    outdirBinResolved,
    entryDir,
    entryFile,
    config,
  );

  await replaceImportsExt(outdirBinResolved, ".js", ".js", {
    isJsr: false,
    replaceSrcWithBin: false,
  });

  await convertImportPaths({
    baseDir: outdirBinResolved,
    fromType: "alias",
    toType: "relative",
    aliasPrefix: "~/",
  });

  await convertSrcToBinPaths(outdirRoot, false);

  const size = await getDirectorySize(outdirRoot, isDev);

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
): Promise<void> {
  relinka("verbose", `Starting publishLibToJsr for lib: ${libName}`);
  if (isDev) {
    relinka("info", `Skipping lib ${libName} JSR publish in development mode`);
    return;
  }
  const config = await loadConfig();

  await withWorkingDirectory(libOutDir, async () => {
    relinka("info", `Publishing lib ${libName} to JSR from ${libOutDir}`);
    const command = [
      "bunx jsr publish",
      dryRun ? "--dry-run" : "",
      config.jsrAllowDirty ? "--allow-dirty" : "",
      config.jsrSlowTypes ? "--allow-slow-types" : "",
    ]
      .filter(Boolean)
      .join(" ");
    await runCommand(command);
    relinka(
      "success",
      `Successfully ${dryRun ? "validated" : "published"} lib ${libName} to JSR`,
    );
  });
  relinka("verbose", `Exiting publishLibToJsr for lib: ${libName}`);
}

/**
 * Publishes a lib to NPM.
 */
async function library_pubToNpm(
  libOutDir: string,
  dryRun: boolean,
  libName: string,
  isDev: boolean,
): Promise<void> {
  relinka("verbose", `Starting library_pubToNpm for lib: ${libName}`);
  if (isDev) {
    relinka("info", `Skipping lib ${libName} NPM publish in development mode`);
    return;
  }
  await withWorkingDirectory(libOutDir, async () => {
    relinka("info", `Publishing lib ${libName} to NPM from ${libOutDir}`);
    const command = ["bun publish", dryRun ? "--dry-run" : ""]
      .filter(Boolean)
      .join(" ");
    await runCommand(command);
    relinka(
      "success",
      `Successfully ${dryRun ? "validated" : "published"} lib ${libName} to NPM`,
    );
  });
  relinka("verbose", `Exiting library_pubToNpm for lib: ${libName}`);
}

/**
 * Processes all libs defined in config.libs.
 */
export async function libraries_buildPublish(
  isDev: boolean,
  argsBuilderConfig: {
    config?: string;
    dir?: string;
    minify?: boolean;
    parallel?: boolean;
    sourcemap?: boolean;
    stub?: boolean;
    watch?: boolean;
    ext?: string;
  },
): Promise<void> {
  relinka("verbose", "Starting libraries_buildPublish");
  const config = await loadConfig();

  if (!config.libs || Object.keys(config.libs).length === 0) {
    relinka("info", "No lib configs found in config, skipping libs build.");
    return;
  }
  relinka(
    "info",
    "Library configurations detected in config, processing libs...",
  );
  const libs = Object.entries(config.libs);
  const dry = !!config.dryRun;
  const tasks = libs.map(([libName, libConfig]) => async () => {
    if (!libConfig.main) {
      relinka(
        "info",
        `Library ${libName} is missing "main" property. Skipping...`,
      );
      return;
    }
    let folderName = libName;
    if (libName.startsWith("@")) {
      const parts = libName.split("/");
      if (parts.length > 1) folderName = parts[1]!;
    }
    const libBaseDir = path.resolve(PROJECT_ROOT, "dist-libs", folderName);
    const npmOutDir = path.join(libBaseDir, "npm");
    const jsrOutDir = path.join(libBaseDir, "jsr");
    const mainPath = path.parse(libConfig.main);
    const mainFile = mainPath.base;
    const mainDir = mainPath.dir || ".";
    if (config.registry === "npm-jsr") {
      relinka("info", `Building lib ${libName} for NPM and JSR...`);
      await library_buildNpmDist(
        libName,
        mainDir,
        npmOutDir,
        mainFile,
        isDev,
        argsBuilderConfig,
        false,
      );
      await library_buildJsrDist(
        libName,
        mainDir,
        jsrOutDir,
        mainFile,
        isDev,
        argsBuilderConfig,
        false,
      );
    } else if (config.registry === "npm") {
      relinka("info", `Building lib ${libName} for NPM...`);
      await library_buildNpmDist(
        libName,
        mainDir,
        npmOutDir,
        mainFile,
        isDev,
        argsBuilderConfig,
        false,
      );
    } else if (config.registry === "jsr") {
      relinka("info", `Building lib ${libName} for JSR...`);
      await library_buildJsrDist(
        libName,
        mainDir,
        jsrOutDir,
        mainFile,
        isDev,
        argsBuilderConfig,
        true,
      );
    }
    if (!config.pausePublish) {
      if (config.registry === "npm-jsr") {
        relinka("info", `Publishing lib ${libName} to both NPM and JSR...`);
        await library_pubToNpm(npmOutDir, dry, libName, isDev);
        await library_pubToJsr(jsrOutDir, dry, libName, isDev);
      } else if (config.registry === "npm") {
        relinka("info", `Publishing lib ${libName} to NPM only...`);
        await library_pubToNpm(npmOutDir, dry, libName, isDev);
      } else if (config.registry === "jsr") {
        relinka("info", `Publishing lib ${libName} to JSR only...`);
        await library_pubToJsr(jsrOutDir, dry, libName, isDev);
      } else {
        relinka(
          "info",
          `Registry "${config.registry}" not recognized for lib ${libName}. Skipping publishing for this lib.`,
        );
      }
    }
  });
  await pAll(tasks, { concurrency: 2 });
  relinka("verbose", "Completed libraries_buildPublish");
}

export async function relidler({
  args,
}: {
  args: {
    // isDev
    dev?: boolean;
    // cliFlags
    bump?: string;
    dryRun?: boolean;
    jsrAllowDirty?: boolean;
    jsrSlowTypes?: boolean;
    registry?: string;
    verbose?: boolean;
    // argsBuilderConfig
    config?: string;
    dir?: string;
    ext?: string;
    minify?: boolean;
    parallel?: boolean;
    sourcemap?: boolean;
    stub?: boolean;
    watch?: boolean;
  };
}) {
  // Start timing the process
  const startTime = performance.now();

  // isDev
  const isDev = args.dev;
  // argsBuilderConfig
  const argsBuilderConfig = {
    config: args.config,
    dir: args.dir,
    minify: args.minify,
    parallel: args.parallel,
    sourcemap: args.sourcemap,
    stub: args.stub,
    watch: args.watch,
  };
  // cliFlags
  const cliFlags = {
    bump: args.bump,
    dryRun: args.dryRun,
    jsrAllowDirty: args.jsrAllowDirty,
    jsrSlowTypes: args.jsrSlowTypes,
    registry: args.registry,
    verbose: args.verbose,
  };

  try {
    // if relidler.log exists, delete it
    await fs.remove(path.join(process.cwd(), "relidler.log"));

    // remove dist folders
    await removeDistFolders();

    // get optional config with optional cli flags
    const config = await getConfigWithCliFlags(isDev, cliFlags);

    // bump project version
    if (!config.disableBump) {
      await bumpHandler(isDev, { bump: args.bump });
    }

    // set flags if not set by config
    const registry = config.registry || "npm-jsr";
    const dry = !!config.dryRun;
    const buildPublishMode = config.buildPublishMode || "main-project-only";

    // Process main project if mode is "main-project-only" or "main-and-libs"
    if (
      buildPublishMode === "main-project-only" ||
      buildPublishMode === "main-and-libs"
    ) {
      if (registry === "npm-jsr") {
        relinka(
          "info",
          "Initializing build process for main project to both NPM and JSR...",
        );
        await regular_buildJsrDist(isDev, argsBuilderConfig, true);
        await regular_buildNpmDist(isDev, argsBuilderConfig);
        await regular_pubToJsr(dry, isDev);
        await regular_pubToNpm(dry, isDev);
      } else if (registry === "npm") {
        relinka(
          "info",
          "Initializing build process for main project to NPM only...",
        );
        await regular_buildNpmDist(isDev, argsBuilderConfig);
        await regular_pubToNpm(dry, isDev);
      } else if (registry === "jsr") {
        relinka(
          "info",
          "Initializing build process for main project to JSR only...",
        );
        await regular_buildJsrDist(isDev, argsBuilderConfig, true);
        await regular_pubToJsr(dry, isDev);
      } else {
        relinka(
          "warn",
          `Registry "${registry}" not recognized. Building main project only...`,
        );
        await regular_buildNpmDist(isDev, argsBuilderConfig);
        await regular_buildJsrDist(isDev, argsBuilderConfig, true);
      }
    } else {
      relinka(
        "info",
        "Skipping main project build/publish as buildPublishMode is set to 'libs-only'",
      );
    }

    // Process libs if mode is "libs-only" or "main-and-libs"
    if (
      buildPublishMode === "libs-only" ||
      buildPublishMode === "main-and-libs"
    ) {
      await libraries_buildPublish(isDev, argsBuilderConfig);
    } else {
      relinka(
        "info",
        "Skipping libs build/publish as buildPublishMode is set to 'main-project-only'",
      );
    }

    if (!config.pausePublish) {
      await removeDistFolders();
      await setBumpDisabled(false, isDev);

      // Calculate and report the elapsed time
      const endTime = performance.now();
      const elapsedTime = endTime - startTime;
      const formattedTime = prettyMilliseconds(elapsedTime, { verbose: true });

      relinka(
        "success",
        `🎉 ${re.bold("Build and publishing completed")} successfully in ${re.bold(formattedTime)}!`,
      );
    } else {
      // Calculate and report the elapsed time
      const endTime = performance.now();
      const elapsedTime = endTime - startTime;
      const formattedTime = prettyMilliseconds(elapsedTime, { verbose: true });

      relinka(
        "success",
        `🎉 ${re.bold("Test build completed")} successfully in ${re.bold(formattedTime)}! Publish is paused in the config.`,
      );
    }
  } catch (error) {
    // Calculate and report the elapsed time even on error
    const endTime = performance.now();
    const elapsedTime = endTime - startTime;
    const formattedTime = prettyMilliseconds(elapsedTime, { verbose: true });

    relinka(
      "error",
      `An unexpected error occurred after ${formattedTime}:`,
      error,
    );
    process.exit(1);
  }
}
