import { loadConfig } from "c12";
import fs from "fs-extra";
import path from "pathe";
import { execa } from "execa";
import { relinka } from "@reliverse/prompts";

//-------------------------------------
// 1) c12 config interface
//-------------------------------------
interface ReinjectUserConfig {
  // The comment to inject above each error line
  injectComment?: string;
  // The command used to spawn tsc (e.g. "tsc --noEmit --project tsconfig.json")
  tscCommand?: string;
}

//-------------------------------------
// 2) Load c12 configs
//-------------------------------------
async function loadReinjectConfig(): Promise<ReinjectUserConfig> {
  const { config } = await loadConfig<ReinjectUserConfig>({
    name: "reinject", // tries reinject.config.*, .reinjectrc, etc.
    defaults: {},
    overrides: {},
    dotenv: false,
    packageJson: false,
  });

  return {
    injectComment: config.injectComment ?? "// @ts-expect-error TODO: fix ts",
    tscCommand: config.tscCommand ?? "tsc --noEmit",
  };
}

//-------------------------------------
// Helper: Parse command string into command and arguments
//-------------------------------------
function parseCommand(command: string): { cmd: string, args: string[] } {
  // This parser splits the command by whitespace while handling double or single quotes.
  const regex = /"([^"]+)"|'([^']+)'|(\S+)/g;
  const args: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(command)) !== null) {
    args.push(match[1] || match[2] || match[3]);
  }
  const cmd = args.shift() || "";
  return { cmd, args };
}

//-------------------------------------
// 3) parseLineRefs from a lines file
//-------------------------------------
async function parseLinesFile(linesFile: string) {
  const fileContents = await fs.readFile(linesFile, "utf-8");
  const splitted = fileContents.split(/\r?\n/);
  const results: { filePath: string; lineNumber: number }[] = [];

  for (const rawLine of splitted) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Could match "N  path.ts:line"
    let match = trimmed.match(/^(\d+)\s+(.+?):(\d+)$/);
    if (match) {
      results.push({
        filePath: match[2],
        lineNumber: parseInt(match[3], 10),
      });
      continue;
    }

    // Or "path.ts:line"
    match = trimmed.match(/^(.+?):(\d+)$/);
    if (match) {
      results.push({
        filePath: match[1],
        lineNumber: parseInt(match[2], 10),
      });
    } else {
      relinka("warn", `Line doesn't match expected format: ${trimmed}`);
    }
  }
  return results;
}

//-------------------------------------
// 4) runTscAndParseErrors: run tsc with execa, parse error lines
// Example TSC error line format:
//   src/foo.ts(12,5): error TS2322:
// We'll capture `src/foo.ts` and `12` as the error line number
//-------------------------------------
async function runTscAndParseErrors(tscCommand: string, tscPaths?: string[]): Promise<Array<{ filePath: string; lineNumber: number }>> {
  let linesRefs: Array<{ filePath: string; lineNumber: number }> = [];

  try {
    // Parse the TSC command into the command and its arguments.
    const { cmd, args: cmdArgs } = parseCommand(tscCommand);
    // Append any additional paths (if provided) as extra arguments.
    if (tscPaths && tscPaths.length > 0) {
      cmdArgs.push(...tscPaths);
    }

    // Run TSC.
    const subprocess = await execa(cmd, cmdArgs, { all: true, reject: false });
    const combinedOutput = subprocess.all || "";
    const splitted = combinedOutput.split(/\r?\n/);
    const regex = /^(.+?)\((\d+),(\d+)\): error TS\d+: /;

    for (const line of splitted) {
      const trimmed = line.trim();
      const m = trimmed.match(regex);
      if (m) {
        let file = m[1];
        const row = parseInt(m[2], 10);
        if (row > 0) {
          // Normalize Windows paths.
          file = file.replace(/\\/g, "/");
          linesRefs.push({
            filePath: file,
            lineNumber: row,
          });
        }
      }
    }
  } catch (error: any) {
    // In case of error, try to extract the output.
    const combined = (error.all as string) || "";
    if (!combined) {
      relinka("info", `TSC returned no error lines. Possibly no TS errors?`);
      return [];
    }

    const splitted = combined.split(/\r?\n/);
    const regex = /^(.+?)\((\d+),(\d+)\): error TS\d+: /;

    for (const line of splitted) {
      const m = line.trim().match(regex);
      if (m) {
        let file = m[1];
        const row = parseInt(m[2], 10);
        if (row > 0) {
          file = file.replace(/\\/g, "/");
          linesRefs.push({ filePath: file, lineNumber: row });
        }
      }
    }
  }

  return linesRefs;
}

