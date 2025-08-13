import { defineConfig } from "./types/dler.schema";

// TODO: cache src's files in `.reliverse/dler/<project-name>/<src-file-path>` dir (this will allow to implement new option e.g. buildPubOnlyAtLeastOneFileChanged, esp. useful for cases like `@reliverse/cfg` library) (we can use hash of the file name and/or date of the last file modification)
// TODO: introduce new option which allows to enable/disable transpiling other extensions that .ts and .js (disabling from build process of e.g. .tsx extension is especially useful for bootstrapping clis tools like @reliverse/rse, where cli's developers usually expect to have their original .tsx files in the dist)

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
    "src/libs/sdk/sdk-impl/config/info.ts",
    "src/cli.ts",
  ],
  bumpMode: "patch",

  // Common configuration
  commonPubPause: false,
  commonPubRegistry: "npm",
  commonVerbose: false,

  // Core configuration
  coreBuildOutDir: "bin",
  coreDeclarations: true,
  coreDescription:
    "dler (prev. relidler) is a flexible, unified, and fully automated bundler for TypeScript and JavaScript projects, as well as an NPM and JSR publishing tool.",
  coreEntryFile: "mod.ts",
  coreEntrySrcDir: "src",
  coreIsCLI: { enabled: true, scripts: { dler: "cli.ts" } },

  // Logs
  displayBuildPubLogs: false,

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
  libsActMode: "main-project-only",
  libsDirDist: "dist-libs",
  libsDirSrc: "src/libs",
  libsList: {
    "@reliverse/dler-sdk": {
      libDeclarations: true,
      libDescription:
        "@reliverse/dler-sdk without cli. @reliverse/dler-sdk allows you to create new plugins for @reliverse/dler CLI, and even extend your own CLI functionality (you may also try @reliverse/rse-sdk for this case).",
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
      libDescription: "config typescript definitions for @reliverse/dler",
      libDirName: "cfg",
      libMainFile: "cfg/cfg-mod.ts",
      libPkgKeepDeps: false,
      libTranspileMinify: true,
      libPubPause: false,
      libPubRegistry: "npm-jsr",
    },
    "@reliverse/get": {
      libDeclarations: true,
      libDescription: "get binaries for @reliverse/dler and other dev tools",
      libDirName: "get",
      libMainFile: "get/get-mod.ts",
      libPkgKeepDeps: [
        "@reliverse/pathkit",
        "@reliverse/relifso",
        "@reliverse/relinka",
        "@reliverse/rempts",
        "lookpath",
        "execa",
      ],
      libTranspileMinify: true,
      libPubPause: false,
      libPubRegistry: "npm-jsr",
    },
  },

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
      "@reliverse/get": {
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
      "@types",
      "biome",
      "knip",
      "eslint",
      "prettier",
      "typescript",
      "@reliverse/rse",
      "@reliverse/dler",
      "!@reliverse/rse-sdk",
      "!@reliverse/dler-sdk",
    ],
    "dist-npm": [],
    "dist-jsr": ["+bun"],
    "dist-libs": {
      "@reliverse/dler-sdk": {
        jsr: ["+bun"],
        npm: [],
      },
      "@reliverse/cfg": {
        jsr: [],
        npm: [],
      },
      "@reliverse/get": {
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

  // @reliverse/relinka logger setup
  logsFileName: ".logs/relinka.log",
  logsFreshFile: true,

  // Integrated relinka configuration
  // https://github.com/reliverse/relinka
  relinka: {
    verbose: false,

    // Timestamp configuration
    timestamp: {
      enabled: false,
      format: "HH:mm:ss",
    },

    // Control whether logs are saved to a file
    saveLogsToFile: false,

    // Disable colors in the console
    disableColors: false,

    // Log file configuration
    logFile: {
      outputPath: "logs.log",
      nameWithDate: "disable",
      freshLogFile: true,
    },

    // Dirs settings
    dirs: {
      maxLogFiles: 5,
    },

    levels: {
      success: {
        symbol: "✓",
        fallbackSymbol: "[OK]",
        color: "greenBright",
        spacing: 3,
      },
      info: {
        symbol: "i",
        fallbackSymbol: "[i]",
        color: "cyanBright",
        spacing: 3,
      },
      error: {
        symbol: "✖",
        fallbackSymbol: "[ERR]",
        color: "redBright",
        spacing: 3,
      },
      warn: {
        symbol: "⚠",
        fallbackSymbol: "[WARN]",
        color: "yellowBright",
        spacing: 3,
      },
      fatal: {
        symbol: "‼",
        fallbackSymbol: "[FATAL]",
        color: "redBright",
        spacing: 3,
      },
      verbose: {
        symbol: "✧",
        fallbackSymbol: "[VERBOSE]",
        color: "gray",
        spacing: 3,
      },
      internal: {
        symbol: "⚙",
        fallbackSymbol: "[INTERNAL]",
        color: "magentaBright",
        spacing: 3,
      },
      log: { symbol: "│", fallbackSymbol: "|", color: "dim", spacing: 3 },
      message: {
        symbol: "🞠",
        fallbackSymbol: "[MSG]",
        color: "cyan",
        spacing: 3,
      },
    },
  },
});
