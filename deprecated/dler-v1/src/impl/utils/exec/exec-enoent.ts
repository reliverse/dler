import type { ChildProcess } from "node:child_process";

import type { ExecParseResult } from "./exec-types.js";

const isWin = process.platform === "win32";

export function notFoundError(
  original: { command: string; args: string[] },
  syscall: string,
): Error & { code: string; errno: string; syscall: string; path: string; spawnargs: string[] } {
  return Object.assign(new Error(`${syscall} ${original.command} ENOENT`), {
    code: "ENOENT",
    errno: "ENOENT",
    syscall: `${syscall} ${original.command}`,
    path: original.command,
    spawnargs: original.args,
  });
}

export function hookChildProcess(cp: ChildProcess, parsed: ExecParseResult): void {
  if (!isWin) return;
  const originalEmit = cp.emit;
  (cp.emit as any) = (name: string | symbol, ...args: any[]): boolean => {
    if (name === "exit") {
      const code = args[0] as number | null;
      const signal = args[1] as NodeJS.Signals | null;
      const err = verifyENOENT(code ?? 0, parsed);
      if (err) {
        return (originalEmit as any).apply(cp, ["error", err]);
      }
      return (originalEmit as any).apply(cp, ["exit", code, signal]);
    }
    return (originalEmit as any).apply(cp, [name, ...args]);
  };
}

export function verifyENOENT(status: number | null, parsed: ExecParseResult): Error | null {
  if (isWin && status === 1 && !parsed.file) {
    return notFoundError(parsed.original, "spawn");
  }
  return null;
}

export function verifyENOENTSync(status: number | null, parsed: ExecParseResult): Error | null {
  if (isWin && status === 1 && !parsed.file) {
    return notFoundError(parsed.original, "spawnSync");
  }
  return null;
}
