import path from "node:path";

export const WHITELABEL_DEFAULT = "DLER";

export const JSON_EXTS = new Set(["json", "jsonc", "json5", "jsonl"]);

export const TEMPLATE_VAR = (tpl: string, wl: string) =>
  `${tpl.toUpperCase()}_${wl.toUpperCase()}_TEMPLATE`;

export const IMPL_DIR = "impl";
export const BINARIES_DIR = "binaries";
export const TYPES_FILE = "types.ts";
export const AGGREGATOR_FILE = "mod.ts";

export const isJsonExt = (f: string) => JSON_EXTS.has(path.extname(f).slice(1).toLowerCase());
