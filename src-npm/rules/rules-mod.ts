import { relinka } from "@reliverse/relinka";

import type { CheckResult } from "~/libs/sdk/sdk-impl/sdk-types";

// format check results
export function displayCheckResults(
  checkType: string,
  directory: string,
  result: CheckResult,
): void {
  const { success, issues, stats } = result;

  if (success) {
    relinka("success", `✓ ${checkType} check passed for ${directory}`);
    relinka(
      "info",
      `  files checked: ${stats.filesChecked}, imports: ${stats.importsChecked}, time: ${stats.timeElapsed}ms`,
    );
  } else {
    relinka("error", `✗ ${checkType} check failed for ${directory} (${issues.length} issues)`);

    // group issues by type
    const fileIssues = issues.filter((i) => i.type === "file-extension");
    const pathIssues = issues.filter((i) => i.type === "path-extension");
    const missingDepIssues = issues.filter((i) => i.type === "missing-dependency");
    const builtinIssues = issues.filter((i) => i.type === "builtin-module");
    const dlerConfigIssues = issues.filter((i) => i.type === "dler-config-health");
    const selfIncludeIssues = issues.filter((i) => i.type === "self-include");
    const noIndexIssues = issues.filter((i) => i.type === "no-index-files");

    if (fileIssues.length > 0) {
      relinka("error", `  file extension issues (${fileIssues.length}):`);
      for (const issue of fileIssues.slice(0, 10)) {
        relinka("error", `    ${issue.file}: ${issue.message}`);
      }
      if (fileIssues.length > 10) {
        relinka("error", `    ... and ${fileIssues.length - 10} more`);
      }
    }

    if (pathIssues.length > 0) {
      relinka("error", `  import extension issues (${pathIssues.length}):`);
      for (const issue of pathIssues.slice(0, 10)) {
        relinka("error", `    ${issue.file}:${issue.line}: ${issue.message}`);
      }
      if (pathIssues.length > 10) {
        relinka("error", `    ... and ${pathIssues.length - 10} more`);
      }
    }

    if (missingDepIssues.length > 0) {
      relinka("error", `  missing dependencies (${missingDepIssues.length}):`);
      for (const issue of missingDepIssues.slice(0, 10)) {
        relinka("error", `    ${issue.message}`);
      }
      if (missingDepIssues.length > 10) {
        relinka("error", `    ... and ${missingDepIssues.length - 10} more`);
      }
    }

    if (builtinIssues.length > 0) {
      relinka("warn", `  builtin modules used (${builtinIssues.length}):`);
      for (const issue of builtinIssues.slice(0, 10)) {
        relinka("warn", `    ${issue.message}`);
      }
      if (builtinIssues.length > 10) {
        relinka("warn", `    ... and ${builtinIssues.length - 10} more`);
      }
    }

    if (dlerConfigIssues.length > 0) {
      relinka("error", `  dler configuration issues (${dlerConfigIssues.length}):`);
      for (const issue of dlerConfigIssues.slice(0, 10)) {
        relinka("error", `    ${issue.message}`);
      }
      if (dlerConfigIssues.length > 10) {
        relinka("error", `    ... and ${dlerConfigIssues.length - 10} more`);
      }
    }

    if (selfIncludeIssues.length > 0) {
      relinka("error", `  self-include issues (${selfIncludeIssues.length}):`);
      for (const issue of selfIncludeIssues.slice(0, 10)) {
        relinka("error", `    ${issue.file}:${issue.line}: ${issue.message}`);
      }
      if (selfIncludeIssues.length > 10) {
        relinka("error", `    ... and ${selfIncludeIssues.length - 10} more`);
      }
    }

    if (noIndexIssues.length > 0) {
      relinka("error", `  index file issues (${noIndexIssues.length}):`);
      for (const issue of noIndexIssues.slice(0, 10)) {
        relinka("error", `    ${issue.file}: ${issue.message}`);
      }
      if (noIndexIssues.length > 10) {
        relinka("error", `    ... and ${noIndexIssues.length - 10} more`);
      }
    }

    relinka(
      "info",
      `  stats: ${stats.filesChecked} files, ${stats.importsChecked} imports, ${stats.timeElapsed}ms`,
    );
  }
}
