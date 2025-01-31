import consola from "consola";
import { createJiti } from "jiti";
import { writeFile } from "node:fs/promises";
import { resolve } from "pathe";
import { pascalCase } from "scule";
import {
  resolveSchema,
  generateTypes,
  generateMarkdown,
  type InputObject,
} from "untyped";
import untypedPlugin from "untyped/babel-plugin";

import type {
  BuildContext,
  UntypedBuildEntry,
  UntypedOutputs,
} from "~/types.js";

export async function typesBuild(ctx: BuildContext): Promise<void> {
  const entries = ctx.options.entries.filter(
    (entry) => entry.builder === "untyped",
  ) as UntypedBuildEntry[];
  await ctx.hooks.callHook("untyped:entries", ctx, entries);

  for (const entry of entries) {
    const options = {
      jiti: {
        interopDefault: true,
        transformOptions: {
          babel: {
            plugins: [untypedPlugin],
          },
        },
      },
    };
    await ctx.hooks.callHook("untyped:entry:options", ctx, entry, options);

    const untypedJiti = createJiti(ctx.options.rootDir, options.jiti);

    const distDir = entry.outDir;

    let rawSchema: InputObject = (await untypedJiti.import(
      resolve(ctx.options.rootDir, entry.input),
      {
        try: true,
      },
    )) || { [Symbol.iterator]: undefined };

    const rawSchemaKeys = Object.keys(rawSchema);
    if (rawSchemaKeys.length === 1 && rawSchemaKeys[0] === "default") {
      rawSchema = (rawSchema as { default: InputObject }).default;
    }

    const defaults = entry.defaults || {};
    const schema = await resolveSchema(rawSchema, defaults);

    await ctx.hooks.callHook("untyped:entry:schema", ctx, entry, schema);

    // @ts-expect-error TODO: fix ts
    const outputs: UntypedOutputs = {
      markdown: {
        // @ts-expect-error TODO: fix ts
        fileName: resolve(distDir, `${entry.name}.md`),
        contents: generateMarkdown(schema),
      },
      schema: {
        fileName: `${entry.name}.schema.json`,
        contents: JSON.stringify(schema, null, 2),
      },
      defaults: {
        fileName: `${entry.name}.defaults.json`,
        contents: JSON.stringify(defaults, null, 2),
      },
      declaration: entry.declaration
        ? {
            fileName: `${entry.name}.d.ts`,
            contents: generateTypes(schema, {
              interfaceName: pascalCase(`${entry.name}-schema`),
            }),
          }
        : undefined,
    };
    await ctx.hooks.callHook("untyped:entry:outputs", ctx, entry, outputs);
    for (const output of Object.values(outputs)) {
      if (!output) continue; // declaration is optional
      await writeFile(
        // @ts-expect-error TODO: fix ts
        resolve(distDir, output.fileName),
        output.contents,
        "utf8",
      );
    }
  }
  await ctx.hooks.callHook("untyped:done", ctx);

  if (entries.length > 0 && ctx.options.watch) {
    consola.warn("`untyped` builder does not support watch mode yet.");
  }
}
