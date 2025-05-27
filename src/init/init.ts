import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { readPackageJSON } from "pkg-types";

import { DEFAULT_CONFIG } from "~/libs/sdk/default";

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
      if (
        pkg &&
        typeof pkg.description === "string" &&
        pkg.description.trim()
      ) {
        pkgDescription = pkg.description.trim();
      }
    } catch {
      // ignore, fallback to default
    }
    // Generate and write the config file
    const configContent = generateConfig(isDev, pkgDescription);
    await fs.outputFile(configPath, configContent, "utf-8");
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
    ? `coreIsCLI: {
        enabled: true,
        scripts: { dler: "dler.ts" },
      },`
    : `// coreIsCLI: {
  // enabled: false,
  // scripts: { mycli: "mycli.ts" },
  // },`;
}

// Generate the config file content
function generateConfig(isDev: boolean, pkgDescription?: string): string {
  const importDefineConfigStatement = isDev
    ? `import { defineConfig } from "~/mod";`
    : `import { defineConfig } from "@reliverse/dler";`;
  const verboseValue = getValue(isDev, true, DEFAULT_CONFIG.commonVerbose);
  const coreIsCLI = getCoreIsCLI(isDev);
  const registryValue = getValue(
    isDev,
    "npm-jsr",
    DEFAULT_CONFIG.commonPubRegistry,
  );
  const pausePublishValue = getValue(
    isDev,
    false,
    DEFAULT_CONFIG.commonPubPause,
  );
  const coreDescriptionValue = getValue(
    isDev, // TODO: remove `description` from dler's `package.json` when ensured that whole dler's codebase can optionally read dler.ts' `coreDescription`
    "dler (prev. relidler) is a flexible, unified, and fully automated bundler for TypeScript and JavaScript projects, as well as an NPM and JSR publishing tool.",
    pkgDescription || DEFAULT_CONFIG.coreDescription,
  );
  const libsActModeValue = getValue(
    isDev,
    "main-and-libs",
    DEFAULT_CONFIG.libsActMode,
  );
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
  },
}`
    : `{
  // "@acme/cli-libName": {
  //   libDeclarations: true,
  //   libDescription: "@acme/cli defineConfig",
  //   libDirName: "libName",
  //   libMainFile: "libName/libName-mod.ts",
  //   libPkgKeepDeps: true,
  //   libTranspileMinify: true,
  //   libPubPause: false,
  // },
}`;

  // ===================================================
  // .config/dler.ts default config template
  // ===================================================
  const configTemplate = `${importDefineConfigStatement}

/**
 * Reliverse Bundler Configuration
 * Hover over a field to see more details
 * @see https://github.com/reliverse/dler
 */
export default defineConfig({
  // Bump configuration
  bumpDisable: ${DEFAULT_CONFIG.bumpDisable},
  bumpFilter: ${JSON.stringify(DEFAULT_CONFIG.bumpFilter)},
  bumpMode: "${DEFAULT_CONFIG.bumpMode}",
  
  // Common configuration
  commonPubPause: ${pausePublishValue},
  commonPubRegistry: "${registryValue}",
  commonVerbose: ${verboseValue},

  // Core configuration
  coreDeclarations: ${DEFAULT_CONFIG.coreDeclarations},
  coreDescription: ${JSON.stringify(coreDescriptionValue)},
  coreEntryFile: "${DEFAULT_CONFIG.coreEntryFile}",
  coreEntrySrcDir: "${DEFAULT_CONFIG.coreEntrySrcDir}",
  coreBuildOutDir: "${DEFAULT_CONFIG.coreBuildOutDir}",
  ${coreIsCLI}

  // JSR-only config
  distJsrAllowDirty: ${DEFAULT_CONFIG.distJsrAllowDirty},
  distJsrBuilder: "${DEFAULT_CONFIG.distJsrBuilder}",
  distJsrCopyRootFiles: ${JSON.stringify(DEFAULT_CONFIG.distJsrCopyRootFiles)},
  distJsrDirName: "${DEFAULT_CONFIG.distJsrDirName}",
  distJsrDryRun: ${DEFAULT_CONFIG.distJsrDryRun},
  distJsrFailOnWarn: ${DEFAULT_CONFIG.distJsrFailOnWarn},
  distJsrGenTsconfig: ${DEFAULT_CONFIG.distJsrGenTsconfig},
  distJsrOutFilesExt: "${DEFAULT_CONFIG.distJsrOutFilesExt}",
  distJsrSlowTypes: ${DEFAULT_CONFIG.distJsrSlowTypes},

  // NPM-only config
  distNpmBuilder: "${DEFAULT_CONFIG.distNpmBuilder}",
  distNpmCopyRootFiles: ${JSON.stringify(DEFAULT_CONFIG.distNpmCopyRootFiles)},
  distNpmDirName: "${DEFAULT_CONFIG.distNpmDirName}",
  distNpmOutFilesExt: "${DEFAULT_CONFIG.distNpmOutFilesExt}",

  // Libraries Dler Plugin
  // Publish specific dirs as separate packages
  // This feature is experimental at the moment
  // Please commit your changes before using it
  libsActMode: "${libsActModeValue}",
  libsDirDist: "${DEFAULT_CONFIG.libsDirDist}",
  libsDirSrc: "${DEFAULT_CONFIG.libsDirSrc}",
  libsList: ${libsObject},

  // Logger setup
  logsFileName: "${DEFAULT_CONFIG.logsFileName}",
  logsFreshFile: ${DEFAULT_CONFIG.logsFreshFile},

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
  transpileFailOnWarn: ${DEFAULT_CONFIG.transpileFailOnWarn},
  transpileEsbuild: "${DEFAULT_CONFIG.transpileEsbuild}",
  transpileFormat: "${DEFAULT_CONFIG.transpileFormat}",
  transpileMinify: ${DEFAULT_CONFIG.transpileMinify},
  transpilePublicPath: "${DEFAULT_CONFIG.transpilePublicPath}",
  transpileSourcemap: "${DEFAULT_CONFIG.transpileSourcemap}",
  transpileSplitting: ${DEFAULT_CONFIG.transpileSplitting},
  transpileStub: ${DEFAULT_CONFIG.transpileStub},
  transpileTarget: "${DEFAULT_CONFIG.transpileTarget}",
  transpileWatch: ${DEFAULT_CONFIG.transpileWatch},
  transpileAlias: {},
  transpileEntries: [],
  transpileExternals: [],
  transpileClean: true,
  transpileParallel: false,
  transpileReplace: {},
  transpileRollup: {
    alias: {},
    commonjs: {},
    dts: {},
    esbuild: {},
    json: {},
    replace: {},
    resolve: {},
  },
  transpileShowOutLog: false,
  transpileStubOptions: {
    jiti: {},
  },
  transpileWatchOptions: undefined,
});
`;
  return configTemplate;
}

// Helper to choose a value based on the environment
function getValue<T>(isDev: boolean, devValue: T, prodValue: T): T {
  return isDev ? devValue : prodValue;
}
