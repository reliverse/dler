// TODO: move implementation to @reliverse/remdn (https://github.com/reliverse/remdn) (this command should only serve as remdn's cli)

/**
 * make-tables.ts
 *
 * Generates a Markdown file comparing the file contents of multiple
 * directory trees. Each directory becomes a column; each folder
 * (recursively discovered from the main directory) becomes a chapter.
 *
 * The very first directory, e.g. "src", is considered the main directory.
 *
 * Usage:
 *   bun run make-tables.ts [config.json]
 *
 * If a JSON file path is supplied it must look like:
 * {
 *   "title": "Optional custom title",
 *   "output": "optional-output.md",
 *   "dirs": {
 *     "/absolute/path/to/main": { "includeExt": [".ts",".js"] },
 *     "/absolute/path/to/other": { "excludeExt": [".test.ts"] }
 *   }
 * }
 */

import { readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { defineArgs, defineCommand, selectPrompt } from "@reliverse/rempts";
import { createJiti } from "jiti";
import pMap from "p-map";

interface DirOptions {
  /** File extensions to include (e.g. ".ts"). If omitted, include all. */
  includeExt?: string[];
  /** File extensions to exclude. */
  excludeExt?: string[];
}

type DirConfig = Record<string, DirOptions>;

type ExtMap = Record<string, [string, string, string]>;

export interface ConfigRemdn {
  title?: string;
  output?: string;
  dirs: DirConfig;
  "ext-map"?: ExtMap;
}

/** Tree representation: folder → set of filenames (no paths). */
interface FileTree {
  folders: Map<string, Set<string>>;
}

/* ----------------------------- helpers ----------------------------- */

const DEFAULT_CONFIG: ConfigRemdn = {
  output: "table.html",
  dirs: {
    src: {},
    "dist-npm/bin": {},
    "dist-jsr/bin": {},
    "dist-libs": {},
  },
  "ext-map": {
    ts: ["ts", "js-d.ts", "ts"], // [<main>, <dist-npm/bin | dist-libs's * npm/bin>, <dist-jsr | dist-libs's * jsr/bin>]
  },
};

const DEFAULT_CONFIG_PATH = ".config/remdn.ts";

const resolvePath = (path: string): string => {
  return resolve(process.cwd(), path);
};

const validateConfigPath = (filePath: string): void => {
  const parts = filePath.split(".");
  // Handle cases like "filename" or "filename."
  if (parts.length <= 1 || (parts.length === 2 && parts[1] === "")) {
    throw new Error(
      `Invalid config file: "${filePath}". Config file must have .json or .ts extension.`,
    );
  }
  const ext = parts.pop()?.toLowerCase();
  if (ext !== "json" && ext !== "ts") {
    throw new Error(
      `Invalid config file extension: "${ext}". Only .json and .ts extensions are supported for config files.`,
    );
  }
};

const validateOutputPath = (filePath: string): void => {
  const parts = filePath.split(".");
  // Handle cases like "filename" or "filename."
  if (parts.length <= 1 || (parts.length === 2 && parts[1] === "")) {
    throw new Error(
      `Invalid output file: "${filePath}". Output file must have either .md or .html extension.`,
    );
  }
  const ext = parts.pop()?.toLowerCase();
  if (ext !== "md" && ext !== "html") {
    throw new Error(
      `Invalid output file extension: "${ext}". Only .md and .html extensions are supported for output files.`,
    );
  }
};

const evaluateTsConfig = async (filePath: string): Promise<ConfigRemdn> => {
  try {
    // Create jiti instance with caching enabled
    const jiti = createJiti(import.meta.url, {
      fsCache: true,
      moduleCache: true,
      interopDefault: true,
    });

    // Import the config file with jiti
    const config = (await jiti.import(filePath, { default: true })) as unknown;

    if (!config || typeof config !== "object") {
      throw new Error("Config file must export a default object");
    }

    // Validate required fields
    const typedConfig = config as ConfigRemdn;
    if (!typedConfig.dirs || typeof typedConfig.dirs !== "object") {
      throw new Error("Config file must export an object with a 'dirs' property");
    }

    return typedConfig;
  } catch (error) {
    throw new Error(
      `Failed to evaluate TypeScript config file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const expandDistLibs = async (dirs: DirConfig): Promise<DirConfig> => {
  const expanded: DirConfig = {};

  for (const [dir, opts] of Object.entries(dirs)) {
    if (dir === "dist-libs" || dir.endsWith("/dist-libs")) {
      // Scan dist-libs for lib directories
      const resolvedDistLibs = resolvePath(dir);
      if (await Bun.file(resolvedDistLibs).exists()) {
        try {
          const libDirs = await readdir(resolvedDistLibs, { withFileTypes: true });

          for (const libDir of libDirs) {
            if (libDir.isDirectory()) {
              const libName = libDir.name;
              const libPath = join(resolvedDistLibs, libName);

              // Check for npm/bin
              const npmBinPath = join(libPath, "npm", "bin");
              if (await Bun.file(npmBinPath).exists()) {
                expanded[npmBinPath] = opts;
              }

              // Check for jsr/bin
              const jsrBinPath = join(libPath, "jsr", "bin");
              if (await Bun.file(jsrBinPath).exists()) {
                expanded[jsrBinPath] = opts;
              }
            }
          }
        } catch (error) {
          console.warn(
            `Warning: Could not read dist-libs directory "${resolvedDistLibs}": ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        console.warn(`Warning: dist-libs directory "${resolvedDistLibs}" not found. Skipping.`);
      }
    } else {
      expanded[dir] = opts;
    }
  }

  return expanded;
};

