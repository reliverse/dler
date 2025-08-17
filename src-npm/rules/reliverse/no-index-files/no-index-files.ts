import path from "@reliverse/pathkit";
import { glob } from "tinyglobby";

import type { CheckResult, RulesCheckOptions } from "~/libs/sdk/sdk-impl/sdk-types";

export async function checkNoIndexFiles(options: RulesCheckOptions): Promise<CheckResult> {
  const { directory } = options;
  const startTime = Date.now();

  // Find all index files
  const indexFiles = await glob("**/index.{ts,js}", {
    cwd: directory,
    ignore: ["node_modules/**", "dist/**", ".git/**"],
  });

  const issues = [];
  const stats = {
    filesChecked: indexFiles.length,
    importsChecked: 0,
    timeElapsed: Date.now() - startTime,
  };

  for (const file of indexFiles) {
    const fullPath = path.join(directory, file);
    const dirName = path.basename(path.dirname(file));

    issues.push({
      type: "no-index-files" as const,
      file: fullPath,
      line: 1,
      message: `Avoid using index.{ts,js} file names. Use descriptive names like mod.{ts,js} or ${dirName}-mod.{ts,js} instead. This reduces confusion, especially since TypeScript can resolve index files implicitly depending on the module resolution strategy.`,
    });
  }

  return {
    success: issues.length === 0,
    issues,
    stats,
  };
}
