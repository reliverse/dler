import type { ChildProcess, ExecParseResult } from "./exec-types";

const isWin = process.platform === "win32";

function notFoundError(original: ExecParseResult, syscall: string) {
  return Object.assign(new Error(`${syscall} ${original.command} ENOENT`), {
    code: "ENOENT",
    errno: "ENOENT",
    syscall: `${syscall} ${original.command}`,
    path: original.command,
    spawnargs: original.args,
  });
}

function hookChildProcess(cp: ChildProcess, parsed: ExecParseResult) {
  if (!isWin) {
    return;
  }

  const originalEmit = cp.emit;

  cp.emit = (name: string, arg1: any) => {
    // If emitting "exit" event and exit code is 1, we need
    // to check if the command exists and emit an "error"
    if (name === "exit") {
      const err = verifyENOENT(arg1, parsed);

      if (err) {
        return originalEmit.call(cp, "error", err);
      }
    }

    return originalEmit.apply(cp, arguments);
  };
}

function verifyENOENT(status, parsed) {
  if (isWin && status === 1 && !parsed.file) {
    return notFoundError(parsed.original, "spawn");
  }

  return null;
}

function verifyENOENTSync(status, parsed) {
  if (isWin && status === 1 && !parsed.file) {
    return notFoundError(parsed.original, "spawnSync");
  }

  return null;
}

export default {
  hookChildProcess,
  verifyENOENT,
  verifyENOENTSync,
  notFoundError,
};
