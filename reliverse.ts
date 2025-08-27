import { defineConfig } from "./reltypes";

// TODO: divide different parts of dler into the plugins

// TODO: cache src's files in `.reliverse/dler/<project-name>/<src-file-path>` dir (this will allow to implement new option e.g. buildPubOnlyAtLeastOneFileChanged, esp. useful for cases like `~/app/types/mod` library) (we can use hash of the file name and/or date of the last file modification)
// TODO: introduce new option which allows to enable/disable transpiling other extensions that .ts and .js (disabling from build process of e.g. .tsx extension is especially useful for bootstrapping clis tools like @reliverse/rse, where cli's developers usually expect to have their original .tsx files in the dist)

// TODO: implement migrator from build.config.ts to reliverse.ts
// export function defineBuildConfig(
//   config: UnifiedBuildConfig | UnifiedBuildConfig[],
// ): UnifiedBuildConfig[] {
//   return (Array.isArray(config) ? config : [config]).filter(Boolean);
// }

/**
 * @reliverse/* libraries & rse configuration
 * Hover over the fields to learn more details
 * @see https://docs.reliverse.org/libraries
 */
export default defineConfig({
  // RSE CONFIG (https://docs.reliverse.org/cli)
  // Restart the CLI to apply your config changes
  $schema: "./schema.json",

  // General project information
  projectName: "@reliverse/dler",
  projectAuthor: "reliverse",
  projectDescription:
    "dler (prev. relidler) is a flexible, unified, and fully automated bundler for TypeScript and JavaScript projects, as well as an NPM and JSR publishing tool.",
  version: "1.7.121",
  projectLicense: "MIT",

  // Bump configuration
  bumpDisable: false,
  bumpFilter: ["package.json", "reliverse.ts", "src-ts/app/config/constants.ts", "src-ts/dler.ts"],
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
  coreEntrySrcDir: "src-ts",
  coreIsCLI: { enabled: false, scripts: {} },

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

  // Project configuration
  projectState: "creating",
  projectRepository: "https://github.com/reliverse/rse",
  projectDomain: "https://docs.reliverse.org/cli",
  projectCategory: "unknown",
  projectSubcategory: "unknown",
  projectTemplate: "unknown",
  projectTemplateDate: "unknown",
  projectArchitecture: "unknown",
  repoPrivacy: "unknown",
  projectGitService: "github",
  projectDeployService: "vercel",
  repoBranch: "main",

  // Primary tech stack/framework
  projectFramework: "rempts",
  projectPackageManager: "bun",
  projectRuntime: "bun",
  preferredLibraries: {
    stateManagement: "unknown",
    formManagement: "unknown",
    styling: "unknown",
    uiComponents: "unknown",
    testing: "unknown",
    authentication: "unknown",
    databaseLibrary: "drizzle",
    databaseProvider: "sqlite",
    api: "trpc",
    linting: "unknown",
    formatting: "unknown",
    payment: "unknown",
    analytics: "unknown",
    monitoring: "unknown",
    logging: "unknown",
    forms: "unknown",
    notifications: "unknown",
    search: "unknown",
    uploads: "unknown",
    validation: "zod",
    documentation: "unknown",
    icons: "unknown",
    mail: "unknown",
    cache: "unknown",
    storage: "unknown",
    cdn: "unknown",
    cms: "unknown",
    i18n: "unknown",
    seo: "unknown",
    motion: "unknown",
    charts: "unknown",
    dates: "unknown",
    markdown: "unknown",
    security: "unknown",
    routing: "unknown",
  },
  monorepo: {
    type: "none",
    packages: [],
    sharedPackages: [],
  },

  // List dependencies to exclude from checks
  ignoreDependencies: [],

  // Provide custom rules for Reliverse AI
  // You can use any json type here in {}
  customRules: {},

  // Project features
  features: {
    i18n: false,
    analytics: false,
    themeMode: "dark-light",
    authentication: true,
    api: true,
    database: true,
    testing: false,
    docker: false,
    ci: false,
    commands: [
      "pub",
      "example",
      "db",
      "latest",
      "check",
      "dev:cli",
      "dev:add",
      "dev:ai",
      "dev:clone",
      "dev:cmod",
    ],
    webview: ["react-native"],
    language: ["typescript"],
    themes: ["default", "eslint", "biome", "sonner", "uploadthing", "zod", "typebox", "lucide"],
  },

  // Code style preferences
  codeStyle: {
    dontRemoveComments: true,
    shouldAddComments: true,
    typeOrInterface: "type",
    importOrRequire: "import",
    quoteMark: "double",
    semicolons: true,
    lineWidth: 80,
    indentStyle: "space",
    indentSize: 2,
    importSymbol: "~",
    trailingCommas: "all",
    bracketSpacing: true,
    arrowParens: "always",
    tabWidth: 2,
    jsToTs: false,
    cjsToEsm: false,
    modernize: {
      replaceFs: false,
      replacePath: false,
      replaceHttp: false,
      replaceProcess: false,
      replaceConsole: false,
      replaceEvents: false,
    },
  },

  // Settings for cloning an existing repo
  multipleRepoCloneMode: false,
  customUserFocusedRepos: [],
  customDevsFocusedRepos: [],
  hideRepoSuggestions: false,
  customReposOnNewProject: false,

  // Set to false to disable opening the browser during env composing
  envComposerOpenBrowser: true,

  // Enable auto-answering for prompts to skip manual confirmations.
  // Make sure you have unknown values configured above.
  skipPromptsUseAutoBehavior: false,

  // Prompt behavior for deployment
  // Options: prompt | autoYes | autoNo
  deployBehavior: "prompt",
  depsBehavior: "prompt",
  gitBehavior: "prompt",
  i18nBehavior: "prompt",
  scriptsBehavior: "prompt",

  // Behavior for existing GitHub repos during project creation
  // Options: prompt | autoYes | autoYesSkipCommit | autoNo
  existingRepoBehavior: "prompt",

  // Behavior for Reliverse AI chat and agent mode
  // Options: promptOnce | promptEachFile | autoYes
  relinterConfirm: "promptOnce",

  // Binary Build Configuration
  binaryBuildEnabled: false,
  binaryBuildInputFile: undefined,
  binaryBuildTargets: "all",
  binaryBuildOutDir: "dist",
  binaryBuildMinify: true,
  binaryBuildSourcemap: true,
  binaryBuildBytecode: false,
  binaryBuildClean: true,
  binaryBuildWindowsIcon: undefined,
  binaryBuildWindowsHideConsole: false,
  binaryBuildAssetNaming: "[name]-[hash].[ext]",
  binaryBuildParallel: true,
  binaryBuildExternal: ["c12", "terminal-kit"],
  binaryBuildNoCompile: false,

  // Libraries Dler Plugin
  // Publish specific dirs as separate packages
  // This feature is experimental at the moment
  // Please commit your changes before using it
  libsActMode: "main-project-only",
  libsDirDist: "dist-libs",
  libsDirSrc: "src/libs",
  libsList: {
    // TODO: [dler] eliminate libPkgKeepDeps
    // in favor of filterDepsPatterns param
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
    "dist-libs": {},
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
    global: ["@types", "biome", "knip", "eslint", "prettier", "@reliverse/rse"],
    "dist-npm": [],
    "dist-jsr": ["+bun"],
    "dist-libs": {},
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

  // Remdn Configuration
  remdn: {
    title: "Directory Comparison",
    output: "docs/files.html",
    dirs: {
      src: {},
      "dist-npm/bin": {},
      "dist-jsr/bin": {},
      "dist-libs/sdk/npm/bin": {},
    },
    "ext-map": {
      ts: ["ts", "js-d.ts", "ts"], // [<main>, <dist-npm/bin | dist-libs's * npm/bin>, <dist-jsr | dist-libs's * jsr/bin>]
    },
  },

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
