import { relinka } from "@reliverse/relinka";
import fs from "fs-extra";
import path from "pathe";

import { DEFAULT_CONFIG } from "~/libs/cfg/cfg-default.js";

// Supported configuration filename
const CONFIG_FILENAME = ".config/dler.ts";

export async function initDlerConfig(isDev: boolean) {
  // Check if the config file already exists
  const configPath = path.resolve(process.cwd(), CONFIG_FILENAME);
  const configExists = await fs.pathExists(configPath);

  if (configExists) {
    // If it exists, no need to do anything.
    return;
  }

  // If it doesn't exist, create it.
  try {
    // Generate and write the config file
    const configContent = generateConfig(isDev);
    await fs.outputFile(configPath, configContent, "utf-8");
    relinka("success", `Config was created at ${configPath}`);
    relinka("info", "Edit this file to customize build and publish settings");
    if (!isDev) {
      relinka("info", "Please note: commonPubPause is set to true by default");
      relinka("info", "When you're ready, run `dler` to build and publish");
    } else {
      relinka("info", "When you're ready, run `bun pub` to build and publish");
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

// Generate the config file content
function generateConfig(isDev: boolean): string {
  const importDefineConfigStatement = isDev
    ? `import { defineConfig } from "../src/libs/cfg/cfg-main.js";`
    : `import { defineConfig } from "@reliverse/dler-cfg";`;
  const verboseValue = getValue(isDev, true, DEFAULT_CONFIG.commonVerbose);
  const isCLIValue = getValue(isDev, true, DEFAULT_CONFIG.coreIsCLI);
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
  const coreDeclarationsValue = getValue(
    isDev,
    false,
    DEFAULT_CONFIG.coreDeclarations,
  );
  const libsActModeValue = getValue(
    isDev,
    "main-and-libs",
    DEFAULT_CONFIG.libsActMode,
  );
  const libsObject = isDev
    ? `{
  "@reliverse/dler-cfg": {
    libDeclarations: true,
    libDescription: "@reliverse/dler defineConfig",
    libDirName: "cfg",
    libMainFile: "cfg/cfg-main.ts",
    libPkgKeepDeps: false,
    libTranspileMinify: true,
  },
  "@reliverse/dler-sdk": {
    libDeclarations: true,
    libDescription: "@reliverse/dler without cli",
    libDirName: "sdk",
    libMainFile: "sdk/sdk-main.ts",
    libPkgKeepDeps: true,
    libTranspileMinify: true,
  },
}`
    : `{
  // "@acme/cli-libName": {
  //   libDeclarations: true,
  //   libDescription: "@acme/cli defineConfig",
  //   libDirName: "libName",
  //   libMainFile: "libName/libName-main.ts",
  //   libPkgKeepDeps: true,
  //   libTranspileMinify: true,
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
  coreDeclarations: ${coreDeclarationsValue},
  coreEntryFile: "${DEFAULT_CONFIG.coreEntryFile}",
  coreEntrySrcDir: "${DEFAULT_CONFIG.coreEntrySrcDir}",
  coreIsCLI: ${isCLIValue},

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
  rmDepsMode: "${DEFAULT_CONFIG.rmDepsMode}",
  rmDepsPatterns: ${JSON.stringify(DEFAULT_CONFIG.rmDepsPatterns)},

  // Build setup
  transpileEsbuild: "${DEFAULT_CONFIG.transpileEsbuild}",
  transpileFormat: "${DEFAULT_CONFIG.transpileFormat}",
  transpileMinify: ${DEFAULT_CONFIG.transpileMinify},
  transpilePublicPath: "${DEFAULT_CONFIG.transpilePublicPath}",
  transpileSourcemap: "${DEFAULT_CONFIG.transpileSourcemap}",
  transpileSplitting: ${DEFAULT_CONFIG.transpileSplitting},
  transpileStub: ${DEFAULT_CONFIG.transpileStub},
  transpileTarget: "${DEFAULT_CONFIG.transpileTarget}",
  transpileWatch: ${DEFAULT_CONFIG.transpileWatch},
});
`;
  return configTemplate;
}

// Helper to choose a value based on the environment
function getValue<T>(isDev: boolean, devValue: T, prodValue: T): T {
  return isDev ? devValue : prodValue;
}
