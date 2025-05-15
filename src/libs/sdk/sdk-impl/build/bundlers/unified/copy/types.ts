// todo: merge with `jsr` bundler

import type {
  BaseBuildEntry,
  BuildContext,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/types.js";

export type CopyBuildEntry = BaseBuildEntry & {
  builder: "copy";
  pattern?: string | string[];
};

export type CopyHooks = {
  "copy:done": (ctx: BuildContext) => Promise<void> | void;
  "copy:entries": (
    ctx: BuildContext,
    entries: CopyBuildEntry[],
  ) => Promise<void> | void;
};
