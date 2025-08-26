import { isBunPM, runtimeInfo } from "@reliverse/runtime";
import type { DlerConfig } from "~/app/types/mod";
import { DEFAULT_DOMAIN, RSE_SCHEMA_URL, UNKNOWN_VALUE } from "./constants";

/**
 * Default configuration for the build and publish logic.
 */
export const DEFAULT_CONFIG_RELIVERSE: DlerConfig = {
  $schema: RSE_SCHEMA_URL,
  projectName: UNKNOWN_VALUE,
  projectAuthor: UNKNOWN_VALUE,
  projectDescription: UNKNOWN_VALUE,
  version: "0.1.0",
  projectLicense: "MIT",

  bumpDisable: false,
  bumpFilter: ["package.json", "reliverse.ts"],
  bumpMode: "patch",
  bumpSet: "",
  commonPubPause: true,
  commonPubRegistry: "npm",
  commonVerbose: false,
  displayBuildPubLogs: true,
  coreDeclarations: true,
  coreDescription: "",
  coreEntryFile: "mod.ts",
  coreEntrySrcDir: "src",
  coreBuildOutDir: "bin",
  coreIsCLI: { enabled: false, scripts: {} },
  distJsrAllowDirty: true,
  distJsrBuilder: "jsr",
  distJsrDirName: "dist-jsr",
  distJsrDryRun: false,
  distJsrFailOnWarn: false,
  distJsrGenTsconfig: false,
  distJsrOutFilesExt: "ts",
  distJsrSlowTypes: true,
  distNpmBuilder: "mkdist",
  distNpmDirName: "dist-npm",
  distNpmOutFilesExt: "js",
  libsActMode: "main-project-only",
  libsDirDist: "dist-libs",
  libsDirSrc: "src/libs",
  libsList: {},
  logsFileName: ".logs/relinka.log",
  logsFreshFile: true,

  // Dependency filtering
  filterDepsPatterns: {
    global: ["@types", "biome", "eslint", "knip", "prettier", "@reliverse/rse"],
    "dist-npm": [],
    "dist-jsr": [],
    "dist-libs": {},
  },

  // Code quality tools
  runBeforeBuild: [],
  runAfterBuild: [],

  // Build hooks
  hooksBeforeBuild: [
    // async () => {
    //   await someAsyncOperation();
    // }
  ],
  hooksAfterBuild: [
    // async () => {
    //   await someAsyncOperation();
    // }
  ],

  postBuildSettings: {
    deleteDistTmpAfterBuild: true,
  },

  // Build setup
  transpileFailOnWarn: false,
  transpileEsbuild: "es2023",
  transpileFormat: "esm",
  transpileMinify: true,
  transpilePublicPath: "/",
  transpileSourcemap: "none",
  transpileSplitting: false,
  transpileStub: false,
  transpileTarget: "node",
  transpileWatch: false,

  // Publish artifacts configuration
  publishArtifacts: {
    global: ["package.json", "README.md", "LICENSE"],
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

  // Integrated relinka logger configuration
  relinka: {
    verbose: false,
    dirs: {
      maxLogFiles: 5,
    },
    disableColors: false,
    logFile: {
      outputPath: "logs.log",
      nameWithDate: "disable",
      freshLogFile: true,
    },
    saveLogsToFile: true,
    timestamp: {
      enabled: false,
      format: "HH:mm:ss",
    },
    cleanupInterval: 10_000, // 10 seconds
    bufferSize: 4096, // 4KB
    maxBufferAge: 5000, // 5 seconds
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

  projectState: "creating",
  projectRepository: DEFAULT_DOMAIN,
  projectDomain: DEFAULT_DOMAIN,
  projectCategory: UNKNOWN_VALUE,
  projectSubcategory: UNKNOWN_VALUE,
  projectTemplate: UNKNOWN_VALUE,
  projectTemplateDate: UNKNOWN_VALUE,
  projectArchitecture: UNKNOWN_VALUE,
  repoPrivacy: UNKNOWN_VALUE,
  projectGitService: "github",
  projectDeployService: "vercel",
  repoBranch: "main",
  projectFramework: "nextjs",
  projectPackageManager: (await isBunPM()) ? "bun" : "npm",
  projectRuntime: (["node", "deno", "bun"].includes(runtimeInfo?.name ?? "")
    ? runtimeInfo?.name
    : "node") as "node" | "deno" | "bun",
  preferredLibraries: {
    stateManagement: UNKNOWN_VALUE,
    formManagement: UNKNOWN_VALUE,
    styling: UNKNOWN_VALUE,
    uiComponents: UNKNOWN_VALUE,
    testing: UNKNOWN_VALUE,
    authentication: UNKNOWN_VALUE,
    databaseLibrary: UNKNOWN_VALUE,
    databaseProvider: UNKNOWN_VALUE,
    api: UNKNOWN_VALUE,
    linting: UNKNOWN_VALUE,
    formatting: UNKNOWN_VALUE,
    payment: UNKNOWN_VALUE,
    analytics: UNKNOWN_VALUE,
    monitoring: UNKNOWN_VALUE,
    logging: UNKNOWN_VALUE,
    forms: UNKNOWN_VALUE,
    notifications: UNKNOWN_VALUE,
    search: UNKNOWN_VALUE,
    uploads: UNKNOWN_VALUE,
    validation: UNKNOWN_VALUE,
    documentation: UNKNOWN_VALUE,
    icons: UNKNOWN_VALUE,
    mail: UNKNOWN_VALUE,
    cache: UNKNOWN_VALUE,
    storage: UNKNOWN_VALUE,
    cdn: UNKNOWN_VALUE,
    cms: UNKNOWN_VALUE,
    i18n: UNKNOWN_VALUE,
    seo: UNKNOWN_VALUE,
    motion: UNKNOWN_VALUE,
    charts: UNKNOWN_VALUE,
    dates: UNKNOWN_VALUE,
    markdown: UNKNOWN_VALUE,
    security: UNKNOWN_VALUE,
    routing: UNKNOWN_VALUE,
  },
  monorepo: {
    type: "none",
    packages: [],
    sharedPackages: [],
  },
  ignoreDependencies: [],
  customRules: {},
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
    commands: [],
    webview: [],
    language: [],
    themes: [],
  },
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
    trailingComma: "all",
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
  multipleRepoCloneMode: false,
  customUserFocusedRepos: [],
  customDevsFocusedRepos: [],
  hideRepoSuggestions: false,
  customReposOnNewProject: false,
  envComposerOpenBrowser: true,
  skipPromptsUseAutoBehavior: false,
  deployBehavior: "prompt",
  depsBehavior: "prompt",
  gitBehavior: "prompt",
  i18nBehavior: "prompt",
  scriptsBehavior: "prompt",
  existingRepoBehavior: "prompt",
  relinterConfirm: "promptOnce",
};

export const defineConfig = (userConfig: Partial<DlerConfig> = {}) => {
  return { ...DEFAULT_CONFIG_RELIVERSE, ...userConfig };
};
