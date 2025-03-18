import type { BuildPublishConfig } from "~/types.js";

/**
 * Default configuration for the build and publish logic.
 */
export const DEFAULT_CONFIG: BuildPublishConfig = {
  // Common configuration
  entryFile: "main.ts",
  entrySrcDir: "src",
  verbose: false,
  isCLI: false,

  // Publishing options
  registry: "npm-jsr",
  pausePublish: true,
  dryRun: false,

  // Versioning options
  bumpMode: "autoPatch",
  disableBump: false,
  bumpFilter: ["package.json", "reliverse.jsonc", "reliverse.ts"],

  // NPM-only config
  npmDistDir: "dist-npm",
  npmBuilder: "mkdist",
  npmOutFilesExt: "js",
  npmDeclarations: true,

  // JSR-only config
  jsrDistDir: "dist-jsr",
  jsrBuilder: "jsr",
  jsrSlowTypes: true,
  jsrAllowDirty: true,

  // Build setup
  minify: true,
  splitting: false,
  parallel: false,
  stub: false,
  watch: false,
  sourcemap: "none",
  esbuild: "es2023",
  publicPath: "/",
  target: "node",
  format: "esm",

  // Logger options
  freshLogFile: true,
  logFile: "relinka.log",

  // Dependency filtering
  excludeMode: "patterns-and-devdeps",
  excludedDependencyPatterns: [
    "@types",
    "biome",
    "eslint",
    "knip",
    "prettier",
    "typescript",
    "@reliverse/config",
  ],

  // Libraries Relidler Plugin
  // Publish specific dirs as separate packages
  // This feature is experimental at the moment
  // Please commit your changes before using it
  buildPublishMode: "main-project-only",
  libsDistDir: "dist-libs",
  libsSrcDir: "src/libs",
  libs: {},
};
