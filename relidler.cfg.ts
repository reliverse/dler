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
  bump: "autoPatch",
  disableBump: false,

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

  // Build optimization
  shouldMinify: true,
  splitting: false,
  sourcemap: "none",
  esbuild: "es2023",
  publicPath: "/",
  target: "node",
  format: "esm",

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
      description: "@reliverse/relidler defineConfig",
      dependencies: ["pathe"],
    },
    "@reliverse/relidler-sdk": {
      main: "sdk/sdk-main.ts",
      description: "@reliverse/relidler without cli",
      dependencies: true,
    },
  },
});
