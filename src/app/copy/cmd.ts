// simple example: `bun dler copy --s "src/**/*.ts" --d "dist"`
// advanced example: `bun dler copy --s ".temp/packages/*/lib/**/*" --d "src/libs/sdk/sdk-impl/rules/external"`

import { relinka } from "@reliverse/relinka";
import { defineCommand, selectPrompt, inputPrompt } from "@reliverse/rempts";
import { copyFile, access, mkdir } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import pMap from "p-map";
import prettyMilliseconds from "pretty-ms";
import { glob } from "tinyglobby";

import {
  createPerfTimer,
  getElapsedPerfTime,
} from "~/libs/sdk/sdk-impl/utils/utils-perf";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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
    s: {
      type: "string",
      description: "Source file or directory to copy (supports glob patterns)",
    },
    d: {
      type: "string",
      description: "Destination path for the copy operation",
    },
    recursive: {
      type: "boolean",
      description:
        "Recursively process all files in subdirectories (default: true)",
      default: true,
    },
    preserveStructure: {
      type: "boolean",
      description:
        "Preserve source directory structure in destination (default: true)",
      default: true,
    },
    increment: {
      type: "boolean",
      description:
        "Attach an incrementing index to each destination filename before the extension if set (default: true)",
      default: true,
    },
    concurrency: {
      type: "number",
      description: "Number of concurrent copy operations (default: 8)",
      default: 8,
    },
  },
  async run({ args }) {
    const {
      s,
      d,
      recursive = true,
      preserveStructure = true,
      increment = false,
      concurrency = 8,
    } = args;

    let finalSource = s;
    let finalDestination = d;

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
      relinka("error", "Usage: dler copy --s <source> --d <destination>");
      process.exit(1);
    }

    try {
      const files = await glob(finalSource, {
        dot: true,
        ignore: recursive ? [] : ["**/*"],
      });

      if (files.length === 0) {
        relinka("error", `No files found matching pattern: ${finalSource}`);
        process.exit(1);
      }

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

      const timer = createPerfTimer();

      // Track file name counts per directory for increment logic
      const fileNameCounts = new Map<string, Map<string, number>>();

      await pMap(
        files,
        async (file) => {
          let destPath: string;
          if (preserveStructure) {
            const match = file.match(/packages\/([^/]+)\/lib\/(.*)/);
            if (match?.[1] && match?.[2]) {
              const packageName = match[1];
              const relativePath = match[2];
              destPath = join(finalDestination, packageName, relativePath);
            } else {
              destPath = join(finalDestination, file);
            }
          } else {
            destPath = join(finalDestination, basename(file));
          }

          if (increment) {
            const dir = dirname(destPath);
            const base: string = basename(destPath);
            let dirMap = fileNameCounts.get(dir);
            if (!dirMap) {
              dirMap = new Map();
              fileNameCounts.set(dir, dirMap);
            }
            const count = dirMap.get(base) || 0;
            if (count > 0) {
              const extMatch = base.match(/(.*)(\.[^./\\]+)$/);
              let newBase: string;
              if (extMatch) {
                newBase = `${extMatch[1]}-${count + 1}${extMatch[2]}`;
              } else {
                newBase = `${base}-${count + 1}`;
              }
              destPath = join(dir, newBase);
            }
            dirMap.set(base, count + 1);
          }

          await ensureDir(dirname(destPath));

          if (await fileExists(destPath)) {
            throw new Error(`Destination file already exists: ${destPath}`);
          }

          await copyFile(file, destPath);
          relinka("log", `Copied '${file}' to '${destPath}'`);
        },
        { concurrency, stopOnError: true },
      );

      const elapsed = getElapsedPerfTime(timer);
      relinka(
        "log",
        `Successfully copied ${files.length} file(s) in ${prettyMilliseconds(
          elapsed,
        )}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      relinka("error", `Error during copy operation: ${errorMessage}`);
      process.exit(1);
    }
  },
});
