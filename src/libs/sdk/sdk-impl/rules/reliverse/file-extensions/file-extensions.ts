import { extname } from "@reliverse/pathkit";

import type { AllowedFileExtensionsType } from "~/libs/sdk/sdk-impl/rules/rules-consts";
import type {
  CheckIssue,
  CheckResult,
  RulesCheckOptions,
} from "~/libs/sdk/sdk-types";

import {
  ALLOWED_FILE_EXTENSIONS,
  STRICT_FILE_EXTENSIONS,
} from "~/libs/sdk/sdk-impl/rules/rules-consts";
import { getAllFiles } from "~/libs/sdk/sdk-impl/rules/rules-utils";

// get allowed file extensions (for actual files on disk)
function getAllowedFileExtensions(
  directory: AllowedFileExtensionsType,
  strict: boolean,
  moduleResolution: "bundler" | "nodenext",
): string[] {
  if (!strict) {
    return ALLOWED_FILE_EXTENSIONS[directory];
  }

  if (moduleResolution === "bundler") {
    return STRICT_FILE_EXTENSIONS[directory];
  }

  // for nodenext, enforce stricter rules (no empty extensions)
  return STRICT_FILE_EXTENSIONS[directory];
}

// check file extensions (actual files on disk)
export async function checkFileExtensions(
  options: RulesCheckOptions,
): Promise<CheckResult> {
  const startTime = Date.now();
  const issues: CheckIssue[] = [];
  const { directory, strict, moduleResolution, onProgress } = options;

  const allowedExts = getAllowedFileExtensions(
    directory,
    strict,
    moduleResolution,
  );

  try {
    const files = await getAllFiles(directory, onProgress);

    // process files in parallel batches
    const batchSize = 50;
    const batches = [];

    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    for (const [batchIndex, batch] of batches.entries()) {
      const batchPromises = batch.map(async (file, fileIndex) => {
        const globalIndex = batchIndex * batchSize + fileIndex;
        onProgress?.(globalIndex + 1, files.length, file);

        const ext = extname(file);
        if (!allowedExts.includes(ext)) {
          // special messages for common issues
          let message = `file has disallowed extension "${ext}" (allowed: ${allowedExts.join(", ")})`;

          if (
            ext === ".ts" &&
            (directory === "dist-npm" || directory === "dist-libs/npm")
          ) {
            message = `typescript file found in javascript environment: ${file} (should be compiled to .js)`;
          } else if (
            ext === ".js" &&
            (directory === "src" ||
              directory === "dist-jsr" ||
              directory === "dist-libs/jsr")
          ) {
            message = `javascript file found in typescript environment: ${file} (should be .ts)`;
          }

          return {
            file,
            message,
            type: "file-extension" as const,
          };
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      issues.push(...(batchResults.filter(Boolean) as CheckIssue[]));
    }

    return {
      success: issues.length === 0,
      issues,
      stats: {
        filesChecked: files.length,
        importsChecked: 0,
        timeElapsed: Date.now() - startTime,
      },
    };
  } catch (error) {
    throw new Error(
      `failed to check file extensions: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
