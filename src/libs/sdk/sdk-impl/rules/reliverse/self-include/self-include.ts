import { getFileImportsExports, extname } from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";

import type {
  CheckIssue,
  CheckResult,
  RulesCheckOptions,
} from "~/libs/sdk/sdk-types";

import { loadConfig } from "~/libs/sdk/sdk-impl/cfg/load";
import {
  getAllFiles,
  getLineNumber,
} from "~/libs/sdk/sdk-impl/rules/rules-utils";

// check for self-includes in imports/exports
export async function checkSelfInclude(
  options: RulesCheckOptions,
): Promise<CheckResult> {
  const startTime = Date.now();
  const issues: CheckIssue[] = [];
  const { directory, onProgress } = options;
  const dirPath = directory as string;

  try {
    // Get package name from package.json
    const packageJson = JSON.parse(
      await fs.readFile("package.json", "utf-8"),
    ) as {
      name: string;
    };
    const packageName = packageJson.name;

    // Get libs list from dler config
    const config = await loadConfig();
    const libsList = config.libsList || {};

    // Define forbidden imports based on directory
    let forbiddenImports: string[] = [];
    if (dirPath === "dist-npm" || dirPath === "dist-jsr" || dirPath === "src") {
      // For dist-npm, dist-jsr, and src, forbid importing the main package and any libsList libraries
      forbiddenImports = [packageName, ...Object.keys(libsList)];
    } else if (
      dirPath === "dist-libs/npm" ||
      dirPath === "dist-libs/jsr" ||
      dirPath.startsWith("src/libs/")
    ) {
      // For dist-libs and src/libs, forbid importing the main package and self-imports
      // Get the current library name based on the directory structure
      const libDirName = dirPath.split("/").pop() || "";
      const currentLib = Object.entries(libsList).find(
        ([, config]) => config.libDirName === libDirName,
      )?.[0];

      if (currentLib) {
        // Forbid importing both the main package and the current library itself
        forbiddenImports = [packageName, currentLib];
      } else {
        // If we can't determine the current library, just forbid the main package
        forbiddenImports = [packageName];
      }
    }

    const files = await getAllFiles(directory);
    let totalImports = 0;

    // Filter only files that might contain imports
    const importableFiles = files.filter((file) => {
      const ext = extname(file);
      return [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext);
    });

    // Process files in parallel batches
    const batchSize = 20;
    const batches = [];

    for (let i = 0; i < importableFiles.length; i += batchSize) {
      batches.push(importableFiles.slice(i, i + batchSize));
    }

    for (const [batchIndex, batch] of batches.entries()) {
      const batchPromises = batch.map(async (file, fileIndex) => {
        const globalIndex = batchIndex * batchSize + fileIndex;
        onProgress?.(globalIndex + 1, importableFiles.length, file);

        try {
          const content = await fs.readFile(file, "utf-8");
          const imports = getFileImportsExports(content, {
            kind: "import",
            pathTypes: ["bare"],
          });

          totalImports += imports.length;
          const fileIssues: CheckIssue[] = [];

          for (const imp of imports) {
            if (!imp.source) continue;

            // Check if the import matches any forbidden imports
            for (const forbidden of forbiddenImports) {
              if (imp.source.startsWith(forbidden)) {
                fileIssues.push({
                  file,
                  message: `self-include detected: importing "${imp.source}" in ${directory} directory`,
                  type: "self-include",
                  line: getLineNumber(content, imp.start),
                });
                break;
              }
            }
          }

          return { issues: fileIssues, importCount: imports.length };
        } catch {
          relinka("warn", `skipping unreadable file: ${file}`);
          return { issues: [], importCount: 0 };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        issues.push(...result.issues);
        totalImports += result.importCount;
      }
    }

    return {
      success: issues.length === 0,
      issues,
      stats: {
        filesChecked: importableFiles.length,
        importsChecked: totalImports,
        timeElapsed: Date.now() - startTime,
      },
    };
  } catch (error) {
    throw new Error(
      `failed to check self-includes: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
