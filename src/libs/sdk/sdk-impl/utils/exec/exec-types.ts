import type { ChildProcess, SpawnOptions } from "node:child_process";

export type { ChildProcess, SpawnOptions };

export interface ExecParseResult {
  command: string;
  args: string[];
  options: SpawnOptions;
}

export function _parse(file: string, args: string[], options?: SpawnOptions): ExecParseResult {
  return {
    command: file,
    args,
    options: options ?? {},
  };
}
