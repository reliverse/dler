import type { FilterPattern } from "@rollup/pluginutils";
import type { Plugin } from "rollup";

import { createFilter } from "@rollup/pluginutils";

type RawLoaderOptions = {
  exclude?: FilterPattern;
  include?: FilterPattern;
};

const defaults: RawLoaderOptions = {
  exclude: [],
  include: [/\.(md|txt|css|htm|html)$/],
};

export function rawPlugin(opts: RawLoaderOptions = {}): Plugin {
  const options = { ...defaults, ...opts };
  const filter = createFilter(options.include, options.exclude);
  return {
    name: "relidler-raw",
    transform(code, id): undefined | { code: string; map: any } {
      if (filter(id)) {
        return {
          code: `export default ${JSON.stringify(code)}`,
          map: null,
        };
      }
    },
  };
}
