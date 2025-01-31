import type { FilterPattern } from "@rollup/pluginutils";
import type { Plugin } from "rollup";

import { createFilter } from "@rollup/pluginutils";

export type RawLoaderOptions = {
  include?: FilterPattern;
  exclude?: FilterPattern;
};

const defaults: RawLoaderOptions = {
  include: [/\.(md|txt|css|htm|html)$/],
  exclude: [],
};

export function rawPlugin(opts: RawLoaderOptions = {}): Plugin {
  opts = { ...opts, ...defaults };
  const filter = createFilter(opts.include, opts.exclude);
  return {
    name: "relidler-raw",
    transform(code, id): { code: string; map: any } | undefined {
      if (filter(id)) {
        return {
          code: `export default ${JSON.stringify(code)}`,
          map: null,
        };
      }
      return undefined;
    },
  };
}
