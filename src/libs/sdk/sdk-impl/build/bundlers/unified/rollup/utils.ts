import type { PreRenderedChunk } from "rollup";

import type { BuildContext } from "~/libs/sdk/sdk-types";

export const DEFAULT_EXTENSIONS: string[] = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
  ".js",
  ".jsx",
  ".json",
];

export function getChunkFilename(ctx: BuildContext, chunk: PreRenderedChunk, ext: string): string {
  if (chunk.isDynamicEntry) {
    return `chunks/[name].${ext}`;
  }
  // TODO: Find a way to generate human friendly hash for short groups
  return `shared/${ctx.options.name}.[hash].${ext}`;
}

export function resolveAliases(ctx: BuildContext): Record<string, string> {
  const aliases: Record<string, string> = {
    ...(ctx.pkg.name ? { [ctx.pkg.name]: ctx.options.rootDir } : {}),
    ...ctx.options.alias,
  };

  if (ctx.options.rollup.alias) {
    if (Array.isArray(ctx.options.rollup.alias.entries)) {
      Object.assign(
        aliases,
        Object.fromEntries(
          ctx.options.rollup.alias.entries.map((entry) => {
            // @ts-expect-error TODO: fix (reset.d.ts)
            return [entry.find, entry.replacement];
          }),
        ),
      );
    } else {
      Object.assign(aliases, ctx.options.rollup.alias.entries || ctx.options.rollup.alias);
    }
  }

  return aliases;
}
