import { defineConfigDler } from "~/libs/cfg/cfg-impl/cfg-consts";

// TODO: cache src's files in `.reliverse/dler/<project-name>/<src-file-path>` dir (this will allow to implement new option e.g. buildPubOnlyAtLeastOneFileChanged, esp. useful for cases like `@reliverse/cfg` library) (we can use hash of the file name and/or date of the last file modification)
// TODO: introduce new option which allows to enable/disable transpiling other extensions that .ts and .js (disabling from build process of e.g. .tsx extension is especially useful for bootstrapping clis tools like @reliverse/rse, where cli's developers usually expect to have their original .tsx files in the dist)

/**
 * Reliverse Bundler Configuration
 * Hover over a field to see more details
 * @see https://github.com/reliverse/dler
 */
export default defineConfigDler({
  // Bump configuration
  bumpDisable: false,
  bumpFilter: ["package.json", ".config/rse.ts", "src/libs/sdk/sdk-impl/config/info.ts"],
  bumpMode: "patch",

  // Common configuration
  commonPubPause: false,
  commonPubRegistry: "npm-jsr",
  commonVerbose: true,

  // Core configuration
  coreBuildOutDir: "bin",
  coreDeclarations: true,
  coreDescription:
    "dler (prev. relidler) is a flexible, unified, and fully automated bundler for TypeScript and JavaScript projects, as well as an NPM and JSR publishing tool.",
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
      // TODO: [dler] eliminate libPkgKeepDeps
      // in favor of filterDepsPatterns param
      libPkgKeepDeps: true,
      libTranspileMinify: true,
      libPubPause: false,
      libPubRegistry: "npm-jsr",
    },
    "@reliverse/cfg": {
      libDeclarations: true,
      libDescription: "shared config package for @reliverse/dler and @reliverse/rse",
      libDirName: "cfg",
      libMainFile: "cfg/cfg-mod.ts",
      libPkgKeepDeps: true, // TODO: temp
      /* libPkgKeepDeps: [
        // most of the deps here are temporary at the moment
        // TODO: move prompts and logs to dler's or rse's impl to reduce deps number
        "@reliverse/relinka",
        "@reliverse/runtime",
        "@reliverse/relifso",
        "@reliverse/pathkit",
        "@sinclair/typebox",
        "c12", // TODO: replace with @reliverse/reconf
        "confbox",
        "@reliverse/rempts",
        "execa",
        "nypm",
        "destr",
        "magic-string",
        "jiti",
        "jsonrepair", // TODO: migrate to @reliverse/relifso (jsonrepair is already built-in there)
        "pkg-types",
      ], */
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
    global: ["package.json", "README.md", "LICENSE", "LICENSES"],
    "dist-jsr": [],
    "dist-npm": [],
    "dist-libs": {
      "@reliverse/dler-sdk": {
        jsr: [],
        npm: [],
      },
      "@reliverse/cfg": {
        jsr: [],
        npm: [],
      },
    },
  },

  // Files with these extensions will be built
  // Any other files will be copied as-is to dist
  buildPreExtensions: ["ts", "js"],
  // If you need to exclude some ts/js files from being built,
  // you can store them in the dirs with buildTemplatesDir name
  buildTemplatesDir: "templates",

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
    "dist-npm": [],
    "dist-jsr": [],
    "dist-libs": {
      "@reliverse/dler-sdk": {
        jsr: ["!bun"],
        npm: [],
      },
      "@reliverse/cfg": {
        jsr: [],
        npm: [],
      },
    },
  },

  // Code quality tools
  // Available: tsc, eslint, biome, knip, dler-check
  runBeforeBuild: [],
  // Available: dler-check
  runAfterBuild: [],

  // Build hooks
  hooksBeforeBuild: [
    // example plugin:
    // async () => {
    //   await myCoolPlugin({
    //     /* plugin's options */
    //   });
    // },
  ],
  hooksAfterBuild: [
    // example func:
    // async () => {
    //   await applyMagicSpells(["dist-jsr", "dist-npm", "dist-libs"]);
    // }
  ],

  postBuildSettings: {
    deleteDistTmpAfterBuild: true,
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
