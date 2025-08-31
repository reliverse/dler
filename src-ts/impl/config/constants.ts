import os from "node:os";
import path from "@reliverse/pathkit";

// PROJECT ROOT
export const PROJECT_ROOT = path.resolve(process.cwd());

// CLI VERSION AND NAME
const version= "1.7.141";
export const cliVersion = version;
export const cliName = "@reliverse/rse";
export const rseName = "@reliverse/rse";
export const dlerName = "@reliverse/dler";

// GENERAL CONFIG NAMES
export const tsconfigJson = "tsconfig.json";

// RSE CONFIG
export const cliConfigJsonc = "reliverse.jsonc";
export const cliConfigJsoncTmp = "reliverse.jsonc.tmp";
export const cliConfigJsoncBak = "reliverse.jsonc.bak";

// RSE CONFIG
export const cliConfigTs = "reliverse.ts";
export const cliConfigTsTmp = "reliverse.ts.tmp";
export const cliConfigTsBak = "reliverse.ts.bak";

// DOCUMENTATION WEBSITE
export const rseOrg = "https://reliverse.org";
export const rseOrgBase = `reliverse.org`;
export const cliDomainRoot = `https://docs.reliverse.org`;
export const cliDomainDocs = `https://docs.reliverse.org/cli`;
export const cliDomainEnv = `https://docs.reliverse.org/env`;

// HOMEDIR OF THE CLI
export const homeDir = os.homedir();
export const cliHomeDir = path.join(homeDir, ".reliverse", "rse");
export const cliHomeTmp = path.join(cliHomeDir, "temp");
export const cliHomeRepos = path.join(cliHomeDir, "repos");
export const memoryPath = path.join(cliHomeDir, "memory.db");
export const cliJsrPath = path.join(cliHomeDir, "cli");

export const useLocalhost = false;

export const DEFAULT_CLI_USERNAME = "johnny911";

export const endTitle = `📚 Check the docs to learn more: ${cliDomainDocs}`;

export const UNKNOWN_VALUE = "unknown";
export const UNKNOWN_STRING = `"unknown"`;
export const DEFAULT_DOMAIN = "https://example.com";
export const RSE_SCHEMA_DEV = "./schema.json";
export const RSE_SCHEMA_URL = `${rseOrg}/schema.json`;

export const FALLBACK_ENV_EXAMPLE_URL =
  "https://raw.githubusercontent.com/blefnk/relivator/main/.env.example";

// Configuration file categories for generation
export const CONFIG_CATEGORIES = {
  core: [cliConfigJsonc, cliConfigTs],
  linting: ["biome.json"],
  ide: [".vscode/settings.json"],
  git: [".gitignore"],
} as const;

// common directories to ignore
export const IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  ".next",
  ".vercel",
  "coverage",
  ".nyc_output",
  "dist",
  "build",
  ".cache",
  ".temp",
  ".tmp",
] as const;

export const CONCURRENCY_DEFAULT = 1;

export const validExtensions = ["cjs", "js", "mjs", "ts", "mts", "cts"];

export const SHOW_VERBOSE = {
  getDirectorySize: false,
  readFileSafe: false,
};
