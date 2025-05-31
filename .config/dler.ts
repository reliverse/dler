import { defineConfig } from "~/mod";

/**
 * Reliverse Bundler Configuration
 * Hover over a field to see more details
 * @see https://github.com/reliverse/dler
 */
export default defineConfig({
  // Bump configuration
  bumpDisable: false,
  bumpFilter: [
    "package.json",
    ".config/rse.ts",
    "src/libs/sdk/sdk-impl/cfg/info.ts",
  ],
  bumpMode: "patch",

  // Common configuration
  commonPubPause: false,
  commonPubRegistry: "npm-jsr",
  commonVerbose: true,

  // Core configuration
  coreBuildOutDir: "bin",
  coreDeclarations: true,
  coreDescription:
    "@reliverse/dler is a flexible, unified, and fully automated bundler for typescript and javascript projects, as well as an npm and jsr publishing tool. dler is not only a bundler, it also tries to serve as the most powerful codemod toolkit for js/ts.",
  coreEntryFile: "mod.ts",
  coreEntrySrcDir: "src",
  coreIsCLI: { enabled: true, scripts: { dler: "cli.ts" } },

  // JSR-only config
  distJsrAllowDirty: true,
  distJsrBuilder: "jsr",
  distJsrDirName: "dist-jsr",
  distJsrDryRun: false,
  distJsrFailOnWarn: false,
  distJsrGenTsconfig: false,
  distJsrOutFilesExt: "ts",
  distJsrSlowTypes: true,

  // NPM-only config
  distNpmBuilder: "mkdist",
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

  // @reliverse/relinka logger setup
  logsFileName: ".logs/relinka.log",
  logsFreshFile: true,

  // Specifies what resources to send to npm and jsr registries.
  // coreBuildOutDir (e.g. "bin") dir is automatically included.
  // The following is also included if publishArtifacts is {}:
  // - global: ["package.json", "README.md", "LICENSE"]
  // - dist-jsr,dist-libs/jsr: ["jsr.json"]
  publishArtifacts: {
    global: ["package.json", "README.md", "LICENSE"],
    "dist-jsr": ["jsr.json"],
    "dist-npm": [],
    "dist-libs": {
      "@reliverse/dler-sdk": {
        jsr: ["jsr.json"],
        npm: [],
      },
    },
  },

  // Dependency filtering
  // Global is always applied
  filterDepsPatterns: {
    global: [
      "bun",
      "@types",
      "biome",
      "eslint",
      "knip",
      "prettier",
      "typescript",
      "@reliverse/rse",
      "@reliverse/dler",
      "!@reliverse/rse-sdk",
      "!@reliverse/dler-sdk",
    ],
    "dist-jsr": [],
    "dist-npm": [],
    "dist-libs": {
      "@reliverse/dler-sdk": {
        jsr: ["!bun"],
        npm: [],
      },
    },
  },

  // Build setup
  // transpileAlias: {},
  // transpileClean: true,
  // transpileEntries: [],
  transpileEsbuild: "es2023",
  // transpileExternals: [],
  transpileFailOnWarn: false,
  transpileFormat: "esm",
  transpileMinify: true,
  // transpileParallel: false,
  transpilePublicPath: "/",
  // transpileReplace: {},
  // transpileRollup: {
  //   alias: {},
  //   commonjs: {},
  //   dts: {},
  //   esbuild: {},
  //   json: {},
  //   replace: {},
  //   resolve: {},
  // },
  // transpileShowOutLog: false,
  transpileSourcemap: "none",
  transpileSplitting: false,
  transpileStub: false,
  // transpileStubOptions: { jiti: {} },
  transpileTarget: "node",
  transpileWatch: false,
  // transpileWatchOptions: undefined,
});
