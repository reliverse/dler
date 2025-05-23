import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { execa } from "execa";

//-------------------------------------
// Helper: Parse command string into command and arguments
//-------------------------------------
function parseCommand(command: string): { cmd: string; args: string[] } {
  const regex = /"([^"]+)"|'([^']+)'|(\S+)/g;
  const args: string[] = [];
  let match: RegExpExecArray | null;

  while (regex.exec(command) !== null) {
    match = regex.exec(command);
    if (match) {
      const value = match[1] ?? match[2] ?? match[3];
      if (value) {
        args.push(value);
      }
    }
  }

  const cmd = args.shift() ?? "";
  return { cmd, args };
}

//-------------------------------------
// Parse lines from a lines file
//-------------------------------------
async function parseLinesFile(linesFile: string) {
  const fileContents = await fs.readFile(linesFile, "utf-8");
  const splitted = fileContents.split(/\r?\n/);
  const results: { filePath: string; lineNumber: number }[] = [];

  for (const rawLine of splitted) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Could match "N  path.ts:line"
    const firstMatch = trimmed.match(/^(\d+)\s+(.+?):(\d+)$/);
    if (firstMatch?.[2] && firstMatch?.[3]) {
      results.push({
        filePath: firstMatch[2],
        lineNumber: Number.parseInt(firstMatch[3], 10),
      });
      continue;
    }

    // Or "path.ts:line"
    const secondMatch = trimmed.match(/^(.+?):(\d+)$/);
    if (secondMatch?.[1] && secondMatch?.[2]) {
      results.push({
        filePath: secondMatch[1],
        lineNumber: Number.parseInt(secondMatch[2], 10),
      });
    } else {
      relinka("warn", `Line doesn't match expected format: ${trimmed}`);
    }
  }
  return results;
}

//-------------------------------------
// Run tsc and parse errors
//-------------------------------------
async function runTscAndParseErrors(
  tscCommand: string,
  tscPaths?: string[],
): Promise<{ filePath: string; lineNumber: number }[]> {
  try {
    const { cmd, args: cmdArgs } = parseCommand(tscCommand);
    if (tscPaths?.length) {
      cmdArgs.push(...tscPaths);
    }

    const subprocess = await execa(cmd, cmdArgs, { all: true, reject: false });
    const combinedOutput = subprocess.all ?? "";
    return parseErrorOutput(combinedOutput);
  } catch (error) {
    if (error && typeof error === "object" && "all" in error) {
      const combined = (error.all as string) ?? "";
      if (!combined) {
        relinka("log", "TSC returned no error lines. Possibly no TS errors?");
        return [];
      }
      return parseErrorOutput(combined);
    }
    return [];
  }
}

function parseErrorOutput(
  output: string,
): { filePath: string; lineNumber: number }[] {
  const results: { filePath: string; lineNumber: number }[] = [];
  const splitted = output.split(/\r?\n/);
  const regex = /^(.+?)\((\d+),(\d+)\): error TS\d+: /;

  for (const line of splitted) {
    const match = line.trim().match(regex);
    if (match?.[1] && match?.[2]) {
      const file = match[1].replace(/\\/g, "/");
      const row = Number.parseInt(match[2], 10);
      if (row > 0) {
        results.push({ filePath: file, lineNumber: row });
      }
    }
  }

  return results;
}

//-------------------------------------
// Check if file is within directories
//-------------------------------------
function isWithin(filePath: string, dirs: string[]): boolean {
  const absFile = path.resolve(filePath);
  return dirs.some((dir) => {
    const absDir = path.resolve(dir);
    const normalizedDir = absDir.endsWith(path.sep)
      ? absDir
      : absDir + path.sep;
    return absFile.startsWith(normalizedDir);
  });
}

//-------------------------------------
// Inject comments into files
//-------------------------------------
async function injectCommentIntoFiles(
  linesRecords: { filePath: string; lineNumber: number }[],
  commentText: string,
) {
  const byFile = new Map<string, number[]>();
  for (const rec of linesRecords) {
    const lines = byFile.get(rec.filePath) ?? [];
    lines.push(rec.lineNumber);
    byFile.set(rec.filePath, lines);
  }

  for (const [filePath, lineNums] of byFile.entries()) {
    lineNums.sort((a, b) => b - a);
    const absPath = path.resolve(filePath);
    relinka(
      "log",
      `Injecting into ${absPath} at lines: ${lineNums.join(", ")}`,
    );

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
// Main function
//-------------------------------------
export async function useTsExpectError(args: {
  files: string[];
  comment?: string;
  tscPaths?: string[];
}) {
  const finalComment = args.comment ?? "// @ts-expect-error TODO: fix ts";
  const tscCommand = "tsc --project ./tsconfig.json --noEmit";

  const lines: { filePath: string; lineNumber: number }[] = [];
  const usedAuto = args.files.some((item) => item.toLowerCase() === "auto");

  if (usedAuto) {
    relinka("log", "Running TSC to discover error lines...");
    try {
      const discovered = await runTscAndParseErrors(tscCommand, args.tscPaths);
      if (args.tscPaths?.length) {
        const filtered = discovered.filter((rec) =>
          args.tscPaths ? isWithin(rec.filePath, args.tscPaths) : true,
        );
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