const readConfig = async (path?: string): Promise<ConfigRemdn> => {
  if (!path) {
    // Try to read from default config path first
    try {
      const defaultConfigPath = resolvePath(DEFAULT_CONFIG_PATH);
      if (await Bun.file(defaultConfigPath).exists()) {
        // Load default configuration from .config/remdn.ts
        const cfg = await evaluateTsConfig(defaultConfigPath);
        const expandedDirs = await expandDistLibs(cfg.dirs);
        return { ...cfg, dirs: expandedDirs };
      }
    } catch (error) {
      console.warn(
        `Warning: Could not read default config at ${DEFAULT_CONFIG_PATH}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // Auto-detect directories
    const dirs: DirConfig = {};
    const possibleDirs = ["src", "dist-npm/bin", "dist-jsr/bin", "dist-libs"];

    // Check all possible directories
    for (const dir of possibleDirs) {
      const resolvedPath = resolvePath(dir);
      if (await Bun.file(resolvedPath).exists()) {
        dirs[dir] = {};
      }
    }

    // Expand dist-libs if found
    const expandedDirs = await expandDistLibs(dirs);

    // If no directories found, throw error
    if (Object.keys(expandedDirs).length === 0) {
      throw new Error(
        "No valid directories found. Please create at least one of: src, dist-npm/bin, dist-jsr/bin, dist-libs",
      );
    }

    // Use the first directory as main
    const mainPath = Object.keys(expandedDirs)[0];
    console.log(`Using "${mainPath}" as main directory`);

    // Resolve all paths in the config
    const resolvedConfig = {
      ...DEFAULT_CONFIG,
      dirs: Object.fromEntries(
        Object.entries(expandedDirs).map(([key, value]) => [resolvePath(key), value]),
      ),
    };

    return resolvedConfig;
  }

  try {
    const resolvedConfigPath = resolvePath(path);
    const ext = path.split(".").pop()?.toLowerCase();
    let config: ConfigRemdn;

    if (ext === "json") {
      const raw = await Bun.file(resolvedConfigPath).text();
      config = JSON.parse(raw) as ConfigRemdn;
    } else if (ext === "ts") {
      config = await evaluateTsConfig(resolvedConfigPath);
    } else {
      throw new Error(`Unsupported config file extension: ${ext}`);
    }

    // Expand dist-libs before processing
    const expandedDirs = await expandDistLibs(config.dirs);
    config.dirs = expandedDirs;

    // Get main directory (first in the list)
    const mainPath = Object.keys(config.dirs)[0];
    if (!mainPath) {
      throw new Error("No main directory found in configuration");
    }

    // Resolve main path
    const resolvedMainPath = resolvePath(mainPath);

    // Check if main directory exists
    if (!(await Bun.file(resolvedMainPath).exists())) {
      throw new Error(
        `Main directory "${resolvedMainPath}" not found. Cannot proceed without main directory.`,
      );
    }

    // Validate directories in custom config
    const existingDirs: DirConfig = {};
    // First add the main directory if it exists
    const mainOpts = config.dirs[mainPath];
    if (!mainOpts) {
      throw new Error(`No options found for main directory "${mainPath}"`);
    }
    existingDirs[resolvedMainPath] = mainOpts;

    // Then add other directories if they exist
    for (const [dir, opts] of Object.entries(config.dirs)) {
      if (dir === mainPath) continue; // Skip main as we already added it

      const resolvedDir = resolvePath(dir);
      if (await Bun.file(resolvedDir).exists()) {
        existingDirs[resolvedDir] = opts;
      } else {
        console.warn(`Warning: Directory "${resolvedDir}" not found. Skipping.`);
      }
    }

    config.dirs = existingDirs;
    return config;
  } catch (error) {
    throw new Error(
      `Failed to read or parse config file at ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const validateFilters = ({ includeExt, excludeExt }: DirOptions) => {
  if (includeExt && excludeExt) {
    for (const ex of excludeExt) {
      if (!includeExt.includes(ex)) {
        throw new Error(
          `Invalid configuration: excludeExt value "${ex}" was not present in includeExt list`,
        );
      }
    }
  }
};

const shouldInclude = (file: string, opts: DirOptions): boolean => {
  const ext = `.${file.split(".").pop()}`;
  // If no filters are specified, include all files
  if (!opts.includeExt && !opts.excludeExt) return true;
  // Apply include filter if specified
  if (opts.includeExt && !opts.includeExt.includes(ext)) return false;
  // Apply exclude filter if specified
  if (opts.excludeExt?.includes(ext)) return false;
  return true;
};

const getCanonicalFilename = (filename: string, extMap?: ExtMap, dirPath?: string): string => {
  if (!extMap) return filename;

  let name = filename;
  // If in dist-libs/<lib>/<npm|jsr>/bin, strip <lib>- prefix
  if (typeof dirPath === "string" && dirPath.includes("dist-libs")) {
    const match = dirPath.match(/dist-libs\/(.*?)\/(npm|jsr)\/bin/);
    const libName = match?.[1];
    if (libName && name.startsWith(`${libName}-`)) {
      name = name.slice(libName.length + 1);
    }
  }

  const parts = name.split(".");
  if (parts.length < 2) return name;

  const ext = parts[parts.length - 1];
  const baseName = parts.slice(0, -1).join(".");

  if (!ext) return name;

  // Handle compound extensions like .d.ts
  if (parts.length >= 3 && parts[parts.length - 2] === "d" && ext === "ts") {
    const baseNameWithoutCompound = parts.slice(0, -2).join(".");
    const canonicalExt = extMap.ts ? extMap.ts[0] : "ts";
    return `${baseNameWithoutCompound}.${canonicalExt}`;
  }

  for (const [, [mainExt, npmExt, jsrExt]] of Object.entries(extMap)) {
    const npmParts = npmExt.split("-");
    const expectedNpmExt = npmParts[0];
    if (ext === mainExt || ext === expectedNpmExt || ext === jsrExt) {
      return `${baseName}.${mainExt}`;
    }
  }

  return name;
};

const getExpectedFilenames = (
  canonicalFilename: string,
  dirPath: string,
  extMap?: ExtMap,
): string[] => {
  if (!extMap) return [canonicalFilename];

  let baseName = canonicalFilename.split(".").slice(0, -1).join(".");
  const ext = canonicalFilename.split(".").pop()!;

  // If generating for dist-libs/<lib>/<npm|jsr>/bin, add <lib>- prefix
  if (typeof dirPath === "string" && dirPath.includes("dist-libs")) {
    const match = dirPath.match(/dist-libs\/(.*?)\/(npm|jsr)\/bin/);
    const libName = match?.[1];
    if (libName && !baseName.startsWith(`${libName}-`)) {
      baseName = `${libName}-${baseName}`;
    }
  }

  const mapEntry = extMap[ext as keyof ExtMap];
  if (!mapEntry) return [canonicalFilename];

  const [, npmExt, jsrExt] = mapEntry;
  const isNpmDir =
    dirPath.includes("dist-npm") ||
    dirPath.includes("/npm/bin") ||
    (dirPath.includes("dist-libs") && dirPath.includes("/npm/bin"));
  const isJsrDir =
    dirPath.includes("dist-jsr") ||
    dirPath.includes("/jsr/bin") ||
    (dirPath.includes("dist-libs") && dirPath.includes("/jsr/bin"));
  const isLibsDir = dirPath.includes("/libs/");

  if (isNpmDir) {
    const npmParts = npmExt.split("-");
    if (npmParts.length === 2) {
      const [primaryExt, secondaryExt] = npmParts;
      if (ext === primaryExt) {
        return [`${baseName}.${primaryExt}`, `${baseName}.${secondaryExt}`];
      } else if (ext === secondaryExt) {
        return [`${baseName}.${secondaryExt}`, `${baseName}.${primaryExt}`];
      }
      return [`${baseName}.${primaryExt}`, `${baseName}.${secondaryExt}`];
    }
    return [`${baseName}.${npmExt}`];
  }

  if (isJsrDir) {
    return [`${baseName}.${jsrExt}`];
  }

  if (isLibsDir) {
    if (dirPath.includes("dist-libs")) {
      const isJsrBin = dirPath.includes("/jsr/bin");
      return isJsrBin ? [`${baseName}.${jsrExt}`] : [`${baseName}.${npmExt}`];
    }
    return [canonicalFilename];
  }

  return [canonicalFilename];
};

const scanDir = async (base: string, opts: DirOptions): Promise<FileTree> => {
  validateFilters(opts);
  const folders = new Map<string, Set<string>>();

  const walk = async (rel = ""): Promise<void> => {
    const abs = join(base, rel);
    const entries = await readdir(abs, { withFileTypes: true });

    const fileSet = folders.get(rel) ?? new Set<string>();
    folders.set(rel, fileSet);

    // Process entries sequentially to avoid unnecessary Promise.all
    for (const entry of entries) {
      const nextRel = join(rel, entry.name);
      if (entry.isDirectory()) {
        await walk(nextRel);
      } else if (entry.isFile() && shouldInclude(entry.name, opts)) {
        fileSet.add(entry.name);
      }
    }
  };

  await walk();
  return { folders };
};

const normalizePath = (path: string): string => {
  return path.replace(/[\\/]+/g, "/");
};

const generateAnchor = (path: string): string => {
  return path.toLowerCase().replace(/[^a-z0-9-]+/g, "");
};

const buildTableHeader = (paths: string[]): string[] => {
  return [
    "| " + paths.map(normalizePath).join(" | ") + " |",
    "| " + paths.map(() => "---").join(" | ") + " |",
  ];
};

// Helper to map dist-libs/<lib>/<type>/bin/<subfolder> to <src|dist-npm|dist-jsr>/libs/<lib>/<subfolder>
function mapDistLibsFolderToLibs(folder: string, colPath: string, allPaths: string[]): string {
  // Only map if this is a dist-libs column
  const distLibsMatch = colPath.match(/dist-libs\/(.*?)\/(npm|jsr)\/bin/);
  if (distLibsMatch) {
    const [, libName, type] = distLibsMatch;
    // Remove any leading ./ or / from folder
    let subfolder = folder.replace(/^\.?\/?/, "");
    // Remove any leading path up to and including /bin
    subfolder = subfolder.replace(/^.*?\/bin\/?/, "");
    // Compose the mapped folder
    let mappedBase = "";
    if (colPath.includes("dist-libs")) {
      // Find the corresponding src/dist-npm/dist-jsr path
      for (const p of allPaths) {
        if (p.includes("src")) mappedBase = `src/libs/${libName}`;
        if (type === "npm" && p.includes("dist-npm")) mappedBase = `dist-npm/bin/libs/${libName}`;
        if (type === "jsr" && p.includes("dist-jsr")) mappedBase = `dist-jsr/bin/libs/${libName}`;
      }
    }
    return mappedBase + (subfolder ? `/${subfolder}` : "");
  }
  return folder;
}

const isDistLibsPath = (p: string) => p.includes("dist-libs");

const buildTableRow = (
  canonicalFilename: string,
  paths: string[],
  trees: FileTree[],
  folder: string,
  extMap?: ExtMap,
): string => {
  const row = paths
    .map((path, i) => {
      const tree = trees[i];
      if (!tree) return "";
      // If this column is dist-libs, use folder as-is
      // If not, and the main folder is a dist-libs folder, map it
      let mappedFolder = folder;
      if (!isDistLibsPath(path) && isDistLibsPath(folder)) {
        mappedFolder = mapDistLibsFolderToLibs(folder, path, paths) || folder;
      }
      const folderFiles = tree.folders.get(mappedFolder ?? "");
      if (!folderFiles || !folderFiles.size) return "";
      const matched = Array.from(folderFiles).filter(
        (f) => getCanonicalFilename(f, extMap, mappedFolder ?? "") === canonicalFilename,
      );
      return matched.join(", ");
    })
    .join(" | ");
  return "| " + row + " |";
};

const buildMarkdown = (
  title: string,
  paths: string[],
  trees: FileTree[],
  extMap?: ExtMap,
): string => {
  const lines: string[] = ["# " + title, ""];
  lines.push("**Table of Contents**:");
  lines.push(""); // Add blank line after Table of Contents header
  lines.push(`- [${title}](#${title.toLowerCase().replace(/\s+/g, "-")})`);

  const mainTree = trees[0];
  if (!mainTree) {
    throw new Error("No trees provided for markdown generation");
  }
  const folderList = [...mainTree.folders.keys()].sort();
  const mainPath = paths[0];
  if (!mainPath) {
    throw new Error("No main path provided for markdown generation");
  }

  // Add table of contents entries
  for (const folder of folderList) {
    const header = folder === "" ? basename(mainPath) : normalizePath(folder);
    const anchor = folder === "" ? basename(mainPath) : generateAnchor(folder);
    lines.push(`  - [${header}](#${anchor})`);
  }
  lines.push(""); // Add blank line after TOC

  for (const folder of folderList) {
    const header = folder === "" ? basename(mainPath) : normalizePath(folder);
    lines.push(`## ${header}`, "");

    lines.push(...buildTableHeader(paths));

    // collect unique canonical file names seen in any column (across all columns, not just mainTree)
    const canonicalFiles = new Set<string>();
    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i];
      if (!tree) continue;
      const mappedFolder = paths[i]?.includes("dist-libs")
        ? mapDistLibsFolderToLibs(folder, paths[i]!, paths) || folder
        : folder;
      const folderFiles = tree.folders.get(mappedFolder ?? "");
      if (folderFiles?.size) {
        for (const filename of folderFiles) {
          const canonical = getCanonicalFilename(filename, extMap, mappedFolder ?? "");
          canonicalFiles.add(canonical);
        }
      }
    }

    for (const canonicalFilename of [...canonicalFiles].sort()) {
      lines.push(buildTableRow(canonicalFilename, paths, trees, folder, extMap));
    }

    lines.push(""); // blank line after each table
  }

  return lines.join("\n");
};

const findMissingFiles = (
  mainTree: FileTree,
  otherTrees: FileTree[],
  paths: string[],
  extMap?: ExtMap,
): string[] => {
  if (!extMap) return [];

  const notifications: string[] = [];
  const mainFolders = mainTree.folders;

  for (let i = 0; i < otherTrees.length; i++) {
    const otherTree = otherTrees[i];
    const otherPath = paths[i + 1]; // +1 because first path is main
    if (!otherTree || !otherPath) continue;

    for (const [folder, files] of otherTree.folders.entries()) {
      // For dist-libs, map to libs folder
      let mainFolderToCheck = folder;
      if (otherPath.includes("dist-libs")) {
        mainFolderToCheck = mapDistLibsFolderToLibs(folder, otherPath, paths) || folder;
      } else if (otherPath === "dist-npm/bin") {
        // For files in dist-npm/bin, look in src
        mainFolderToCheck = folder.replace(/^[/\\]+/, "").replace(/[/\\]+/g, "/");
        if (mainFolderToCheck === "") {
          mainFolderToCheck = "src";
        } else {
          mainFolderToCheck = `src/${mainFolderToCheck}`;
        }
      }
      const mainFiles = mainFolders.get(mainFolderToCheck ?? "");
      if (!mainFiles || !mainFiles.size) continue;
      for (const file of files) {
        const canonicalFile = getCanonicalFilename(file, extMap, folder?.toString() ?? "");
        const expectedFilenames = getExpectedFilenames(canonicalFile, otherPath ?? "", extMap);
        const hasAnyExpectedFile = expectedFilenames.some((expectedFile) =>
          mainFiles.has(expectedFile),
        );
        if (!hasAnyExpectedFile) {
          notifications.push(
            `⚠️  File "${file}" in "${otherPath ?? ""}" should have a corresponding file in "${mainFolderToCheck}"`,
          );
        }
      }
    }
  }
  return notifications;
};

const ensureOutputPath = (path: string): string => {
  // If path is just a filename, create it in current directory
  if (!path.includes("/") && !path.includes("\\")) {
    return path;
  }

  // If path is absolute or relative, ensure the directory exists
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (!Bun.file(dir).exists()) {
    throw new Error(
      `Output directory "${dir}" does not exist. Please provide a valid directory path.`,
    );
  }
  return path;
};

const ensureConfigPath = async (path: string): Promise<string> => {
  if (!(await Bun.file(path).exists())) {
    throw new Error(
      `Configuration file "${path}" does not exist. Please provide a valid path to a JSON configuration file.`,
    );
  }
  return path;
};

const buildHtml = (title: string, paths: string[], trees: FileTree[], extMap?: ExtMap): string => {
  const lines: string[] = [
    "<!DOCTYPE html>",
    "<html lang='en'>",
    "<head>",
    "  <meta charset='UTF-8'>",
    "  <meta name='viewport' content='width=device-width, initial-scale=1.0'>",
    "  <title>" + title + "</title>",
    "  <style>",
    "    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; max-width: 1200px; margin: 0 auto; padding: 2rem; }",
    "    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }",
    "    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }",
    "    th { background-color: #f5f5f5; }",
    "    tr:nth-child(even) { background-color: #f9f9f9; }",
    "    .toc { margin: 2rem 0; }",
    "    .toc a { color: #0366d6; text-decoration: none; }",
    "    .toc a:hover { text-decoration: underline; }",
    "    h1 { border-bottom: 2px solid #eaecef; padding-bottom: 0.3em; }",
    "    h2 { margin-top: 2rem; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }",
    "    .has-diff { color: #dc2626; }",
    "    .has-diff::before { content: '• '; }",
    "    .diff-row { background-color: #fee2e2 !important; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <h1>" + title + "</h1>",
    "  <div class='toc'>",
    "    <h2>Table of Contents</h2>",
  ];

  const mainTree = trees[0];
  if (!mainTree) {
    throw new Error("No trees provided for HTML generation");
  }
  const folderList = [...mainTree.folders.keys()].sort();
  const mainPath = paths[0];
  if (!mainPath) {
    throw new Error("No main path provided for HTML generation");
  }

  // Helper function to check if a folder has differences
  const hasFolderDifferences = (folder: string): boolean => {
    const canonicalFiles = new Set<string>();
    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i];
      if (!tree) continue;
      const mappedFolder = paths[i]?.includes("dist-libs")
        ? mapDistLibsFolderToLibs(folder, paths[i]!, paths) || folder
        : folder;
      const folderFiles = tree.folders.get(mappedFolder ?? "");
      if (folderFiles?.size) {
        for (const filename of folderFiles) {
          const canonical = getCanonicalFilename(filename, extMap, mappedFolder ?? "");
          canonicalFiles.add(canonical);
        }
      }
    }
    const mainFiles = mainTree.folders.get(folder);
    if (!mainFiles) return canonicalFiles.size > 0;
    for (const canonicalFile of canonicalFiles) {
      const expectedFilenames = getExpectedFilenames(canonicalFile, paths[0] ?? "", extMap);
      for (const expectedFilename of expectedFilenames) {
        if (!mainFiles.has(expectedFilename)) {
          return true;
        }
      }
    }
    return false;
  };

  for (const folder of folderList) {
    const header = folder === "" ? basename(mainPath) : normalizePath(folder);
    const anchor = folder === "" ? basename(mainPath) : generateAnchor(folder);
    const hasDiff = hasFolderDifferences(folder);
    const diffClass = hasDiff ? " has-diff" : "";
    lines.push(`    <a href="#${anchor}" class="${diffClass}">${header}</a><br>`);
  }

  for (const folder of folderList) {
    const header = folder === "" ? basename(mainPath) : normalizePath(folder);
    const anchor = folder === "" ? basename(mainPath) : generateAnchor(folder);
    lines.push(`  <h2 id="${anchor}">${header}</h2>`);
    lines.push("  <table>");
    lines.push("    <thead>");
    lines.push("      <tr>");
    for (const path of paths) {
      lines.push(`        <th>${normalizePath(path)}</th>`);
    }
    lines.push("      </tr>");
    lines.push("    </thead>");
    lines.push("    <tbody>");

    // collect unique canonical file names seen in any column (across all columns, not just mainTree)
    const canonicalFiles = new Set<string>();
    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i];
      if (!tree) continue;
      const mappedFolder = paths[i]?.includes("dist-libs")
        ? mapDistLibsFolderToLibs(folder, paths[i]!, paths) || folder
        : folder;
      const folderFiles = tree.folders.get(mappedFolder ?? "");
      if (folderFiles?.size) {
        for (const filename of folderFiles) {
          const canonical = getCanonicalFilename(filename, extMap, mappedFolder ?? "");
          canonicalFiles.add(canonical);
        }
      }
    }

    for (const canonicalFilename of [...canonicalFiles].sort()) {
      const mainFiles = mainTree.folders.get(folder);
      const expectedFilenames = getExpectedFilenames(canonicalFilename, paths[0] ?? "", extMap);
      const hasDiff = mainFiles && expectedFilenames.some((f) => !mainFiles.has(f));
      const diffClass = hasDiff ? " class='diff-row'" : "";
      lines.push(`      <tr${diffClass}>`);
      for (let i = 0; i < paths.length; i++) {
        const tree = trees[i];
        if (!tree) {
          lines.push("        <td></td>");
          continue;
        }
        const mappedFolder = paths[i]?.includes("dist-libs")
          ? mapDistLibsFolderToLibs(folder, paths[i]!, paths) || folder
          : folder;
        const folderFiles = tree.folders.get(mappedFolder ?? "");
        // Show all files in this column that canonicalize to this canonicalFilename
        const matched = folderFiles?.size
          ? Array.from(folderFiles).filter(
              (f) => getCanonicalFilename(f, extMap, mappedFolder ?? "") === canonicalFilename,
            )
          : [];
        lines.push(`        <td>${matched.length ? matched.join(", ") : ""}</td>`);
      }
      lines.push("      </tr>");
    }

    lines.push("    </tbody>");
    lines.push("  </table>");
  }

  lines.push("</body>");
  lines.push("</html>");

  return lines.join("\n");
};

