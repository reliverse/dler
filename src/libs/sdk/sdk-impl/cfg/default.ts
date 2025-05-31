import type { DlerConfig } from "~/libs/sdk/sdk-types";

/**
 * Default configuration for the build and publish logic.
 */
export const DEFAULT_CONFIG: DlerConfig = {
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
  coreIsCLI: {
    enabled: false,
    scripts: {},
  },
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
    global: [
      "@types",
      "biome",
      "eslint",
      "knip",
      "prettier",
      "typescript",
      "@reliverse/dler",
    ],
    "dist-npm": [],
    "dist-jsr": [],
    "dist-libs": {
      "@reliverse/dler-sdk": {
        npm: [],
        jsr: [],
      },
    },
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
    "dist-jsr": ["jsr.json"],
    "dist-npm": [],
    "dist-libs": {
      "@reliverse/dler-sdk": {
        jsr: ["jsr.json"],
        npm: [],
      },
    },
  },
};
