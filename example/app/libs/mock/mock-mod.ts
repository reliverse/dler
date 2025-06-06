import { CFG_DLER_TEMPLATE } from "./tpls/cfg";
import { SDK_DLER_TEMPLATE } from "./tpls/sdk";

export const DLER_TEMPLATES = {
  cfg: CFG_DLER_TEMPLATE,
  sdk: SDK_DLER_TEMPLATE,
} as const;

export type DLER_TEMPLATE_NAMES = keyof typeof DLER_TEMPLATES;

export const dlerTemplatesMap: Record<string, DLER_TEMPLATE_NAMES> = {
  CFG_DLER_TEMPLATE: "cfg",
  SDK_DLER_TEMPLATE: "sdk",
};
