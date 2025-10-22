import path from "node:path";
import { escapeArgument, escapeCommand } from "./exec-escape.js";
import { resolveCommand } from "./exec-resolve.js";
import { readShebang } from "./exec-shebang.js";
import type { ExecParseResult } from "./exec-types.js";

const isWin = process.platform === "win32";
const isExecutableRegExp = /\.(?:com|exe)$/i;
const isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;

async function detectShebang(parsed: ExecParseResult): Promise<string | undefined> {
  parsed.file = await resolveCommand(parsed);
  if (parsed.file) {
    const shebang = readShebang(parsed.file);
    if (shebang) {
      parsed.args.unshift(parsed.file);
      parsed.command = shebang;
      return await resolveCommand(parsed);
    }
  }
  return parsed.file;
}

async function parseNonShell(parsed: ExecParseResult): Promise<ExecParseResult> {
  if (!isWin) return parsed;
  const commandFile = await detectShebang(parsed);
  const needsShell = !isExecutableRegExp.test(commandFile ?? "");
  if ((parsed.options as any).forceShell || needsShell) {
    const needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile ?? "");
    let cmd = path.normalize(parsed.command);
    cmd = escapeCommand(cmd);
    const args = parsed.args.map((arg) => escapeArgument(arg, needsDoubleEscapeMetaChars));
    const shellCommand = [cmd].concat(args).join(" ");
    parsed.args = ["/d", "/s", "/c", `"${shellCommand}"`];
    parsed.command = process.env.comspec || "cmd.exe";
    (parsed.options as any).windowsVerbatimArguments = true;
  }
  return parsed;
}

export async function parse(
  command: string,
  args?: string[] | any,
  options?: any,
): Promise<ExecParseResult> {
  // Debug logging
  console.log("DEBUG: parse function called with:", {
    command,
    args,
    options,
    commandType: typeof command,
    argsType: typeof args,
    isArgsArray: Array.isArray(args),
  });

  let actualArgs = args;
  let actualOptions = options;
  if (actualArgs && !Array.isArray(actualArgs)) {
    actualOptions = actualArgs;
    actualArgs = null;
  }
  actualArgs = actualArgs ? actualArgs.slice(0) : [];
  actualOptions = { ...actualOptions };
  const parsed: ExecParseResult = {
    command,
    args: actualArgs,
    options: actualOptions,
    file: undefined,
    original: {
      command,
      args: actualArgs,
    },
  };

  console.log("DEBUG: parse function returning:", {
    command: parsed.command,
    args: parsed.args,
    commandType: typeof parsed.command,
    argsType: typeof parsed.args,
    isArgsArray: Array.isArray(parsed.args),
  });

  return actualOptions.shell ? parsed : await parseNonShell(parsed);
}
