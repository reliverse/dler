import type {
  BaseBuildEntry,
  BuildContext,
} from "~/libs/sdk/sdk-utils/types.js";

export type CopyBuildEntry = {
  builder: "copy";
  pattern?: string | string[];
} & BaseBuildEntry;

export type CopyHooks = {
  "copy:entries": (
    ctx: BuildContext,
    entries: CopyBuildEntry[],
  ) => void | Promise<void>;
  "copy:done": (ctx: BuildContext) => void | Promise<void>;
};