//-------------------------------------
// Helper: Check if file is within any of the provided directories
//-------------------------------------
function isWithin(filePath: string, dirs: string[]): boolean {
  const absFile = path.resolve(filePath);
  for (const dir of dirs) {
    const absDir = path.resolve(dir);
    // Ensure trailing separator for accurate prefix matching
    const normalizedDir = absDir.endsWith(path.sep) ? absDir : absDir + path.sep;
    if (absFile.startsWith(normalizedDir)) {
      return true;
    }
  }
  return false;
}

//-------------------------------------
// 5) The injection logic
//-------------------------------------
async function injectCommentIntoFiles(
  linesRecords: Array<{ filePath: string; lineNumber: number }>,
  commentText: string,
) {
  // Group error lines by file
  const byFile = new Map<string, number[]>();
  for (const rec of linesRecords) {
    if (!byFile.has(rec.filePath)) {
      byFile.set(rec.filePath, []);
    }
    byFile.get(rec.filePath)!.push(rec.lineNumber);
  }

  for (const [filePath, lineNums] of byFile.entries()) {
    // Sort descending so injections don't affect subsequent line numbers
    lineNums.sort((a, b) => b - a);
    const absPath = path.resolve(filePath);
    relinka("info", `Injecting into ${absPath} at lines: ${lineNums.join(", ")}`);

    try {
      const original = await fs.readFile(absPath, "utf-8");
      const splitted = original.split(/\r?\n/);
      for (const ln of lineNums) {
        if (ln <= splitted.length) {
          splitted.splice(ln - 1, 0, commentText);
        } else {
          relinka("warn", `Line ${ln} exceeds file length for ${absPath}`);
        }
      }
      const newContent = splitted.join("\n");
      await fs.writeFile(absPath, newContent, "utf-8");
    } catch (error) {
      relinka("error", `Failed editing ${filePath}: ${error}`);
    }
  }
}

//-------------------------------------
// 6) The main usage function
//-------------------------------------
export async function useTsExpectError(args: { files: string[], comment?: string, tscPaths?: string[] }) {
  // 1) load c12 config
  const userConfig = await loadReinjectConfig();
  const finalComment = args.comment || userConfig.injectComment!;

  // Gather references
  const lines: Array<{ filePath: string; lineNumber: number }> = [];
  let usedAuto = false;
  for (const item of args.files) {
    if (item.toLowerCase() === "auto") {
      usedAuto = true;
    }
  }

  if (usedAuto) {
    relinka("info", "Running TSC to discover error lines...");
    const tscCommand = userConfig.tscCommand!;
    try {
      const discovered = await runTscAndParseErrors(tscCommand, args.tscPaths);
      // If tscPaths are provided, filter discovered errors to include only files within those paths.
      if (args.tscPaths && args.tscPaths.length > 0) {
        const filtered = discovered.filter(rec => isWithin(rec.filePath, args.tscPaths!));
        lines.push(...filtered);
      } else {
        lines.push(...discovered);
      }
    } catch (error) {
      relinka("error", `Failed running tsc: ${error}`);
      process.exit(1);
    }
  }

  // Parse lines from each file that isn't "auto"
  for (const item of args.files) {
    if (item.toLowerCase() === "auto") continue;

    try {
      const recs = await parseLinesFile(item);
      lines.push(...recs);
    } catch (error) {
      relinka("error", `Failed reading lines file ${item}: ${error}`);
    }
  }

  if (lines.length === 0) {
    relinka("error", "No references found. Nothing to do.");
    relinka("error", "Lines: ", JSON.stringify(lines));
    process.exit(1);
  }

  await injectCommentIntoFiles(lines, finalComment);
  relinka("success", "All lines processed successfully.");
}
