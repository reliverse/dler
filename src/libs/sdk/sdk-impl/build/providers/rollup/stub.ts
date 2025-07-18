import { basename, dirname, extname, relative, resolve } from "@reliverse/pathkit";
import { fileURLToPath, resolveModuleExportNames, resolvePath } from "mlly";
import { promises as fsp } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import type { BuildContext } from "~/libs/sdk/sdk-impl/sdk-types";

import { warn } from "~/libs/sdk/sdk-impl/build/providers/utils";

import { getShebang, makeExecutable } from "./plugins/shebang";
import { DEFAULT_EXTENSIONS, resolveAliases } from "./utils";

export async function rollupStub(ctx: BuildContext): Promise<void> {
  const babelPlugins = ctx.options.transpileStubOptions.jiti.transformOptions?.babel?.plugins;
  const importedBabelPlugins: string[] = [];
  const serializedJitiOptions = JSON.stringify(
    {
      ...ctx.options.transpileStubOptions.jiti,
      alias: {
        ...resolveAliases(ctx),
        ...ctx.options.transpileStubOptions.jiti.alias,
      },
      transformOptions: {
        ...ctx.options.transpileStubOptions.jiti.transformOptions,
        babel: {
          ...ctx.options.transpileStubOptions.jiti.transformOptions?.babel,
          plugins: "__$BABEL_PLUGINS",
        },
      },
    },
    null,
    2,
  ).replace(
    '"__$BABEL_PLUGINS"',
    Array.isArray(babelPlugins)
      ? `[${babelPlugins
          // @ts-expect-error TODO: fix (reset.d.ts)
          .map((plugin: any[] | string, i) => {
            if (Array.isArray(plugin)) {
              const [name, ...args] = plugin;
              // @ts-expect-error TODO: fix (reset.d.ts)
              importedBabelPlugins.push(name);
              return `[${[`plugin${i}`, ...args.map((val) => JSON.stringify(val))].join(", ")}]`;
            }
            // @ts-expect-error TODO: fix (reset.d.ts)
            importedBabelPlugins.push(plugin);
            return `plugin${i}`;
          })
          .join(",")}]`
      : "[]",
  );

  for (const entry of ctx.options.entries.filter((entry) => entry.builder === "rollup")) {
    const output = resolve(
      ctx.options.rootDir,
      ctx.options.outDir,
      entry.name || basename(entry.input, extname(entry.input)),
    );

    const isESM = ctx.pkg.type === "module";
    const resolvedEntry = fileURLToPath(ctx.jiti.esmResolve(entry.input));
    const resolvedEntryWithoutExt = resolvedEntry.slice(
      0,
      Math.max(0, resolvedEntry.length - extname(resolvedEntry).length),
    );
    const resolvedEntryForTypeImport = isESM
      ? resolvedEntry.replace(/(\.m?)(ts)$/, "$1js")
      : resolvedEntryWithoutExt;
    const code = await fsp.readFile(resolvedEntry, "utf8");
    const shebang = getShebang(code);

    await mkdir(dirname(output), { recursive: true });

    // CJS Stub
    if (ctx.options.rollup.emitCJS) {
      const jitiCJSPath = relative(
        dirname(output),
        await resolvePath("jiti", {
          conditions: ["node", "require"],
          url: import.meta.url,
        }),
      );
      await writeFile(
        `${output}.cjs`,
        shebang +
          [
            `const { createJiti } = require(${JSON.stringify(jitiCJSPath)})`,
            ...importedBabelPlugins.map(
              (plugin, i) => `const plugin${i} = require(${JSON.stringify(plugin)})`,
            ),
            "",
            `const jiti = createJiti(__filename, ${serializedJitiOptions})`,
            "",
            `/** @type {import(${JSON.stringify(resolvedEntryForTypeImport)})} */`,
            `module.exports = jiti(${JSON.stringify(resolvedEntry)})`,
          ].join("\n"),
      );
    }

    // MJS Stub
    // Try to analyze exports
    const namedExports: string[] = await resolveModuleExportNames(resolvedEntry, {
      extensions: DEFAULT_EXTENSIONS,
    }).catch((error) => {
      warn(ctx, `Cannot analyze ${resolvedEntry} for exports:${error}`);
      return [];
    });
    const hasDefaultExport = namedExports.includes("default") || namedExports.length === 0;

    const jitiESMPath = relative(
      dirname(output),
      await resolvePath("jiti", {
        conditions: ["node", "import"],
        url: import.meta.url,
      }),
    );

    await writeFile(
      `${output}.mjs`,
      shebang +
        [
          `import { createJiti } from ${JSON.stringify(jitiESMPath)};`,
          ...importedBabelPlugins.map(
            (plugin, i) => `import plugin${i} from ${JSON.stringify(plugin)}`,
          ),
          "",
          `const jiti = createJiti(import.meta.url, ${serializedJitiOptions})`,
          "",
          `/** @type {import(${JSON.stringify(resolvedEntryForTypeImport)})} */`,
          `const _module = await jiti.import(${JSON.stringify(resolvedEntry)});`,
          hasDefaultExport ? "\nexport default _module?.default ?? _module;" : "",
          ...namedExports
            .filter((name) => name !== "default")
            .map((name) => `export const ${name} = _module.${name};`),
        ].join("\n"),
    );

    // DTS Stub
    if (ctx.options.declaration) {
      const dtsContent = [
        `export * from ${JSON.stringify(resolvedEntryForTypeImport)};`,
        hasDefaultExport
          ? `export { default } from ${JSON.stringify(resolvedEntryForTypeImport)};`
          : "",
      ].join("\n");
      await writeFile(`${output}.d.cts`, dtsContent);
      await writeFile(`${output}.d.mts`, dtsContent);
      if (ctx.options.declaration === "compatible" || ctx.options.declaration === true) {
        await writeFile(`${output}.d.ts`, dtsContent);
      }
    }

    if (shebang) {
      await makeExecutable(`${output}.cjs`);
      await makeExecutable(`${output}.mjs`);
    }
  }
}