const getFormatFromExtension = (filePath: string): "markdown" | "html" => {
  const parts = filePath.split(".");
  // Handle cases like "filename" or "filename."
  if (parts.length <= 1 || (parts.length === 2 && parts[1] === "")) {
    throw new Error(
      `Invalid output file: "${filePath}". File must have either .md or .html extension.`,
    );
  }
  const ext = parts.pop()?.toLowerCase();
  if (ext === "md") return "markdown";
  if (ext === "html") return "html";
  throw new Error(
    `Invalid output file extension: "${ext}". Only .md and .html extensions are supported.`,
  );
};

const createDefaultConfig = async (path: string): Promise<void> => {
  const ext = path.split(".").pop()?.toLowerCase();
  const isTs = ext === "ts";

  const config = {
    title: "Directory Comparison",
    dirs: {
      src: {},
      "dist-npm/bin": {},
      "dist-jsr/bin": {},
      "dist-libs": {},
    },
  };

  let content: string;
  if (isTs) {
    content = `import type { ConfigRemdn } from "@reliverse/remdn";

const config: ConfigRemdn = ${JSON.stringify(config, null, 2)};

export default config;
`;
  } else {
    content = JSON.stringify(config, null, 2);
  }

  // Ensure the directory exists
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (dir && !(await Bun.file(dir).exists())) {
    await Bun.write(dir, ""); // Create directory
  }

  await writeFile(path, content);
  console.log(`✅ Created new configuration file at ${path}`);
};

