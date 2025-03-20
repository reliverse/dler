import type { BuildPublishConfig } from "./cfg-types.js";

/**
 * Default configuration for the build and publish logic.
 */
export const DEFAULT_CONFIG: BuildPublishConfig = {
  bumpDisable: false,
  bumpFilter: ["package.json", "reliverse.ts"],
  // Versioning options
  bumpMode: "autoPatch",
  commonPubPause: true,

  // Publishing options
  commonPubRegistry: "npm-jsr",
  commonVerbose: false,
  // Common configuration
  coreEntryFile: "main.ts",

  coreEntrySrcDir: "src",
  coreIsCLI: false,
  distJsrAllowDirty: true,

  distJsrBuilder: "jsr",
  distJsrCopyRootFiles: ["README.md", "LICENSE"],
  // JSR-only config
  distJsrDirName: "dist-jsr",
  distJsrDryRun: false,
  distJsrGenTsconfig: false,

  distJsrSlowTypes: true,
  distNpmBuilder: "mkdist",
  distNpmCopyRootFiles: ["README.md", "LICENSE"],
  distNpmDeclarations: true,
  // NPM-only config
  distNpmDirName: "dist-npm",
  distNpmOutFilesExt: "js",

  // Libraries Relidler Plugin
  // Publish specific dirs as separate packages
  // This feature is experimental at the moment
  // Please commit your changes before using it
  libsActMode: "main-project-only",
  libsDirDist: "dist-libs",
  libsDirSrc: "src/libs",
  libsList: {},
  logsFileName: "relinka.log",
  // Logger options
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
  transpileEsbuild: "es2023",

  transpileFormat: "esm",
  // Build setup
  transpileMinify: true,

  transpilePublicPath: "/",
  transpileSourcemap: "none",

  transpileSplitting: false,
  transpileStub: false,
  transpileTarget: "node",
  transpileWatch: false,
};
