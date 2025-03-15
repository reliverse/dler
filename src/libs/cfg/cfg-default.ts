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
  pausePublish: false,
  dryRun: false,

  // Versioning options
  bump: "autoPatch",
  disableBump: false,

  // NPM-only config
  npmDistDir: "dist-npm",
  npmBuilder: "mkdist",
  npmOutFilesExt: "js",
  npmDeclarations: true,

  // JSR-only config
  jsrDistDir: "dist-jsr",
  jsrBuilder: "jsr",
  jsrSlowTypes: false,
  jsrAllowDirty: false,

  // Build optimization
  shouldMinify: true,
  splitting: false,
  sourcemap: "none",
  esbuild: "es2023",
  publicPath: "/",
  target: "node",
  format: "esm",

  // Dependency filtering
  excludedDependencyPatterns: [
    "@types",
    "biome",
    "eslint",
    "knip",
    "prettier",
    "typescript",
    "@reliverse/config",
  ],

  // Publish specific dirs as separate packages
  // This feature is experimental at the moment
  // Please commit your changes before using it
  buildPublishMode: "main-project-only",
  libs: {},
};
