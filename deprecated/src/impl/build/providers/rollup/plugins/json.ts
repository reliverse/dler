import type { RollupJsonOptions } from "@rollup/plugin-json";
import type { Plugin, TransformHook, TransformResult } from "rollup";

const jsonPluginModule = (await import("@rollup/plugin-json")) as any;
const jsonPlugin = jsonPluginModule.default || jsonPluginModule;
const EXPORT_DEFAULT = "export default ";

export function JSONPlugin(options: RollupJsonOptions): Plugin {
  const plugin = jsonPlugin(options);
  return {
    ...plugin,
    name: "dler-json",
    transform(code, id): TransformResult {
      const res = (plugin.transform as TransformHook).call(this, code, id);
      if (res && typeof res !== "string" && "code" in res && res.code?.startsWith(EXPORT_DEFAULT)) {
        res.code = res.code.replace(EXPORT_DEFAULT, "module.exports = ");
      }
      return res;
    },
  } satisfies Plugin;
}
