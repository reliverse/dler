import { createJiti } from "jiti";
import { writeFile } from "node:fs/promises";
import { resolve } from "pathe";
import { pascalCase } from "scule";
import {
  generateMarkdown,
  generateTypes,
  type InputObject,
  resolveSchema,
} from "untyped";
import untypedPlugin from "untyped/babel-plugin";

import type {
  BuildContext,
  UntypedBuildEntry,
  UntypedOutputs,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/types.js";

import { relinka } from "~/libs/sdk/sdk-impl/utils/utils-logs.js";

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

    let rawSchema =
      ((await untypedJiti.import(resolve(ctx.options.rootDir, entry.input), {
        try: true,
      }))) || ({} as InputObject);

    const rawSchemaKeys = Object.keys(rawSchema);
    if (rawSchemaKeys.length === 1 && rawSchemaKeys[0] === "default") {
      rawSchema = (rawSchema as any).default;
    }

    const defaults = entry.defaults || {};
    const schema = await resolveSchema(rawSchema, defaults);

    await ctx.hooks.callHook("untyped:entry:schema", ctx, entry, schema);

    const outputs: UntypedOutputs = {
      declaration: entry.declaration
        ? {
            contents: generateTypes(schema, {
              interfaceName: pascalCase(`${entry.name}-schema`),
            }),
            fileName: `${entry.name}.d.ts`,
          }
        : undefined,
      defaults: {
        contents: JSON.stringify(defaults, null, 2),
        fileName: `${entry.name}.defaults.json`,
      },
      markdown: {
        contents: generateMarkdown(schema),
        fileName: resolve(distDir, `${entry.name}.md`),
      },
      schema: {
        contents: JSON.stringify(schema, null, 2),
        fileName: `${entry.name}.schema.json`,
      },
    };
    await ctx.hooks.callHook("untyped:entry:outputs", ctx, entry, outputs);
    for (const output of Object.values(outputs)) {
      if (!output) continue; // declaration is optional
      await writeFile(
        resolve(distDir, output.fileName),
        output.contents,
        "utf8",
      );
    }
  }
  await ctx.hooks.callHook("untyped:done", ctx);

  if (entries.length > 0 && ctx.options.transpileWatch) {
    relinka(
      "warn",
      "`untyped` builder does not support transpileWatch mode yet.",
    );
  }
}
