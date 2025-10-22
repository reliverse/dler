// packages/launcher/src/impl/launcher/command.ts

import type { CmdArgsSchema, CmdCfg, CmdDefinition, ParsedArgs } from "./types";

export const defineCmdArgs = <const T extends CmdArgsSchema>(args: T): T =>
  args;

export const defineCmdCfg = <const T extends CmdCfg>(cfg: T): T => cfg;

export const defineCmd = <
  const Args extends CmdArgsSchema,
  const Cfg extends CmdCfg,
>(
  handler: (args: ParsedArgs<Args>) => Promise<void> | void,
  args: Args,
  cfg: Cfg,
): CmdDefinition<Args> => ({ handler, args, cfg });
