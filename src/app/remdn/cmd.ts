// TODO: move implementation to @reliverse/remdn (https://github.com/reliverse/remdn) (this command should only serve as remdn's cli)

/**
 * make-tables.ts
 *
 * Generates a Markdown file comparing the file contents of multiple
 * directory trees. Each directory becomes a column; each folder
 * (recursively discovered from the main directory) becomes a chapter.
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

import { selectPrompt } from "@reliverse/rempts";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import { createJiti } from "jiti";
import { writeFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import pMap from "p-map";

interface DirOptions {
  /** File extensions to include (e.g. ".ts"). If omitted, include all. */
  includeExt?: string[];
  /** File extensions to exclude. */
  excludeExt?: string[];
}

type DirConfig = Record<string, DirOptions>;

type ExtMap = Record<string, [string, string, string]>;

interface ConfigFile {
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

const DEFAULT_CONFIG: ConfigFile = {
  output: "table.md",
  dirs: {
    src: {}, // No extension filters by default
    "dist-npm/bin": {}, // No extension filters by default
    "dist-jsr/bin": {}, // No extension filters by default
  },
  "ext-map": {
    ts: ["ts", "js-d.ts", "ts"], // [<main>, <dist-npm/bin | dist-libs's * npm/bin>, <dist-jsr | dist-libs's * jsr/bin>]
  },
};

const DEFAULT_CONFIG_PATH = ".config/remdn.ts";

const getLibDirs = async (basePath: string, mainPath: string): Promise<DirConfig> => {
  const libDirs: DirConfig = {};
  try {
    // Check if src/libs exists
    const srcLibsPath = join(mainPath, "libs");
    const srcLibsExists = await Bun.file(srcLibsPath).exists();
    if (!srcLibsExists) {
      console.warn(`Warning: ${srcLibsPath} directory not found. Skipping dist-libs processing.`);
      return libDirs;
    }

    const entries = await readdir(basePath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const libName = entry.name;
        const srcLibPath = join(srcLibsPath, libName);

        // Check if corresponding lib exists in src/libs
        const srcLibExists = await Bun.file(srcLibPath).exists();
        if (!srcLibExists) {
          console.warn(
            `Warning: Lib "${libName}" found in dist-libs but not in ${srcLibsPath}. Skipping.`,
          );
          continue;
        }

        const libPath = join(basePath, libName);
        const libEntries = await readdir(libPath, { withFileTypes: true });

        for (const libEntry of libEntries) {
          if (libEntry.isDirectory() && (libEntry.name === "npm" || libEntry.name === "jsr")) {
            const binPath = join(libPath, libEntry.name, "bin");
            libDirs[binPath] = {}; // No extension filters by default
          }
        }
      }
    }
  } catch (error) {
    console.warn(
      `Warning: Could not process dist-libs: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return libDirs;
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

const evaluateTsConfig = async (filePath: string): Promise<ConfigFile> => {
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
    const typedConfig = config as ConfigFile;
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

const readConfig = async (path?: string): Promise<ConfigFile> => {
  if (!path) {
    // Try to read from default config path first
    try {
      if (await Bun.file(DEFAULT_CONFIG_PATH).exists()) {
        return await evaluateTsConfig(DEFAULT_CONFIG_PATH);
      }
    } catch (error) {
      console.warn(
        `Warning: Could not read default config at ${DEFAULT_CONFIG_PATH}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const mainPath = DEFAULT_CONFIG.dirs.src ? "src" : Object.keys(DEFAULT_CONFIG.dirs)[0];
    if (!mainPath) {
      throw new Error("No main directory found in default configuration");
    }

    // Check if main directory exists
    if (!(await Bun.file(mainPath).exists())) {
      throw new Error(
        `Main directory "${mainPath}" not found. Cannot proceed without main directory.`,
      );
    }

    // Check which default directories exist
    const existingDirs: DirConfig = {};
    for (const [dir, opts] of Object.entries(DEFAULT_CONFIG.dirs)) {
      if (dir === mainPath || (await Bun.file(dir).exists())) {
        existingDirs[dir] = opts;
      } else {
        console.warn(`Warning: Directory "${dir}" not found. Skipping.`);
      }
    }

    // Only process dist-libs if it's not prevented and src/libs exists
    if (!existingDirs["dist-libs"] && (await Bun.file("dist-libs").exists())) {
      const libDirs = await getLibDirs("dist-libs", mainPath);
      Object.assign(existingDirs, libDirs);
    }

    return {
      ...DEFAULT_CONFIG,
      dirs: existingDirs,
    };
  }

  try {
    const ext = path.split(".").pop()?.toLowerCase();
    let config: ConfigFile;

    if (ext === "json") {
      const raw = await Bun.file(path).text();
      config = JSON.parse(raw) as ConfigFile;
    } else if (ext === "ts") {
      config = await evaluateTsConfig(path);
    } else {
      throw new Error(`Unsupported config file extension: ${ext}`);
    }

    // Get main directory (first in the list)
    const mainPath = Object.keys(config.dirs)[0];
    if (!mainPath) {
      throw new Error("No main directory found in configuration");
    }

    // Check if main directory exists
    if (!(await Bun.file(mainPath).exists())) {
      throw new Error(
        `Main directory "${mainPath}" not found. Cannot proceed without main directory.`,
      );
    }

    // Validate directories in custom config
    const existingDirs: DirConfig = {};
    for (const [dir, opts] of Object.entries(config.dirs)) {
      if (dir === mainPath || (await Bun.file(dir).exists())) {
        existingDirs[dir] = opts;
      } else {
        console.warn(`Warning: Directory "${dir}" not found. Skipping.`);
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

const buildTableHeader = (paths: string[]): string[] => {
  return ["| " + paths.join(" | ") + " |", "| " + paths.map(() => "---").join(" | ") + " |"];
};

const buildTableRow = (f: string, paths: string[], trees: FileTree[], folder: string): string => {
  const row = paths
    .map((_, i) => {
      const tree = trees[i];
      if (!tree) return "";
      const folderFiles = tree.folders.get(folder);
      return folderFiles?.has(f) ? f : "";
    })
    .join(" | ");
  return "| " + row + " |";
};

const buildMarkdown = (title: string, paths: string[], trees: FileTree[]): string => {
  const lines: string[] = ["# " + title, ""];
  lines.push("**Table of Contents**:", "");

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
    const fullPath = folder === "" ? mainPath : join(mainPath, folder);
    const header = folder === "" ? "." : folder;
    const anchor = fullPath.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    lines.push(`- [${header}](#${anchor})`);
  }
  lines.push(""); // Add blank line after TOC

  for (const folder of folderList) {
    const header = folder === "" ? "." : folder;
    lines.push("## " + header, "");

    lines.push(...buildTableHeader(paths));

    // collect unique file names seen in any column
    const files = new Set<string>();
    for (const t of trees) {
      const folderFiles = t.folders.get(folder);
      if (folderFiles) {
        for (const f of folderFiles) {
          files.add(f);
        }
      }
    }

    for (const f of [...files].sort()) {
      lines.push(buildTableRow(f, paths, trees, folder));
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
      const mainFiles = mainFolders.get(folder);
      if (!mainFiles) continue;

      for (const file of files) {
        const ext = file.split(".").pop() || "";
        const mapEntry = extMap[ext];
        if (!mapEntry) continue;

        const [mainExt, npmExt, jsrExt] = mapEntry;
        const isNpmDir = otherPath.includes("/npm/");
        const isJsrDir = otherPath.includes("/jsr/");

        if (!mainFiles.has(file)) {
          const expectedExt = isNpmDir ? npmExt : isJsrDir ? jsrExt : mainExt;
          const actualExt = file.split(".").pop() || "";

          if (actualExt !== expectedExt) {
            notifications.push(
              `⚠️  File "${file}" in "${otherPath}" has extension "${actualExt}" but should be "${expectedExt}" according to ext-map`,
            );
          }
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

const buildHtml = (title: string, paths: string[], trees: FileTree[]): string => {
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

  // Add table of contents entries
  for (const folder of folderList) {
    const fullPath = folder === "" ? mainPath : join(mainPath, folder);
    const header = folder === "" ? "." : folder;
    const anchor = fullPath.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    lines.push(`    <a href="#${anchor}">${header}</a><br>`);
  }

  for (const folder of folderList) {
    const header = folder === "" ? "." : folder;
    const anchor =
      folder === ""
        ? mainPath.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        : folder.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    lines.push(`  <h2 id="${anchor}">${header}</h2>`);
    lines.push("  <table>");
    lines.push("    <thead>");
    lines.push("      <tr>");
    for (const path of paths) {
      lines.push(`        <th>${path}</th>`);
    }
    lines.push("      </tr>");
    lines.push("    </thead>");
    lines.push("    <tbody>");

    // collect unique file names seen in any column
    const files = new Set<string>();
    for (const t of trees) {
      const folderFiles = t.folders.get(folder);
      if (folderFiles) {
        for (const f of folderFiles) {
          files.add(f);
        }
      }
    }

    for (const f of [...files].sort()) {
      lines.push("      <tr>");
      for (let i = 0; i < paths.length; i++) {
        const tree = trees[i];
        const folderFiles = tree?.folders.get(folder);
        const hasFile = folderFiles?.has(f);
        lines.push(`        <td>${hasFile ? f : ""}</td>`);
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
      src: {}, // No extension filters by default
      dist: {}, // No extension filters by default
    },
  };

  let content: string;
  if (isTs) {
    content = `import type { ConfigFile } from "@reliverse/remdn";

const config: ConfigFile = ${JSON.stringify(config, null, 2)};

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
  config?: ConfigFile,
  configPath?: string,
  outputPath?: string,
) {
  const cfg = config ?? (await readConfig(configPath));
  const dirPaths = Object.keys(cfg.dirs);

  if (dirPaths.length === 0) {
    throw new Error("Configuration error: No valid directories found to process");
  }

  const mainPath = dirPaths[0]!;
  const mainOptions = cfg.dirs[mainPath];
  if (!mainOptions) {
    throw new Error(`Configuration error: No options found for directory: ${mainPath}`);
  }
  const mainTree = await scanDir(mainPath, mainOptions);

  // Scan the remaining directories concurrently, with validation.
  const otherPaths = dirPaths.slice(1);
  const otherTrees = await pMap(
    otherPaths,
    async (p) => {
      const options = cfg.dirs[p];
      if (!options) {
        throw new Error(`Configuration error: No options found for directory: ${p}`);
      }
      const tree = await scanDir(p, options);
      for (const folder of tree.folders.keys()) {
        if (!mainTree.folders.has(folder)) {
          throw new Error(
            `Directory structure mismatch: Folder "${folder}" exists in "${p}" but not in main directory "${mainPath}"`,
          );
        }
      }
      return tree;
    },
    { concurrency: 4 },
  );

  // Check for missing files and extension mismatches
  const notifications = findMissingFiles(mainTree, otherTrees, dirPaths, cfg["ext-map"]);
  if (notifications.length > 0) {
    console.log("\nFile comparison notifications:");
    for (const msg of notifications) {
      console.log(msg);
    }
    console.log(""); // Add blank line after notifications
  }

  const title = cfg.title ?? "Directory Comparison Table";
  const outFile = outputPath ?? "table.md";
  const format = getFormatFromExtension(outFile);
  const content =
    format === "html"
      ? buildHtml(title, dirPaths, [mainTree, ...otherTrees])
      : buildMarkdown(title, dirPaths, [mainTree, ...otherTrees]);

  await writeFile(outFile, content);
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
        "If not provided, will use default: table.md",
    },
    initConfig: {
      type: "string",
      description:
        "Initialize a new configuration file. Can be:\n" +
        "- Just filename with .json or .ts extension (e.g. 'config.json', 'config.ts') - will be created in current directory\n" +
        "- Full path with .json or .ts extension (e.g. '/path/to/config.json', '/path/to/config.ts') - directory must exist\n" +
        `If not provided, will create at ${DEFAULT_CONFIG_PATH}`,
    },
    processLibsOnly: {
      type: "boolean",
      description: "Process only dist-libs directories (requires src/libs to exist)",
    },
    preventLibsProcessing: {
      type: "boolean",
      description: "Prevent processing of dist-libs directories even when requirements are met",
    },
  }),
  async run({ args }) {
    const { processLibsOnly, preventLibsProcessing } = args;
    let { configPath, outputFilePath, mode, initConfig } = args;

    // Handle initConfig first
    if (initConfig) {
      initConfig = ensureOutputPath(initConfig);
      validateConfigPath(initConfig);
      await createDefaultConfig(initConfig);
      return;
    }

    if (!outputFilePath) {
      outputFilePath = "table.md";
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
            label: "Only scan directories and generate a table of files",
            value: "dirs-scan-only",
          },
          {
            label: "Scan directories and generate a table of files + do extension checks",
            value: "dirs-scan-compare",
          },
        ],
      });
    }

    const config = configPath ? await readConfig(configPath) : await readConfig();

    // Only include ext-map if dirs-scan-compare mode is enabled
    const finalConfig: ConfigFile =
      mode === "dirs-scan-compare"
        ? config
        : {
            ...config,
            "ext-map": undefined,
          };

    // If processLibsOnly is true, filter dirs to only include dist-libs
    if (processLibsOnly) {
      const mainPath = config.dirs.src ? "src" : Object.keys(config.dirs)[0];
      if (!mainPath) {
        throw new Error("No main directory found in configuration");
      }
      const libDirs = await getLibDirs("dist-libs", mainPath);
      finalConfig.dirs = libDirs;
    }
    // If preventLibsProcessing is true, remove any dist-libs directories
    else if (preventLibsProcessing) {
      const filteredDirs = { ...finalConfig.dirs };
      for (const dir of Object.keys(filteredDirs)) {
        if (dir.includes("dist-libs")) {
          delete filteredDirs[dir];
        }
      }
      finalConfig.dirs = filteredDirs;
    }

    await scanDirectories(finalConfig, configPath, outputFilePath);
  },
});
