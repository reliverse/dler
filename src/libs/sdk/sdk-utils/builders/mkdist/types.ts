import type { MkdistOptions } from "mkdist";

import type {
  BuildContext,
  BaseBuildEntry,
} from "~/libs/sdk/sdk-utils/types.js";

type _BaseAndMkdist = BaseBuildEntry & MkdistOptions;
export type MkdistBuildEntry = {
  builder: "mkdist";
} & _BaseAndMkdist;

export type MkdistHooks = {
  "mkdist:entries": (
    ctx: BuildContext,
    entries: MkdistBuildEntry[],
  ) => void | Promise<void>;
  "mkdist:entry:options": (
    ctx: BuildContext,
    entry: MkdistBuildEntry,
    options: MkdistOptions,
  ) => void | Promise<void>;
  "mkdist:entry:build": (
    ctx: BuildContext,
    entry: MkdistBuildEntry,
    output: { writtenFiles: string[] },
  ) => void | Promise<void>;
  "mkdist:done": (ctx: BuildContext) => void | Promise<void>;
};