/* ------------------------------- scan ------------------------------ */

export async function scanDirectories(
  config?: ConfigRemdn,
  configPath?: string,
  outputPath?: string,
) {
  const resolvedConfig = config ?? (await readConfig(configPath));
  const resolvedOutputPath = outputPath ?? resolvedConfig.output ?? "table.html";

  // Ensure output path is valid
  validateOutputPath(resolvedOutputPath);
  const outFile = ensureOutputPath(resolvedOutputPath);
  const format = getFormatFromExtension(outFile);

  // Get all directory paths
  const dirPaths = Object.keys(resolvedConfig.dirs);
  if (dirPaths.length === 0) {
    throw new Error("No directories specified in configuration");
  }

  // Scan all directories
  const trees = await pMap(
    dirPaths,
    (dir) => {
      const options = resolvedConfig.dirs[dir];
      if (!options) {
        throw new Error(`No options found for directory: ${dir}`);
      }
      return scanDir(dir, options);
    },
    { concurrency: 4 },
  );

  const [mainTree, ...otherTrees] = trees;
  if (!mainTree) {
    throw new Error("Failed to scan main directory");
  }

  // Find missing files if ext-map is provided
  const missingFiles = resolvedConfig["ext-map"]
    ? findMissingFiles(mainTree, otherTrees, dirPaths, resolvedConfig["ext-map"])
    : [];

  // Display missing files notifications
  if (missingFiles.length > 0) {
    console.log("\nFile comparison notifications:");
    for (const msg of missingFiles) {
      console.log(msg);
    }
    console.log(""); // Add blank line after notifications
  }

  // Build the table
  const title = resolvedConfig.title ?? "File Comparison";
  const content =
    format === "html"
      ? buildHtml(title, dirPaths, [mainTree, ...otherTrees], resolvedConfig["ext-map"])
      : buildMarkdown(title, dirPaths, [mainTree, ...otherTrees], resolvedConfig["ext-map"]);

  await writeFile(outFile, content, { flag: "w" });
  console.log("✅ Generated " + outFile);
}

