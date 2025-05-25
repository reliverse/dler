import { defineConfig } from "~/mod.js";

/**
 * Reliverse Bundler Configuration
 * Hover over a field to see more details
 * @see https://github.com/reliverse/dler
 */
export default defineConfig({
  // Bump configuration
  bumpDisable: false,
  bumpFilter: ["package.json", ".config/rse.ts"],
  bumpMode: "patch",

  // Common configuration
  commonPubPause: false,
  commonPubRegistry: "npm-jsr",
  commonVerbose: true,

  // Core configuration
  coreDeclarations: true,
  coreDescription:
    "@reliverse/dler is a flexible, unified, and fully automated bundler for typescript and javascript projects, as well as an npm and jsr publishing tool. dler is not only a bundler, it also tries to serve as the most powerful codemod toolkit for js/ts.",
  coreEntryFile: "mod.ts",
  coreEntrySrcDir: "src",
  coreBuildOutDir: "bin",
  coreIsCLI: {
    enabled: true,
    scripts: { dler: "cli.ts" },
  },

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
  libsActMode: "main-and-libs",
  libsDirDist: "dist-libs",
  libsDirSrc: "src/libs",
  libsList: {
    "@reliverse/dler-sdk": {
      libDeclarations: true,
      libDescription: "@reliverse/dler without cli",
      libDirName: "sdk",
      libMainFile: "sdk/sdk-mod.ts",
      libPkgKeepDeps: true,
      libTranspileMinify: true,
      libPubPause: false,
      libPubRegistry: "npm-jsr",
    },
  },

  // Logger setup
  logsFileName: ".logs/relinka.log",
  logsFreshFile: true,

  // Dependency filtering
  // Global is always applied
  removeDepsPatterns: {
    global: [
      "@types",
      "biome",
      "eslint",
      "knip",
      "prettier",
      "typescript",
      "@reliverse/dler",
    ],
    "dist-npm": ["bun"],
    "dist-jsr": [],
    "dist-libs": {
      "@reliverse/dler-sdk": {
        npm: ["bun"],
        jsr: [],
      },
    },
  },

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
});
