import path from "pathe";

import type { NpmOutExt } from "~/types.js";

// ============================
// Constants & Global Setup
// ============================

export const PROJECT_ROOT = path.resolve(process.cwd());

export const CONCURRENCY_DEFAULT = 1;

export const tsconfigJson = "tsconfig.json";

export const cliDomainDocs = "https://docs.reliverse.org";

export const validExtensions = [
  "cjs",
  "js",
  "mjs",
  "ts",
  "mts",
  "cts",
] satisfies NpmOutExt[];

export const SHOW_VERBOSE = {
  getDirectorySize: false,
  readFileSafe: false,
};
