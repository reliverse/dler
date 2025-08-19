import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import { createJiti, type JitiOptions } from "jiti";
import { pascalCase } from "scule";
import { generateMarkdown, generateTypes, type InputObject, resolveSchema } from "untyped";
import untypedPlugin from "untyped/babel-plugin";

import type { BuildContext, UntypedBuildEntry, UntypedOutputs } from "~/impl/types/mod";

export async function typesBuild(ctx: BuildContext): Promise<void> {
  const entries = ctx.options.entries.filter(
    (entry): entry is UntypedBuildEntry => entry.builder === "untyped",
  );

  if (entries.length === 0) {
    return; // No untyped entries to process
  }

  await ctx.hooks.callHook("untyped:entries", ctx, entries);

  for (const entry of entries) {
    try {
      // --- Entry Setup ---
      const distDir = entry.outDir;
      if (!distDir) {
        throw new Error(
          `[untyped] Missing 'outDir' for entry '${entry.name}'. Please define an output directory.`,
        );
      }

      const jitiOptions: JitiOptions = {
        interopDefault: true,
        transformOptions: {
          babel: {
            plugins: [untypedPlugin],
          },
        },
      };

      // Allow hooks to modify the jitiOptions object
      await ctx.hooks.callHook("untyped:entry:options", ctx, entry, jitiOptions);

      // Passing the modified jitiOptions object to createJiti
      const untypedJiti = createJiti(ctx.options.rootDir, jitiOptions);

      // --- Schema Loading ---
      const inputPath = resolve(ctx.options.rootDir, entry.input);
      let rawSchemaModule: unknown;
      try {
        rawSchemaModule = await untypedJiti.import(inputPath);
      } catch (importError: any) {
        console.warn(
          `[untyped] Failed to import schema for entry '${entry.name}' from ${inputPath}: ${importError.message}`,
        );
        rawSchemaModule = {}; // Fallback on import error
      }

      // Handle potential default export and ensure it's an object
      let rawSchema: InputObject;
      if (
        rawSchemaModule &&
        typeof rawSchemaModule === "object" &&
        "default" in rawSchemaModule &&
        // Check if the default export itself is the intended schema object
        typeof rawSchemaModule.default === "object" &&
        rawSchemaModule.default !== null
      ) {
        rawSchema = rawSchemaModule.default as InputObject;
      } else if (typeof rawSchemaModule === "object" && rawSchemaModule !== null) {
        rawSchema = rawSchemaModule as InputObject;
      } else {
        console.warn(
          `[untyped] Invalid schema input resolved for entry '${entry.name}' (path: ${entry.input}). Expected an object, got ${typeof rawSchemaModule}. Using empty schema.`,
        );
        rawSchema = {}; // Fallback to ensure it's an object for resolveSchema
      }

      // --- Schema Resolution ---
      const defaults: Record<string, any> = entry.defaults || {};
      const schema = await resolveSchema(rawSchema, defaults);

      await ctx.hooks.callHook("untyped:entry:schema", ctx, entry, schema);

      // --- Output Generation ---
      const outputs: UntypedOutputs = {
        declaration: entry.declaration
          ? {
              contents: generateTypes(schema, {
                interfaceName: pascalCase(`${entry.name}-schema`),
                // addDefaults: true, // TODO: Add JSDoc default values (allow to configure via relivereliverse.ts)
                // addDescription: true, // TODO: Add JSDoc descriptions (allow to configure via relivereliverse.ts)
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
          fileName: `${entry.name}.md`,
        },
        schema: {
          contents: JSON.stringify(schema, null, 2),
          fileName: `${entry.name}.schema.json`,
        },
      };

      await ctx.hooks.callHook("untyped:entry:outputs", ctx, entry, outputs);

      // --- File Writing ---
      await mkdir(distDir, { recursive: true });

      const writePromises: Promise<void>[] = []; // Collect file writing promises

      for (const output of Object.values(outputs)) {
        if (!output) continue;

        const fullOutputPath = resolve(distDir, output.fileName);
        // Use push to add the promise to the array
        writePromises.push(
          writeFile(fullOutputPath, output.contents, "utf8").catch((writeError: any) => {
            // Log write error but allow other writes to proceed
            console.error(
              `[untyped] Failed to write output file ${fullOutputPath} for entry '${entry.name}': ${writeError.message}`,
            );
          }),
        );
      }

      // Wait for all files for this entry to finish writing (or fail)
      await Promise.all(writePromises);

      relinka("verbose", `[untyped] Generated outputs for '${entry.name}' in ${distDir}`);
    } catch (error: any) {
      // Catch errors specific to processing this entry
      console.error(
        `[untyped] Failed to process entry '${entry.name}': ${error.message}`,
        error.stack,
      );
    }
  }

  await ctx.hooks.callHook("untyped:done", ctx);

  // Show warning about transpileWatch
  if (entries.length > 0 && ctx.options.transpileWatch) {
    relinka(
      "warn",
      "`untyped` builder does not support transpileWatch mode effectively (schema changes may require manual rebuild).",
    );
  }
}
