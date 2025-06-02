import { relinka } from "@reliverse/relinka";
import { defineCommand } from "@reliverse/rempts";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { rename, access, readdir } from "node:fs/promises";
import { join, dirname, basename, extname } from "node:path";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function safeRename(source: string, destination: string): Promise<void> {
  if (await fileExists(destination)) {
    throw new Error(`Destination file already exists: ${destination}`);
  }
  await rename(source, destination);
}

function isCommonJSFile(content: string): boolean {
  return content.includes("module.exports") || content.includes("require(");
}

async function getAllFilesAsync(dir: string, baseDir = dir, recursive = true): Promise<string[]> {
  let fileList: string[] = [];
  const entries = await readdir(dir, {
    encoding: "utf-8",
    withFileTypes: true,
  });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        const subFiles = await getAllFilesAsync(fullPath, baseDir, recursive);
        fileList = fileList.concat(subFiles);
      }
    } else if (entry.isFile()) {
      fileList.push(fullPath.slice(baseDir.length + 1));
    }
  }
  return fileList;
}

async function prepareCLIFiles(revert = false, recursive = true, useDtsTxtForPrepareMyCLI = false) {
  relinka("log", "Starting CLI file preparation...");

  const configPath = ".config/dler.ts";
  let srcDir = "src";

  if (existsSync(configPath)) {
    const configContent = readFileSync(configPath, "utf-8");
    const configMatch = configContent.match(/coreEntrySrcDir:\s*["']([^"']+)["']/);
    srcDir = configMatch?.[1] ?? srcDir;
  }

  if (!existsSync(srcDir)) {
    throw new Error(`Source directory not found: ${srcDir}`);
  }

  const files = await getAllFilesAsync(srcDir, srcDir, recursive);
  relinka("log", `Found ${files.length} files to process.`);

  let renamedCount = 0;

  for (const file of files) {
    const fullPath = join(srcDir, file);
    if (!(await fileExists(fullPath))) continue;

    const ext = extname(file);
    const fileName = basename(file); // get just the filename
    const baseName = basename(file, ext);
    const dir = dirname(fullPath);

    // relinka("log", `Processing file: ${fullPath}`);

    if (revert) {
      // revert mode
      if (file.endsWith(".json.json")) {
        const originalName = join(dir, fileName.replace(".json.json", ".json"));
        relinka("log", `Reverting ${fullPath} to ${originalName}`);
        await safeRename(fullPath, originalName);
        renamedCount++;
      } else if (file.endsWith(".d.ts.txt") && useDtsTxtForPrepareMyCLI) {
        const originalName = join(dir, fileName.replace(".d.ts.txt", ".d.ts"));
        relinka("log", `Reverting ${fullPath} to ${originalName}`);
        await safeRename(fullPath, originalName);
        renamedCount++;
      } else if (file.endsWith(".cjs")) {
        const originalName = join(dir, `${baseName}.js`);
        relinka("log", `Reverting ${fullPath} to ${originalName}`);
        await safeRename(fullPath, originalName);
        renamedCount++;
      }
    } else {
      // normal mode - using `fileName` instead of `file` for comparisons
      if (fileName === "tsconfig.json" && !fileName.endsWith(".json.json")) {
        const newName = join(dir, "tsconfig.json.json");
        relinka("log", `Renaming ${fullPath} to ${newName}`);
        await safeRename(fullPath, newName);
        renamedCount++;
      } else if (fileName === "package.json" && !fileName.endsWith(".json.json")) {
        const newName = join(dir, "package.json.json");
        relinka("log", `Renaming ${fullPath} to ${newName}`);
        await safeRename(fullPath, newName);
        renamedCount++;
      } else if (
        fileName.endsWith(".d.ts") &&
        !fileName.endsWith(".d.ts.txt") &&
        useDtsTxtForPrepareMyCLI
      ) {
        const baseWithoutD = baseName.slice(0, -2);
        const newName = join(dir, `${baseWithoutD}.d.ts.txt`);
        relinka("log", `Renaming ${fullPath} to ${newName}`);
        await safeRename(fullPath, newName);
        renamedCount++;
      } else if (fileName.endsWith(".js") && !fileName.endsWith(".cjs")) {
        const content = readFileSync(fullPath, "utf-8");
        if (isCommonJSFile(content)) {
          const newName = join(dir, `${baseName}.cjs`);
          relinka("log", `Renaming ${fullPath} to ${newName}`);
          await safeRename(fullPath, newName);
          renamedCount++;
        }
      }
    }
  }

  relinka("log", `CLI file preparation completed. Renamed ${renamedCount} files.`);
}

export default defineCommand({
  meta: {
    name: "rename",
    version: "1.0.0",
    description: "Rename files for CLI preparation",
  },
  args: {
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
    },
    prepareMyCLI: {
      type: "boolean",
      description: "Prepare CLI by renaming files",
    },
    revert: {
      type: "boolean",
      description: "Revert renamed files back to original names",
    },
    source: {
      type: "string",
      description: "Source file or directory to rename",
    },
    destination: {
      type: "string",
      description: "Destination name for the rename operation",
    },
    recursive: {
      type: "boolean",
      description: "Recursively process all files in subdirectories (default: true)",
      default: true,
    },
    useDtsTxtForPrepareMyCLI: {
      type: "boolean",
      description: "Use .d.ts.txt extension for .d.ts files in prepareMyCLI mode (default: false)",
    },
  },
  async run({ args }) {
    const {
      prepareMyCLI,
      revert,
      source,
      destination,
      recursive = true,
      useDtsTxtForPrepareMyCLI = false,
    } = args;

    if (prepareMyCLI === true) {
      try {
        await prepareCLIFiles(revert === true, recursive, useDtsTxtForPrepareMyCLI);
        relinka("log", "Successfully prepared CLI files");
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        relinka("error", `Error preparing CLI: ${errorMessage}`);
        process.exit(1);
      }
      return;
    }

    if (!source || !destination) {
      relinka("error", "Usage: dler relifso rename <source> <destination>");
      process.exit(1);
    }

    try {
      await safeRename(source, destination);
      relinka("log", `Successfully renamed '${source}' to '${destination}'`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      relinka("error", `Error renaming: ${errorMessage}`);
      process.exit(1);
    }
  },
});
