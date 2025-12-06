// apps/dler/src/cmds/biome/impl.ts

import { resolve } from "node:path";
import { logger } from "@reliverse/relinka";
import clipboard from "clipboardy";

// ============================================================================
// Types
// ============================================================================

interface BiomeDiagnostic {
  file: string;
  line: number;
  column: number;
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
}

interface BiomeResult {
  success: boolean;
  errors: number;
  warnings: number;
  infos: number;
  diagnostics: BiomeDiagnostic[];
  rawOutput: string;
  filteredOutput: string;
  executionTime: number;
}

interface BiomeOptions {
  verbose?: boolean;
  copyLogs?: boolean;
  cwd?: string;
}

// ============================================================================
// Biome Execution
// ============================================================================

const runBiomeCommand = async (
  cwd: string,
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> => {
  try {
    const proc = Bun.spawn(["bun", "biome", "check", "--write", "--unsafe"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exited;

    return { stdout, stderr, exitCode };
  } catch (error) {
    throw new Error(
      `Failed to spawn biome: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

// ============================================================================
// Output Parsing
// ============================================================================

const parseBiomeOutput = (
  output: string,
  cwd: string,
): {
  diagnostics: BiomeDiagnostic[];
  errors: number;
  warnings: number;
  infos: number;
} => {
  const lines = output.split("\n");
  const diagnostics: BiomeDiagnostic[] = [];
  let currentDiagnostic: Partial<BiomeDiagnostic> | null = null;
  let inDiagnostic = false;
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  // Regex patterns for biome output
  // Matches: filepath:line:col rule ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const fileLinePattern = /^(.+?):(\d+):(\d+)\s+(.+?)\s+━+$/;
  const errorPattern = /^\s+×\s+(.+)$/;
  const infoPattern = /^\s+i\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Match file path with rule name
    const fileMatch = line.match(fileLinePattern);
    if (fileMatch) {
      // Save previous diagnostic if exists
      if (currentDiagnostic?.file) {
        diagnostics.push(currentDiagnostic as BiomeDiagnostic);
        if (currentDiagnostic.severity === "error") errors++;
        else if (currentDiagnostic.severity === "warning") warnings++;
        else if (currentDiagnostic.severity === "info") infos++;
      }

      const file = fileMatch[1];
      const lineNum = fileMatch[2];
      const col = fileMatch[3];
      const rule = fileMatch[4];

      if (file && lineNum && col && rule) {
        // Normalize file path (handle both Windows and Unix paths)
        const normalizedFile = file.replace(/\\/g, "/");
        currentDiagnostic = {
          file: resolve(cwd, normalizedFile),
          line: Number.parseInt(lineNum, 10),
          column: Number.parseInt(col, 10),
          rule: rule.trim(),
          severity: "error", // Default, will be updated if we see warning/info
          message: "",
        };
        inDiagnostic = true;
      }
      continue;
    }

    if (!inDiagnostic || !currentDiagnostic) continue;

    // Match error message (×)
    const errorMatch = line.match(errorPattern);
    if (errorMatch) {
      currentDiagnostic.message = errorMatch[1]?.trim();
      currentDiagnostic.severity = "error";
      continue;
    }

    // Match info message (i)
    const infoMatch = line.match(infoPattern);
    if (infoMatch) {
      currentDiagnostic.suggestion = infoMatch[1]?.trim();
      // If we see info but no error message yet, it might be a warning/info
      if (!currentDiagnostic.message) {
        currentDiagnostic.severity = "info";
      }
      continue;
    }

    // Check if we're leaving the diagnostic block (empty line or new diagnostic)
    if (line.trim() === "" && currentDiagnostic.message) {
      inDiagnostic = false;
    }
  }

  // Save last diagnostic
  if (currentDiagnostic?.file) {
    diagnostics.push(currentDiagnostic as BiomeDiagnostic);
    if (currentDiagnostic.severity === "error") errors++;
    else if (currentDiagnostic.severity === "warning") warnings++;
    else if (currentDiagnostic.severity === "info") infos++;
  }

  // Also try to extract counts from summary line if available
  const summaryMatch = output.match(/Found (\d+) errors?/i);
  const errorCount = summaryMatch?.[1];
  if (errorCount) {
    const totalErrors = Number.parseInt(errorCount, 10);
    // Adjust counts if summary has more accurate count
    if (totalErrors > errors) {
      errors = totalErrors;
    }
  }

  return { diagnostics, errors, warnings, infos };
};

// ============================================================================
// Output Formatting
// ============================================================================

const formatDiagnostic = (diag: BiomeDiagnostic, cwd: string): string => {
  // Normalize paths for consistent output
  const normalizedCwd = cwd.replace(/\\/g, "/");
  const normalizedFile = diag.file.replace(/\\/g, "/");
  const relativePath = normalizedFile.replace(`${normalizedCwd}/`, "");
  const rulePart = diag.rule ? ` [${diag.rule}]` : "";
  const suggestionPart = diag.suggestion ? `\n   i ${diag.suggestion}` : "";

  return `${relativePath}:${diag.line}:${diag.column}${rulePart}\n   × ${diag.message}${suggestionPart}`;
};

const formatFilteredOutput = (
  diagnostics: BiomeDiagnostic[],
  cwd: string,
): string => {
  const lines: string[] = [];

  // Group by rule
  const byRule = new Map<string, BiomeDiagnostic[]>();
  for (const diag of diagnostics) {
    const rule = diag.rule || "unknown";
    const existing = byRule.get(rule) ?? [];
    existing.push(diag);
    byRule.set(rule, existing);
  }

  // Format each rule's diagnostics
  for (const ruleDiags of byRule.values()) {
    for (const diag of ruleDiags) {
      lines.push(formatDiagnostic(diag, cwd));
      lines.push(""); // Empty line between diagnostics
    }
  }

  return lines.join("\n");
};

// ============================================================================
// Clipboard Functionality
// ============================================================================

const collectBiomeLogs = (result: BiomeResult, cwd: string): string => {
  if (result.diagnostics.length === 0) {
    return "";
  }

  const logs: string[] = [];
  logs.push(
    "I received the following Biome errors/warnings (please analyse the related code for each and correct them):",
  );
  logs.push("```");
  logs.push("Biome Check (bun dler biome)");
  logs.push("");

  // Group by rule
  const byRule = new Map<string, BiomeDiagnostic[]>();
  const normalizedCwd = cwd.replace(/\\/g, "/");
  for (const diag of result.diagnostics) {
    const rule = diag.rule || "unknown";
    const existing = byRule.get(rule) ?? [];
    existing.push(diag);
    byRule.set(rule, existing);
  }

  for (const [rule, ruleDiags] of byRule) {
    logs.push(
      `🔍 ${rule} (${ruleDiags.length} occurrence${ruleDiags.length > 1 ? "s" : ""})`,
    );
    logs.push(`   ${"─".repeat(30)}`);

    // Show rule description once (from first diagnostic)
    const firstDiag = ruleDiags[0];
    if (firstDiag) {
      logs.push(`   × ${firstDiag.message}`);
      if (firstDiag.suggestion) {
        logs.push(`   i ${firstDiag.suggestion}`);
      }
      logs.push("");
    }

    // List all file locations
    for (const diag of ruleDiags) {
      const normalizedFile = diag.file.replace(/\\/g, "/");
      const relativePath = normalizedFile.replace(`${normalizedCwd}/`, "");
      logs.push(`   ${relativePath}:${diag.line}:${diag.column}`);
    }
    logs.push("");
  }

  logs.push("```");
  return logs.join("\n");
};

const copyLogsToClipboard = async (
  result: BiomeResult,
  cwd: string,
): Promise<void> => {
  try {
    const logs = collectBiomeLogs(result, cwd);

    if (!logs) {
      logger.info("ℹ️  No diagnostics to copy to clipboard");
      return;
    }

    await clipboard.write(logs);
    logger.success("📋 Biome diagnostics copied to clipboard!");
  } catch (error) {
    logger.error("❌ Failed to copy logs to clipboard:");
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error(String(error));
    }
  }
};

// ============================================================================
// Output Display
// ============================================================================

const formatOutput = (result: BiomeResult, cwd: string): void => {
  // Summary header
  logger.log("━".repeat(60));
  logger.log(`📊 Biome Check Summary:`);
  logger.log(`   🐛 Total errors: ${result.errors}`);
  logger.log(`   ⚠️  Total warnings: ${result.warnings}`);
  logger.log(`   ℹ️  Total infos: ${result.infos}`);
  logger.log(`   ⏱️  Execution time: ${result.executionTime}ms`);
  logger.log("━".repeat(60));

  if (result.diagnostics.length > 0) {
    logger.error("\n❌ Diagnostics:\n");

    // Group by rule
    const byRule = new Map<string, BiomeDiagnostic[]>();
    const normalizedCwd = cwd.replace(/\\/g, "/");
    for (const diag of result.diagnostics) {
      const rule = diag.rule || "unknown";
      const existing = byRule.get(rule) ?? [];
      existing.push(diag);
      byRule.set(rule, existing);
    }

    for (const [rule, ruleDiags] of byRule) {
      logger.error(
        `🔍 ${rule} (${ruleDiags.length} occurrence${ruleDiags.length > 1 ? "s" : ""})`,
      );
      logger.error(`   ${"─".repeat(30)}`);

      // Show rule description once (from first diagnostic)
      const firstDiag = ruleDiags[0];
      if (firstDiag) {
        const severityIcon =
          firstDiag.severity === "error"
            ? "×"
            : firstDiag.severity === "warning"
              ? "⚠"
              : "ℹ";
        logger.error(`   ${severityIcon} ${firstDiag.message}`);
        if (firstDiag.suggestion) {
          logger.info(`   i ${firstDiag.suggestion}`);
        }
        logger.error("");
      }

      // List all file locations
      for (const diag of ruleDiags) {
        const normalizedFile = diag.file.replace(/\\/g, "/");
        const relativePath = normalizedFile.replace(`${normalizedCwd}/`, "");
        logger.error(`   ${relativePath}:${diag.line}:${diag.column}`);
      }
      logger.error("");
    }
  }
};

// ============================================================================
// Main Entry Point
// ============================================================================

export const runBiomeCheck = async (
  options: BiomeOptions = {},
): Promise<BiomeResult> => {
  const { verbose = false, copyLogs = false, cwd = process.cwd() } = options;
  const startTime = Date.now();

  const resolvedCwd = resolve(cwd);

  if (verbose) {
    logger.info(`🔍 Running biome check in: ${resolvedCwd}`);
  }

  try {
    const { stdout, stderr } = await runBiomeCommand(resolvedCwd);
    const output = stdout + stderr;

    const { diagnostics, errors, warnings, infos } = parseBiomeOutput(
      output,
      resolvedCwd,
    );

    const filteredOutput = formatFilteredOutput(diagnostics, resolvedCwd);

    const result: BiomeResult = {
      success: errors === 0,
      errors,
      warnings,
      infos,
      diagnostics,
      rawOutput: output,
      filteredOutput,
      executionTime: Date.now() - startTime,
    };

    // Display results
    formatOutput(result, resolvedCwd);

    // Copy logs to clipboard if requested and there are diagnostics
    if (copyLogs && result.diagnostics.length > 0) {
      await copyLogsToClipboard(result, resolvedCwd);
    }

    return result;
  } catch (error) {
    logger.error(
      `❌ Failed to run biome: ${error instanceof Error ? error.message : String(error)}`,
    );

    return {
      success: false,
      errors: 1,
      warnings: 0,
      infos: 0,
      diagnostics: [],
      rawOutput: error instanceof Error ? error.message : String(error),
      filteredOutput: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime,
    };
  }
};
