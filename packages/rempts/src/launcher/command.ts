// packages/launcher/src/impl/launcher/command.ts

import type {
  CmdArgsSchema,
  CmdDefinition,
  CmdHandler,
  CmdMeta,
} from "./types";

export const defineArgs = <const T extends CmdArgsSchema>(args: T): T => args;

export interface DefineCommandOptions<
  Args extends CmdArgsSchema,
  Meta extends CmdMeta,
> {
  meta: Meta;
  args: Args;
  run: CmdHandler<Args>;
}

export const defineCommand = <
  const Args extends CmdArgsSchema,
  const Meta extends CmdMeta,
>({
  meta,
  args,
  run,
}: DefineCommandOptions<Args, Meta>): CmdDefinition<Args> => ({
  handler: run,
  args,
  meta,
});
