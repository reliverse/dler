import { readTSConfig } from "pkg-types";

import type { CheckIssue, CheckResult } from "~/libs/sdk/sdk-types";

// check tsconfig.json health
// - validates module resolution from tsconfig
export async function checkTsConfigHealth(): Promise<CheckResult> {
  const startTime = Date.now();
  const issues: CheckIssue[] = [];

  try {
    const tsconfig = await readTSConfig();
    const moduleResolution = tsconfig?.compilerOptions?.moduleResolution;

    if (!moduleResolution) {
      issues.push({
        type: "tsconfig-health" as const,
        message: "moduleResolution is not specified in tsconfig.json",
        file: "tsconfig.json",
      });
    } else if (
      moduleResolution !== "bundler" &&
      moduleResolution !== "nodenext"
    ) {
      issues.push({
        type: "tsconfig-health" as const,
        message: `unsupported moduleResolution: ${moduleResolution}. Only "bundler" and "nodenext" are supported`,
        file: "tsconfig.json",
      });
    }

    return {
      success: issues.length === 0,
      issues,
      stats: {
        filesChecked: 1,
        importsChecked: 0,
        timeElapsed: Date.now() - startTime,
      },
    };
  } catch (error) {
    throw new Error(
      `failed to read tsconfig.json: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
