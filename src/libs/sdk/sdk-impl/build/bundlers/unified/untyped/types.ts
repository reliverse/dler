import type { Schema } from "untyped";

import type {
  BaseBuildEntry,
  BuildContext,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/types.js";

export type UntypedBuildEntry = BaseBuildEntry & {
  builder: "untyped";
  defaults?: Record<string, any>;
};

export type UntypedHooks = {
  "untyped:done": (ctx: BuildContext) => Promise<void> | void;
  "untyped:entries": (
    ctx: BuildContext,
    entries: UntypedBuildEntry[],
  ) => Promise<void> | void;
  "untyped:entry:options": (
    ctx: BuildContext,
    entry: UntypedBuildEntry,
    options: any,
  ) => Promise<void> | void;
  "untyped:entry:outputs": (
    ctx: BuildContext,
    entry: UntypedBuildEntry,
    outputs: UntypedOutputs,
  ) => Promise<void> | void;
  "untyped:entry:schema": (
    ctx: BuildContext,
    entry: UntypedBuildEntry,
    schema: Schema,
  ) => Promise<void> | void;
};

export type UntypedOutput = {
  contents: string;
  fileName: string;
};

export type UntypedOutputs = {
  declaration?: UntypedOutput;
  defaults: UntypedOutput;
  markdown: UntypedOutput;
  schema: UntypedOutput;
};
