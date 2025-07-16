import type { ChildProcess, SpawnOptions } from "node:child_process";

export type { ChildProcess, SpawnOptions };

export interface ExecParseResult {
  command: string;
  args: string[];
  options: SpawnOptions;
  file?: string;
  original: {
    command: string;
    args: string[];
  };
}

export function _parse(file: string, args: string[], options?: SpawnOptions): ExecParseResult {
  return {
    command: file,
    args,
    options: options ?? {},
    file,
    original: { command: file, args },
  };
}
