import { defineConfig } from "~/libs/cfg/cfg-mod.js";

/**
 * Reliverse Bundler Configuration
 * Hover over a field to see more details
 * @see https://github.com/reliverse/dler
 */
export default defineConfig({
  // Bump configuration
  bumpDisable: false,
  bumpFilter: ["package.json", ".config/rse.ts"],
  bumpMode: "autoPatch",

  // Common configuration
  commonPubPause: false,
  commonPubRegistry: "npm-jsr",
  commonVerbose: true,

  // Core configuration
  coreDeclarations: false,
  coreDescription:
    "dler (prev. relidler) is a flexible, unified, and fully automated bundler for TypeScript and JavaScript projects, as well as an NPM and JSR publishing tool.",
  coreEntryFile: "mod.ts",
  coreEntrySrcDir: "src",
  coreIsCLI: true,

  // JSR-only config
  distJsrAllowDirty: true,
  distJsrBuilder: "jsr",
  distJsrCopyRootFiles: ["README.md", "LICENSE"],
  distJsrDirName: "dist-jsr",
  distJsrDryRun: false,
  distJsrFailOnWarn: false,
  distJsrGenTsconfig: false,
  distJsrOutFilesExt: "ts",
  distJsrSlowTypes: true,

  // NPM-only config
  distNpmBuilder: "mkdist",
  distNpmCopyRootFiles: ["README.md", "LICENSE"],
  distNpmDirName: "dist-npm",
  distNpmOutFilesExt: "js",

  // Libraries Dler Plugin
  // Publish specific dirs as separate packages
  // This feature is experimental at the moment
  // Please commit your changes before using it
  libsActMode: "main-project-only", // TODO: change to "main-and-libs" when libs packaging for npm is fixed
  libsDirDist: "dist-libs",
  libsDirSrc: "src/libs",
  libsList: {
    "@reliverse/dler-cfg": {
      libDeclarations: true,
      libDescription: "@reliverse/dler defineConfig",
      libDirName: "cfg",
      libMainFile: "cfg/cfg-mod.ts",
      libPkgKeepDeps: false,
      libTranspileMinify: true,
    },
    "@reliverse/dler-sdk": {
      libDeclarations: true,
      libDescription: "@reliverse/dler without cli",
      libDirName: "sdk",
      libMainFile: "sdk/sdk-mod.ts",
      libPkgKeepDeps: true,
      libTranspileMinify: true,
    },
  },

  // Logger setup
  logsFileName: "logs/relinka.log",
  logsFreshFile: true,

  // Dependency filtering
  rmDepsMode: "patterns-and-devdeps",
  rmDepsPatterns: [
    "@types",
    "biome",
    "eslint",
    "knip",
    "prettier",
    "typescript",
    "@reliverse/config",
  ],

  // Build setup
  transpileEsbuild: "es2023",
  transpileFormat: "esm",
  transpileMinify: true,
  transpilePublicPath: "/",
  transpileSourcemap: "none",
  transpileSplitting: false,
  transpileStub: false,
  transpileTarget: "node",
  transpileWatch: false,

  // Additionals
  injectComment: "// @ts-expect-error TODO: fix ts",
  tscCommand: "tsc --project ./tsconfig.json --noEmit",
});
