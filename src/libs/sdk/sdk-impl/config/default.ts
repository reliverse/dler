import type { DlerConfig } from "~/libs/sdk/sdk-impl/config/types";

/**
 * Default configuration for the build and publish logic.
 */
export const DEFAULT_CONFIG_DLER: DlerConfig = {
  bumpDisable: false,
  bumpFilter: ["package.json", ".config/rse.ts"],
  bumpMode: "patch",
  bumpSet: "",
  commonPubPause: true,
  commonPubRegistry: "npm",
  commonVerbose: false,
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
    global: ["@types", "biome", "eslint", "knip", "prettier", "typescript", "@reliverse/dler"],
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

  // Build file handling configuration
  buildPreExtensions: ["ts", "js"],
  buildTemplatesDir: "templates",
};

// TODO: implement migrator from build.config.ts to .config/dler.ts
// export function defineBuildConfig(
//   config: UnifiedBuildConfig | UnifiedBuildConfig[],
// ): UnifiedBuildConfig[] {
//   return (Array.isArray(config) ? config : [config]).filter(Boolean);
// }

export const defineConfigDler = (userConfig: Partial<DlerConfig> = {}) => {
  return { ...DEFAULT_CONFIG_DLER, ...userConfig };
};
