// simple example: dler copy src/**/*.ts dist
// advanced example: dler copy putout/packages/*/lib/**/* src/libs/sdk/sdk-impl/rules/putout

import { relinka } from "@reliverse/relinka";
import { defineCommand, selectPrompt, inputPrompt } from "@reliverse/rempts";
import { copyFile, access, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { glob } from "tinyglobby";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function safeCopy(source: string, destination: string): Promise<void> {
  if (await fileExists(destination)) {
    throw new Error(`Destination file already exists: ${destination}`);
  }
  await copyFile(source, destination);
}

async function ensureDir(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    await mkdir(path, { recursive: true });
  }
}

export default defineCommand({
  meta: {
    name: "copy",
    version: "1.0.0",
    description: "Copy files and directories",
  },
  args: {
    source: {
      type: "string",
      description: "Source file or directory to copy (supports glob patterns)",
    },
    destination: {
      type: "string",
      description: "Destination path for the copy operation",
    },
    recursive: {
      type: "boolean",
      description:
        "Recursively process all files in subdirectories (default: true)",
      default: true,
    },
    force: {
      type: "boolean",
      description: "Overwrite existing files (default: false)",
      default: false,
    },
    preserveStructure: {
      type: "boolean",
      description:
        "Preserve source directory structure in destination (default: true)",
      default: true,
    },
  },
  async run({ args }) {
    const {
      source,
      destination,
      recursive = true,
      force = false,
      preserveStructure = true,
    } = args;

    // Interactive mode if source or destination is not provided
    let finalSource = source;
    let finalDestination = destination;

    if (!finalSource) {
      finalSource = await inputPrompt({
        title: "Enter source file or directory (supports glob patterns)",
        placeholder: "e.g., putout/packages/*/lib/**/*",
      });
    }

    if (!finalDestination) {
      finalDestination = await inputPrompt({
        title: "Enter destination path",
        placeholder: "e.g., src/libs/sdk/sdk-impl/rules/putout",
      });
    }

    if (!finalSource || !finalDestination) {
      relinka("error", "Usage: dler copy <source> <destination>");
      process.exit(1);
    }

    try {
      // Find all matching files using glob
      const files = await glob(finalSource, {
        dot: true,
        ignore: recursive ? [] : ["**/*"],
      });

      if (files.length === 0) {
        relinka("error", `No files found matching pattern: ${finalSource}`);
        process.exit(1);
      }

      // If multiple files are found, confirm with user
      if (files.length > 1) {
        const confirm = await selectPrompt({
          title: `Found ${files.length} files to copy. Proceed?`,
          options: [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ],
        });

        if (confirm === "no") {
          relinka("log", "Operation cancelled by user");
          return;
        }
      }

      // Copy each file
      for (const file of files) {
        let destPath: string;
        if (preserveStructure) {
          // Extract package name from path (assuming structure: packages/package-name/lib/...)
          const match = file.match(/packages\/([^/]+)\/lib\/(.*)/);
          if (match?.[1] && match?.[2]) {
            const packageName = match[1];
            const relativePath = match[2];
            destPath = join(finalDestination, packageName, relativePath);
          } else {
            destPath = join(finalDestination, file);
          }
        } else {
          destPath = join(finalDestination, file);
        }

        try {
          // Ensure destination directory exists
          await ensureDir(dirname(destPath));

          if (force) {
            await copyFile(file, destPath);
          } else {
            await safeCopy(file, destPath);
          }
          relinka("log", `Copied '${file}' to '${destPath}'`);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          relinka("error", `Error copying '${file}': ${errorMessage}`);
          if (!force) {
            process.exit(1);
          }
        }
      }

      relinka("log", `Successfully copied ${files.length} file(s)`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      relinka("error", `Error during copy operation: ${errorMessage}`);
      process.exit(1);
    }
  },
});
