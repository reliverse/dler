import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { readPackageJSON } from "pkg-types";

import { DEFAULT_CONFIG_DLER } from "~/libs/sdk/sdk-impl/config/default";

// Supported configuration filename
const CONFIG_FILENAME = ".config/dler.ts";

export async function ensureDlerConfig(isDev: boolean) {
  // Check if the config file already exists
  const configPath = path.resolve(process.cwd(), CONFIG_FILENAME);
  const configExists = await fs.pathExists(configPath);

  // If it exists, no need to do anything.
  if (configExists) return;

  // If it doesn't exist, create it.
  try {
    // Read package.json description using pkg-types
    let pkgDescription: string | undefined = undefined;
    try {
      const pkg = await readPackageJSON();
      if (pkg && typeof pkg.description === "string" && pkg.description.trim()) {
        pkgDescription = pkg.description.trim();
      }
    } catch {
      // ignore, fallback to default
    }
    // Generate and write the config file
    const configContent = generateConfig(isDev, pkgDescription);
    await fs.outputFile(configPath, configContent, { encoding: "utf8" });
    relinka("success", `Config was created at ${configPath}`);
    relinka("log", "Edit this file to customize build and publish settings");
    if (!isDev) {
      relinka("log", "Please note: commonPubPause is set to true by default");
      relinka("log", "When you're ready, run `dler pub` to build and publish");
    } else {
      relinka("log", "When you're ready, run `bun pub` to build and publish");
    }
    process.exit(0);
  } catch (error: unknown) {
    relinka(
      "error",
      `Error creating configuration file: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

function getCoreIsCLI(isDev: boolean): string {
  return isDev
    ? `coreIsCLI: { enabled: true, scripts: { dler: "cli.ts" } },`
    : `// coreIsCLI: {
  // enabled: false,
  // scripts: { mycli: "mycli.ts" },
  // },`;
}

// Helper to choose a value based on the environment
function getValue<T>(isDev: boolean, devValue: T, prodValue: T): T {
  return isDev ? devValue : prodValue;
}

function getBumpFilter(isDev: boolean): string {
  return isDev
    ? `[
    "package.json",
    ".config/rse.ts",
    "src/libs/sdk/sdk-impl/config/info.ts",
  ]`
    : `["package.json", ".config/rse.ts"]`;
}

function getPublishArtifacts(isDev: boolean): string {
  return isDev
    ? `{
    global: ["package.json", "README.md", "LICENSE", "LICENSES"],
    "dist-jsr": [],
    "dist-npm": [],
    "dist-libs": {
      "@reliverse/dler-sdk": {
        jsr: [],
        npm: [],
      },
    },
  }`
    : `{
    global: ["package.json", "README.md", "LICENSE"],
    "dist-jsr": [],
    "dist-npm": [],
    "dist-libs": {},
  }`;
}

function getFilterDepsPatterns(isDev: boolean): string {
  return isDev
    ? `{
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
    },
  }`
    : `{
    global: [
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
    "dist-libs": {},
  }`;
}

// Generate the config file content
function generateConfig(isDev: boolean, pkgDescription?: string): string {
  const importDefineConfigDlerStatement = isDev
    ? `import { defineConfigDler } from "~/mod";`
    : `import { defineConfigDler } from "@reliverse/cfg";`;
  const verboseValue = getValue(isDev, true, DEFAULT_CONFIG_DLER.commonVerbose);
  const coreIsCLI = getCoreIsCLI(isDev);
  const registryValue = getValue(isDev, "npm-jsr", DEFAULT_CONFIG_DLER.commonPubRegistry);
  const pausePublishValue = getValue(isDev, false, DEFAULT_CONFIG_DLER.commonPubPause);
  const coreDescriptionValue = getValue(
    isDev,
    "dler (prev. relidler) is a flexible, unified, and fully automated bundler for TypeScript and JavaScript projects, as well as an NPM and JSR publishing tool.",
    pkgDescription || DEFAULT_CONFIG_DLER.coreDescription,
  );
  const libsActModeValue = getValue(isDev, "main-and-libs", DEFAULT_CONFIG_DLER.libsActMode);
  const libsObject = isDev
    ? `{
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
  "@reliverse/cfg": {
    libDeclarations: true,
    libDescription: "shared config for @reliverse/dler (defineConfigDler) and @reliverse/rse (defineConfigRse)",
    libDirName: "cfg",
    libMainFile: "cfg/cfg-mod.ts",
    libPkgKeepDeps: true,
    libTranspileMinify: true,
    libPubPause: false,
    libPubRegistry: "npm-jsr",
  },
}`
    : `{
  // "@acme/cli-libName": {
  //   libDeclarations: true,
  //   libDescription: "@acme/cli defineConfigAcme",
  //   libDirName: "libName",
  //   libMainFile: "libName/libName-mod.ts",
  //   libPkgKeepDeps: true,
  //   libTranspileMinify: true,
  //   libPubPause: false,
  //   libPubRegistry: "npm",
  // },
}`;

  // ===================================================
  // .config/dler.ts default config template
  // ===================================================
  const configTemplate = [
    importDefineConfigDlerStatement,
    "",
    "/**",
    " * Reliverse Bundler Configuration",
    " * Hover over a field to see more details",
    " * @see https://github.com/reliverse/dler",
    " */",
    "export default defineConfigDler({",
    "  // Bump configuration",
    "  bumpDisable: " + DEFAULT_CONFIG_DLER.bumpDisable + ",",
    "  bumpFilter: " + getBumpFilter(isDev) + ",",
    '  bumpMode: "' + DEFAULT_CONFIG_DLER.bumpMode + '",',
    "",
    "  // Common configuration",
    "  commonPubPause: " + pausePublishValue + ",",
    '  commonPubRegistry: "' + registryValue + '",',
    "  commonVerbose: " + verboseValue + ",",
    "",
    "  // Core configuration",
    '  coreBuildOutDir: "' + DEFAULT_CONFIG_DLER.coreBuildOutDir + '",',
    "  coreDeclarations: " + DEFAULT_CONFIG_DLER.coreDeclarations + ",",
    "  coreDescription: " + JSON.stringify(coreDescriptionValue) + ",",
    '  coreEntryFile: "' + DEFAULT_CONFIG_DLER.coreEntryFile + '",',
    '  coreEntrySrcDir: "' + DEFAULT_CONFIG_DLER.coreEntrySrcDir + '",',
    "  " + coreIsCLI,
    "",
    "  // JSR-only config",
    "  distJsrAllowDirty: " + DEFAULT_CONFIG_DLER.distJsrAllowDirty + ",",
    '  distJsrBuilder: "' + DEFAULT_CONFIG_DLER.distJsrBuilder + '",',
    '  distJsrDirName: "' + DEFAULT_CONFIG_DLER.distJsrDirName + '",',
    "  distJsrDryRun: " + DEFAULT_CONFIG_DLER.distJsrDryRun + ",",
    "  distJsrFailOnWarn: " + DEFAULT_CONFIG_DLER.distJsrFailOnWarn + ",",
    "  distJsrGenTsconfig: " + DEFAULT_CONFIG_DLER.distJsrGenTsconfig + ",",
    '  distJsrOutFilesExt: "' + DEFAULT_CONFIG_DLER.distJsrOutFilesExt + '",',
    "  distJsrSlowTypes: " + DEFAULT_CONFIG_DLER.distJsrSlowTypes + ",",
    "",
    "  // NPM-only config",
    '  distNpmBuilder: "' + DEFAULT_CONFIG_DLER.distNpmBuilder + '",',
    '  distNpmDirName: "' + DEFAULT_CONFIG_DLER.distNpmDirName + '",',
    '  distNpmOutFilesExt: "' + DEFAULT_CONFIG_DLER.distNpmOutFilesExt + '",',
    "",
    "  // Libraries Dler Plugin",
    "  // Publish specific dirs as separate packages",
    "  // This feature is experimental at the moment",
    "  // Please commit your changes before using it",
    '  libsActMode: "' + libsActModeValue + '",',
    '  libsDirDist: "' + DEFAULT_CONFIG_DLER.libsDirDist + '",',
    '  libsDirSrc: "' + DEFAULT_CONFIG_DLER.libsDirSrc + '",',
    "  libsList: " + libsObject + ",",
    "",
    "  // @reliverse/relinka logger setup",
    '  logsFileName: "' + DEFAULT_CONFIG_DLER.logsFileName + '",',
    "  logsFreshFile: " + DEFAULT_CONFIG_DLER.logsFreshFile + ",",
    "",
    "  // Specifies what resources to send to npm and jsr registries.",
    '  // coreBuildOutDir (e.g. "bin") dir is automatically included.',
    "  // The following is also included if publishArtifacts is {}:",
    '  // - global: ["package.json", "README.md", "LICENSE"]',
    '  // - dist-jsr,dist-libs/jsr: ["jsr.json"]',
    "  publishArtifacts: " + getPublishArtifacts(isDev) + ",",
    "",
    "  // Files with these extensions will be built",
    "  // Any other files will be copied as-is to dist",
    '  buildPreExtensions: ["ts", "js"],',
    "  // If you need to exclude some ts/js files from being built,",
    "  // you can store them in the dirs with buildTemplatesDir name",
    '  buildTemplatesDir: "templates",',
    "",
    "  // Dependency filtering",
    "  // Global is always applied",
    "  filterDepsPatterns: " + getFilterDepsPatterns(isDev) + ",",
    "",
    "  // Code quality tools",
    "  // Available: tsc, eslint, biome, knip, dler-check",
    "  runBeforeBuild: [],",
    "  // Available: dler-check",
    "  runAfterBuild: [],",
    "",
    "  // Build hooks",
    "  hooksBeforeBuild: [",
    "    // async () => {",
    "    //   await someAsyncOperation();",
    "    // }",
    "  ],",
    "  hooksAfterBuild: [",
    "    // async () => {",
    "    //   await someAsyncOperation();",
    "    // }",
    "  ],",
    "",
    "  postBuildSettings: {",
    "    cleanupTempDirs: true,",
    "  },",
    "",
    "  // Build setup",
    "  // transpileAlias: {},",
    "  // transpileClean: true,",
    "  // transpileEntries: [],",
    '  transpileEsbuild: "' + DEFAULT_CONFIG_DLER.transpileEsbuild + '",',
    "  // transpileExternals: [],",
    "  transpileFailOnWarn: " + DEFAULT_CONFIG_DLER.transpileFailOnWarn + ",",
    '  transpileFormat: "' + DEFAULT_CONFIG_DLER.transpileFormat + '",',
    "  transpileMinify: " + DEFAULT_CONFIG_DLER.transpileMinify + ",",
    "  // transpileParallel: false,",
    '  transpilePublicPath: "' + DEFAULT_CONFIG_DLER.transpilePublicPath + '",',
    "  // transpileReplace: {},",
    "  // transpileRollup: {",
    "  //   alias: {},",
    "  //   commonjs: {},",
    "  //   dts: {},",
    "  //   esbuild: {},",
    "  //   json: {},",
    "  //   replace: {},",
    "  //   resolve: {},",
    "  // },",
    "  // transpileShowOutLog: false,",
    '  transpileSourcemap: "' + DEFAULT_CONFIG_DLER.transpileSourcemap + '",',
    "  transpileSplitting: " + DEFAULT_CONFIG_DLER.transpileSplitting + ",",
    "  transpileStub: " + DEFAULT_CONFIG_DLER.transpileStub + ",",
    "  // transpileStubOptions: { jiti: {} },",
    '  transpileTarget: "' + DEFAULT_CONFIG_DLER.transpileTarget + '",',
    "  transpileWatch: " + DEFAULT_CONFIG_DLER.transpileWatch + ",",
    "  // transpileWatchOptions: undefined,",
    "});",
  ].join("\n");
  return configTemplate;
}
