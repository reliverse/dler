import path from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import { promises as fs } from "node:fs";
import { glob } from "tinyglobby";

import type { CheckResult } from "~/libs/sdk/sdk-types";
import type { DirectoryType } from "~/libs/sdk/sdk-types";

interface CheckNoDynamicImportsOptions {
  directory: DirectoryType;
  onProgress?: (current: number, total: number) => void;
}

async function validateDirectory(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

function isDirectoryType(value: unknown): value is DirectoryType {
  return (
    typeof value === "string" &&
    ["src", "dist-npm", "dist-jsr", "dist-libs/npm", "dist-libs/jsr"].includes(value)
  );
}

export async function checkNoDynamicImports(
  options: CheckNoDynamicImportsOptions,
): Promise<CheckResult> {
  const { directory, onProgress } = options;

  if (!isDirectoryType(directory)) {
    relinka("error", `Invalid directory type: ${directory}`);
    return {
      success: false,
      issues: [
        {
          type: "file-extension",
          file: String(directory),
          line: 0,
          column: 0,
          message: `Invalid directory type: ${directory}`,
        },
      ],
      stats: {
        filesChecked: 0,
        importsChecked: 0,
        timeElapsed: 0,
      },
    };
  }

  if (!(await validateDirectory(directory))) {
    relinka("error", `Directory "${directory}" does not exist or is not accessible`);
    return {
      success: false,
      issues: [
        {
          type: "file-extension",
          file: directory,
          line: 0,
          column: 0,
          message: `Directory "${directory}" does not exist or is not accessible`,
        },
      ],
      stats: {
        filesChecked: 0,
        importsChecked: 0,
        timeElapsed: 0,
      },
    };
  }

  const startTime = Date.now();
  const issues: CheckResult["issues"] = [];
  const files = await glob("**/*.{ts,tsx,js,jsx}", {
    cwd: directory,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  for (let i = 0; i < files.length; i++) {
    const file = files[i] as string;
    onProgress?.(i + 1, files.length);

    const filePath = path.join(directory, file);
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");

    // Regular expression to match dynamic imports
    const dynamicImportRegex = /await\s+import\s*\(/g;
    let match: RegExpExecArray | null;

    while (true) {
      match = dynamicImportRegex.exec(content);
      if (!match) break;

      const lineNumber = content.substring(0, match.index).split("\n").length;
      const lineContent = lines[lineNumber - 1] ?? "";
      const column = match.index - content.lastIndexOf("\n", match.index);

      issues.push({
        type: "file-extension",
        file: file as string,
        line: lineNumber,
        column,
        message: `Dynamic import found: ${lineContent.trim()}. Consider using static imports for better tree-shaking, type inference, and performance.`,
      });
    }
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
}
