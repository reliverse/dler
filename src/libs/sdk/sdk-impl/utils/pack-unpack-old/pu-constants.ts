import path from "@reliverse/pathkit";

export const WHITELABEL_DEFAULT = "DLER";

export const JSON_EXTS = new Set(["json", "jsonc", "json5", "jsonl"]);

export const TEMPLATE_VAR = (tpl: string, wl: string) =>
  `${tpl.toUpperCase()}_${wl.toUpperCase()}_TEMPLATE`;

export const TPLS_DIR = "tpls";
export const BINARIES_DIR = "binaries";

export const isJsonExt = (f: string) => JSON_EXTS.has(path.extname(f).slice(1).toLowerCase());
