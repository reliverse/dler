import { join } from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";

import { IGNORE_PATTERNS } from "~/libs/sdk/sdk-impl/constants";

import type { AllowedFileExtensionsType } from "./rules-consts";

// check if directory exists and is accessible
export async function validateDirectory(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// check if file should be ignored based on patterns
export function shouldIgnoreFile(filePath: string): boolean {
  const pathSegments = filePath.split("/");
  return IGNORE_PATTERNS.some((pattern) =>
    pathSegments.some((segment) => segment.includes(pattern)),
  );
}

// get all files in directory
export async function getAllFiles(
  dir: AllowedFileExtensionsType,
  onProgress?: (current: number, total: number, file: string) => void,
): Promise<string[]> {
  const results: string[] = [];
  let fileCount = 0;

  async function searchDirectory(directory: string): Promise<void> {
    try {
      const files = await fs.readdir(directory);

      for (const file of files) {
        const fullPath = join(directory, file);

        // skip ignored patterns
        if (shouldIgnoreFile(fullPath)) {
          continue;
        }

        try {
          const stat = await fs.stat(fullPath);

          if (stat.isDirectory()) {
            // skip templates directory
            if (file === "templates") continue;
            await searchDirectory(fullPath);
          } else {
            results.push(fullPath);
            fileCount++;
            onProgress?.(fileCount, fileCount, fullPath);
          }
        } catch {
          relinka("warn", `skipping inaccessible file: ${fullPath}`);
        }
      }
    } catch {
      relinka("warn", `skipping inaccessible directory: ${directory}`);
    }
  }

  if (!(await validateDirectory(dir))) {
    throw new Error(`directory "${dir}" does not exist or is not accessible`);
  }

  await searchDirectory(dir);
  return results;
}

// helper to get line number from character position
export function getLineNumber(content: string, position: number): number {
  return content.slice(0, position).split("\n").length;
}
