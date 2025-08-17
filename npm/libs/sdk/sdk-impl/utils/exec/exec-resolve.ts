import path from "node:path";
import { lookpath } from "lookpath";
import getPathKey from "path-key";

import type { ExecParseResult } from "./exec-types.js";

async function resolveCommandAttempt(
  parsed: ExecParseResult,
  withoutPathExt?: boolean,
): Promise<string | undefined> {
  const env = parsed.options.env || process.env;
  const cwd = process.cwd();
  const hasCustomCwd = parsed.options.cwd != null;
  const shouldSwitchCwd =
    hasCustomCwd && typeof process.chdir === "function" && !(process.chdir as any).disabled;
  if (shouldSwitchCwd) {
    try {
      process.chdir(String(parsed.options.cwd ?? cwd));
    } catch {
      // Ignore error, we'll try to resolve the command later
    }
  }
  let resolved: string | undefined;
  try {
    const pathEnv = env[getPathKey({ env })];
    const lookpathOptions: Record<string, unknown> = {
      path: pathEnv?.split(path.delimiter),
      include: withoutPathExt ? [] : undefined,
    };
    resolved = await lookpath(parsed.command, lookpathOptions);
  } catch {
    // Ignore error
  } finally {
    if (shouldSwitchCwd) {
      process.chdir(cwd);
    }
  }
  if (resolved) {
    resolved = path.resolve(
      hasCustomCwd ? String(parsed.options.cwd ?? cwd) : cwd,
      typeof resolved === "string" ? resolved : String(resolved),
    );
  }
  return resolved;
}

export async function resolveCommand(parsed: ExecParseResult): Promise<string | undefined> {
  return (await resolveCommandAttempt(parsed)) || (await resolveCommandAttempt(parsed, true));
}
