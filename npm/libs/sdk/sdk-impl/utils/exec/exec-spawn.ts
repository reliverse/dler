import {
  type ChildProcess,
  spawn as nodeSpawn,
  spawnSync as nodeSpawnSync,
  type SpawnOptions,
  type SpawnSyncReturns,
} from "node:child_process";
import { hookChildProcess, verifyENOENTSync } from "./exec-enoent.js";
import { parse } from "./exec-parse.js";
import type { ExecParseResult } from "./exec-types.js";

export async function spawn(
  command: string,
  args?: string[],
  options?: SpawnOptions,
): Promise<ChildProcess> {
  const parsed: ExecParseResult = await parse(command, args, options);
  const spawned = nodeSpawn(parsed.command, parsed.args, parsed.options);
  hookChildProcess(spawned, parsed);
  return spawned;
}

export async function spawnSync(
  command: string,
  args?: string[],
  options?: SpawnOptions,
): Promise<SpawnSyncReturns<string | Buffer<ArrayBufferLike>>> {
  const parsed: ExecParseResult = await parse(command, args, options);
  const result = nodeSpawnSync(parsed.command, parsed.args, parsed.options);
  (result as any).error = (result as any).error || verifyENOENTSync(result.status, parsed);
  return result;
}
