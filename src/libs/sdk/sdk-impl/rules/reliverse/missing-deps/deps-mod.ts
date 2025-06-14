import type { CheckIssue, CheckResult, RulesCheckOptions } from "~/libs/sdk/sdk-impl/sdk-types";

import { IGNORE_PATTERNS } from "~/libs/sdk/sdk-impl/constants";
import { analyzeDependencies } from "~/libs/sdk/sdk-impl/rules/reliverse/missing-deps/analyzer";

// check missing dependencies
export async function checkMissingDependencies(options: RulesCheckOptions): Promise<CheckResult> {
  const startTime = Date.now();
  const issues: CheckIssue[] = [];
  const {
    directory,
    json = false,
    builtins = true,
    dev = false,
    peer = false,
    optional = false,
    fix = false,
    depth = 0,
  } = options;

  try {
    const result = await analyzeDependencies({
      directory,
      showAll: false,
      ignorePatterns: Array.from(IGNORE_PATTERNS),
      json,
      builtins,
      dev,
      peer,
      optional,
      fix,
      depth,
    });

    // Convert missing dependencies to issues
    for (const dep of result.missingDependencies) {
      issues.push({
        file: "package.json",
        message: `missing dependency: ${dep}`,
        type: "missing-dependency",
      });
    }

    // Convert builtin modules to issues if they're used
    for (const dep of result.builtinModules) {
      issues.push({
        file: "package.json",
        message: `using builtin module: ${dep}`,
        type: "builtin-module",
      });
    }

    return {
      success: issues.length === 0,
      issues,
      stats: {
        filesChecked: result.allDependencies.length,
        importsChecked: result.allDependencies.length,
        timeElapsed: Date.now() - startTime,
      },
    };
  } catch (error) {
    throw new Error(
      `failed to check missing dependencies: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
