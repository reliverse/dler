import type { MkdistOptions } from "mkdist";

import type {
  BaseBuildEntry,
  BuildContext,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/types.js";

export type MkdistBuildEntry = _BaseAndMkdist & {
  builder: "mkdist";
};
export type MkdistHooks = {
  "mkdist:done": (ctx: BuildContext) => Promise<void> | void;
  "mkdist:entries": (
    ctx: BuildContext,
    entries: MkdistBuildEntry[],
  ) => Promise<void> | void;
  "mkdist:entry:build": (
    ctx: BuildContext,
    entry: MkdistBuildEntry,
    output: { writtenFiles: string[] },
  ) => Promise<void> | void;
  "mkdist:entry:options": (
    ctx: BuildContext,
    entry: MkdistBuildEntry,
    options: MkdistOptions,
  ) => Promise<void> | void;
};

type _BaseAndMkdist = BaseBuildEntry & MkdistOptions;
