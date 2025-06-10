import type { CheckIssue, CheckResult } from "~/libs/sdk/sdk-types";

import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";

// check "dler-config-health" rule
export async function checkDlerConfigHealth(): Promise<CheckResult> {
  const startTime = Date.now();
  const issues: CheckIssue[] = [];

  try {
    const config = await getConfigDler();
    const libsList = config.libsList || {};

    for (const [, libConfig] of Object.entries(libsList)) {
      const typedConfig = libConfig as {
        libMainFile?: string;
        libDirName?: string;
      };
      const mainFile = typedConfig.libMainFile;
      if (mainFile && !mainFile.includes("/")) {
        issues.push({
          type: "dler-config-health",
          message: `currently you should specify libsMainFile like "sdk/sdk-mod.ts" to get correct build, please correct "${mainFile}" to "${typedConfig.libDirName}/${mainFile}" to continue checks.`,
          file: ".config/dler.ts",
          line: 0,
        });
      }
    }
  } catch (error) {
    issues.push({
      type: "dler-config-health",
      message: `failed to check libsMainFile format: ${error instanceof Error ? error.message : "unknown error"}`,
      file: ".config/dler.ts",
      line: 0,
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
}
