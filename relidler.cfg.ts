import { defineConfig } from "./src/libs/cfg/cfg-main.js";

/**
 * Reliverse Bundler Configuration
 * Hover over a field to see more details
 * @see https://github.com/reliverse/relidler
 */
export default defineConfig({
  // Common configuration
  entryFile: "main.ts",
  entrySrcDir: "src",
  verbose: true,
  isCLI: true,

  // Publishing options
  registry: "npm-jsr",
  pausePublish: false,
  dryRun: false,

  // Versioning options
  bumpMode: "autoPatch",
  disableBump: false,
  bumpFilter: ["package.json", "reliverse.jsonc", "reliverse.ts"],

  // NPM-only config
  npmDistDir: "dist-npm",
  npmBuilder: "mkdist",
  npmOutFilesExt: "js",
  npmDeclarations: false,

  // JSR-only config
  jsrDistDir: "dist-jsr",
  jsrBuilder: "jsr",
  jsrSlowTypes: true,
  jsrAllowDirty: true,

  // Build setup
  minify: true,
  splitting: false,
  sourcemap: "none",
  stub: false,
  watch: false,
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
  libs: {
    "@reliverse/relidler-cfg": {
      main: "cfg/cfg-main.ts",
      subDistDir: "cfg",
      description: "@reliverse/relidler defineConfig",
      dependencies: ["pathe"],
      minify: false,
    },
    "@reliverse/relidler-sdk": {
      main: "sdk/sdk-main.ts",
      subDistDir: "sdk",
      description: "@reliverse/relidler without cli",
      dependencies: true,
      minify: true,
    },
  },
});
