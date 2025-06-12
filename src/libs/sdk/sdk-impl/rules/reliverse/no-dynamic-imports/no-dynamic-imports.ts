import path from "@reliverse/pathkit";
import { promises as fs } from "node:fs";
import { glob } from "tinyglobby";

import type { CheckResult } from "~/libs/sdk/sdk-types";

export async function checkNoDynamicImports(directory: string): Promise<CheckResult> {
  const startTime = Date.now();
  const issues: CheckResult["issues"] = [];
  const files = await glob("**/*.{ts,tsx,js,jsx}", {
    cwd: directory,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  for (const file of files) {
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
        file,
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
