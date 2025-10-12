import { extname, relative } from "@reliverse/pathkit";
import { createFilter } from "@rollup/pluginutils";
import type { Loader, TransformResult } from "esbuild";
import { transform } from "esbuild";
import type { Plugin, PluginContext } from "rollup";

import type { EsbuildOptions } from "~/impl/types/mod";

const DefaultLoaders: Record<string, Loader> = {
  ".cjs": "js",
  ".cts": "ts",
  ".js": "js",
  ".jsx": "jsx",
  ".mjs": "js",
  ".mts": "ts",
  ".ts": "ts",
  // ".tsx": "tsx", // todo: introduce new option in dler config which allows to enable/disable transpiling other extensions that .ts and .js (disabling is especially useful for bootstrapping projects clis like @reliverse/rse)
};

export function esbuild(options: EsbuildOptions): Plugin {
  // Extract esBuild options from additional options and apply defaults
  const {
    exclude = /node_modules/,
    include = new RegExp(Object.keys(DefaultLoaders).join("|")),
    loaders: loaderOptions,
    ...transpileEsbuildOptions
  } = options;

  // Rsolve loaders
  const loaders = { ...DefaultLoaders };
  if (loaderOptions) {
    for (const [key, value] of Object.entries(loaderOptions)) {
      if (typeof value === "string") {
        loaders[key] = value;
      } else if (value === false) {
        delete loaders[key];
      }
    }
  }
  const getLoader = (id = ""): Loader | undefined => {
    return loaders[extname(id)];
  };

  const filter = createFilter(include, exclude);

  return {
    name: "transpileEsbuild",

    async renderChunk(code, { fileName }): Promise<null | undefined | { code: string; map: any }> {
      if (!options.minify) {
        return null;
      }
      if (/\.d\.(c|m)?tsx?$/.test(fileName)) {
        return null;
      }
      const loader = getLoader(fileName);
      if (!loader) {
        return null;
      }
      const result = await transform(code, {
        ...transpileEsbuildOptions,
        loader,
        minify: true,
        sourcefile: fileName,
      });
      return {
        code: result.code || "",
        map: result.map || null,
      };
    },

    async transform(code, id): Promise<null | { code: string; map: any }> {
      if (!filter(id)) {
        return null;
      }

      const loader = getLoader(id);
      if (!loader) {
        return null;
      }

      const result = await transform(code, {
        ...transpileEsbuildOptions,
        loader,
        sourcefile: id,
      });

      printWarnings(id, result, this);

      return {
        code: result.code || "",
        map: result.map || null,
      };
    },
  };
}

function printWarnings(id: string, result: TransformResult, plugin: PluginContext): void {
  if (result.warnings) {
    for (const warning of result.warnings) {
      let message = "[transpileEsbuild]";
      if (warning.location) {
        message += ` (${relative(process.cwd(), id)}:${warning.location.line}:${
          warning.location.column
        })`;
      }
      message += ` ${warning.text}`;
      plugin.warn(message);
    }
  }
}

// Based on https://github.com/egoist/rollup-plugin-transpileEsbuild and nitropack fork (MIT)
