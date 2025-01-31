import type { RollupJsonOptions } from "@rollup/plugin-json";
import type { Plugin, TransformHook } from "rollup";

import * as rollupJSONPlugin from "@rollup/plugin-json";

const EXPORT_DEFAULT = "export default ";

export function JSONPlugin(options?: RollupJsonOptions): Plugin {
  // @ts-expect-error TODO: fix ts
  const plugin = rollupJSONPlugin.default(options);
  return {
    ...plugin,
    name: "relidler-json",
    transform(code, id) {
      const res = (plugin.transform as TransformHook).call(this, code, id);
      if (typeof res === "object" && res?.code?.startsWith?.(EXPORT_DEFAULT)) {
        res.code = res.code.replace(EXPORT_DEFAULT, "module.exports = ");
      }
      return res;
    },
  };
}