/* ------------------------------- main ------------------------------ */

export default defineCommand({
  meta: {
    name: "remdn",
    description: "Run remdn (undocs alternative)",
  },
  args: defineArgs({
    mode: {
      type: "string",
      // - dirs-scan-only: scan directories and generate a table of files
      // - dirs-scan-compare: compare directories and generate a table of files with extension checks
      allowed: ["dirs-scan-only", "dirs-scan-compare"],
      description: "Operation mode",
    },
    configPath: {
      type: "string",
      description:
        "Path to the configuration file. Can be:\n" +
        "- Just filename with .json or .ts extension (e.g. 'config.json', 'config.ts') - will look in current directory\n" +
        "- Full path with .json or .ts extension (e.g. '/path/to/config.json', '/path/to/config.ts') - must exist\n" +
        `If not provided, will use default configuration at ${DEFAULT_CONFIG_PATH}`,
    },
    outputFilePath: {
      type: "string",
      description:
        "Path to the output file. Can be:\n" +
        "- Just filename with .md or .html extension (e.g. 'output.md', 'output.html') - will be created in current directory\n" +
        "- Full path with .md or .html extension (e.g. '/path/to/output.md', '/path/to/output.html') - directory must exist\n" +
        "If not provided, will use default: table.html",
    },
    initConfig: {
      type: "string",
      description:
        "Initialize a new configuration file. Can be:\n" +
        "- Just filename with .json or .ts extension (e.g. 'config.json', 'config.ts') - will be created in current directory\n" +
        "- Full path with .json or .ts extension (e.g. '/path/to/config.json', '/path/to/config.ts') - directory must exist\n" +
        `If not provided, will create at ${DEFAULT_CONFIG_PATH}`,
    },
  }),
  async run({ args }) {
    let { configPath, outputFilePath, mode, initConfig } = args;

    // Handle initConfig first
    if (initConfig) {
      initConfig = ensureOutputPath(initConfig);
      validateConfigPath(initConfig);
      await createDefaultConfig(initConfig);
      return;
    }

    // Read config first
    const config = configPath ? await readConfig(configPath) : await readConfig();

    if (!outputFilePath) {
      outputFilePath = config.output ?? "table.html";
    } else {
      outputFilePath = ensureOutputPath(outputFilePath);
      // Validate extension
      validateOutputPath(outputFilePath);
    }

    if (configPath) {
      configPath = await ensureConfigPath(configPath);
      // Validate extension
      validateConfigPath(configPath);
    }

    if (!mode) {
      mode = await selectPrompt({
        title: "Select operation mode",
        options: [
          {
            label:
              "Only scan directories and generate a table of files (recommended for most cases)",
            value: "dirs-scan-only",
          },
          {
            label: "Scan directories and generate a table of files + do extension checks",
            value: "dirs-scan-compare",
          },
        ],
      });
    }

    // Only include ext-map if dirs-scan-compare mode is enabled
    const finalConfig: ConfigRemdn =
      mode === "dirs-scan-compare"
        ? config
        : {
            ...config,
            "ext-map": undefined,
          };

    await scanDirectories(finalConfig, configPath, outputFilePath);
  },
});
