import fs from "fs-extra";
import path from "pathe";

import { DEFAULT_CONFIG } from "~/libs/cfg/cfg-default.js";
import { relinka } from "~/utils.js";

// Supported configuration filenames
const CONFIG_FILENAMES = [
  "relidler.cfg.ts",
  "relidler.config.ts",
  "build.cfg.ts",
  "build.pub.ts",
];

// Helper to choose a value based on the environment
function getValue<T>(isDev: boolean, devValue: T, prodValue: T): T {
  return isDev ? devValue : prodValue;
}

// Generate the config file content
function generateConfig(isDev: boolean): string {
  const importDefineConfigStatement = isDev
    ? `import { defineConfig } from "./src/libs/cfg/cfg-main.js";`
    : `// @ts-expect-error coming soon
import { defineConfig } from "@reliverse/relidler-cfg";`;
  const verboseValue = getValue(isDev, true, DEFAULT_CONFIG.verbose);
  const isCLIValue = getValue(isDev, true, DEFAULT_CONFIG.isCLI);
  const pausePublishValue = getValue(isDev, false, DEFAULT_CONFIG.pausePublish);
  const npmDeclarationsValue = getValue(
    isDev,
    false,
    DEFAULT_CONFIG.npmDeclarations,
  );
  const buildPublishModeValue = getValue(
    isDev,
    "main-project-only",
    DEFAULT_CONFIG.buildPublishMode,
  );
  const libsObject = isDev
    ? `{
  "@reliverse/relidler-cfg": {
    main: "cfg/cfg-main.ts",
    subDistDir: "cfg",
    description: "@reliverse/relidler defineConfig",
    dependencies: ["pathe"],
    minify: false,
    npmDeclarations: true,
  },
  "@reliverse/relidler-sdk": {
    main: "sdk/sdk-main.ts",
    subDistDir: "sdk",
    description: "@reliverse/relidler without cli",
    dependencies: true,
    minify: true,
    npmDeclarations: true,
  },
}`
    : `{
  // "@org/cli-libName": {
  //   main: "libName/libName-main.ts",
  //   subDistDir: "libName",
  //   description: "@org/cli defineConfig",
  //   dependencies: true,
  //   minify: false,
  //   npmDeclarations: true,
  // },
}`;

  // ===================================================
  // relidler.cfg.ts default config template
  // ===================================================
  const configTemplate = `${importDefineConfigStatement}

/**
 * Reliverse Bundler Configuration
 * Hover over a field to see more details
 * @see https://github.com/reliverse/relidler
 */
export default defineConfig({
  // Common configuration
  entryFile: "${DEFAULT_CONFIG.entryFile}",
  entrySrcDir: "${DEFAULT_CONFIG.entrySrcDir}",
  verbose: ${verboseValue},
  isCLI: ${isCLIValue},

  // Publishing options
  registry: "${DEFAULT_CONFIG.registry}",
  pausePublish: ${pausePublishValue},
  dryRun: ${DEFAULT_CONFIG.dryRun},

  // Versioning options
  bumpMode: "${DEFAULT_CONFIG.bumpMode}",
  disableBump: ${DEFAULT_CONFIG.disableBump},
  bumpFilter: ${JSON.stringify(DEFAULT_CONFIG.bumpFilter)},

  // NPM-only config
  npmDistDir: "${DEFAULT_CONFIG.npmDistDir}",
  npmBuilder: "${DEFAULT_CONFIG.npmBuilder}",
  npmOutFilesExt: "${DEFAULT_CONFIG.npmOutFilesExt}",
  npmDeclarations: ${npmDeclarationsValue},
  npmCopyRootFiles: ${JSON.stringify(DEFAULT_CONFIG.npmCopyRootFiles)},

  // JSR-only config
  jsrDistDir: "${DEFAULT_CONFIG.jsrDistDir}",
  jsrBuilder: "${DEFAULT_CONFIG.jsrBuilder}",
  jsrSlowTypes: ${DEFAULT_CONFIG.jsrSlowTypes},
  jsrAllowDirty: ${DEFAULT_CONFIG.jsrAllowDirty},
  jsrGenTsconfig: ${DEFAULT_CONFIG.jsrGenTsconfig},
  jsrCopyRootFiles: ${JSON.stringify(DEFAULT_CONFIG.jsrCopyRootFiles)},

  // Build setup
  minify: ${DEFAULT_CONFIG.minify},
  splitting: ${DEFAULT_CONFIG.splitting},
  sourcemap: "${DEFAULT_CONFIG.sourcemap}",
  stub: ${DEFAULT_CONFIG.stub},
  watch: ${DEFAULT_CONFIG.watch},
  esbuild: "${DEFAULT_CONFIG.esbuild}",
  publicPath: "${DEFAULT_CONFIG.publicPath}",
  target: "${DEFAULT_CONFIG.target}",
  format: "${DEFAULT_CONFIG.format}",

  // Logger options
  freshLogFile: ${DEFAULT_CONFIG.freshLogFile},
  logFile: "${DEFAULT_CONFIG.logFile}",

  // Dependency filtering
  excludeMode: "${DEFAULT_CONFIG.excludeMode}",
  excludedDependencyPatterns: ${JSON.stringify(
    DEFAULT_CONFIG.excludedDependencyPatterns,
  )},

  // Libraries Relidler Plugin
  // Publish specific dirs as separate packages
  // This feature is experimental at the moment
  // Please commit your changes before using it
  buildPublishMode: "${buildPublishModeValue}",
  libsDistDir: "${DEFAULT_CONFIG.libsDistDir}",
  libsSrcDir: "${DEFAULT_CONFIG.libsSrcDir}",
  libs: ${libsObject},
});
`;
  return configTemplate;
}

async function findExistingConfig() {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.resolve(process.cwd(), filename);
    if (await fs.pathExists(configPath)) {
      return configPath;
    }
  }
  return null;
}

export async function initRelidlerConfig(isDev: boolean) {
  // Check if any of the supported config files already exist
  const existingConfigPath = await findExistingConfig();
  if (existingConfigPath) {
    return;
  }

  // Default to the first config filename if none exists
  const configFilename = CONFIG_FILENAMES[0];
  const configPath = path.resolve(process.cwd(), configFilename);

  try {
    // Generate and write the config file
    const configContent = generateConfig(isDev);
    await fs.outputFile(configPath, configContent, "utf-8");
    relinka("success", `Config was created at ${configPath}`);
    relinka("info", "Edit this file to customize build and publish settings");
    if (!isDev) {
      relinka("info", "Please note: pausePublish is set to false by default");
      relinka("info", "When you're ready, run `relidler` to build and publish");
    } else {
      relinka("info", "When you're ready, run `bun pub` to build and publish");
    }
    process.exit(0); // ✅
  } catch (error: any) {
    relinka(
      "error",
      `Error creating configuration file: ${error.message || error}`,
    );
    process.exit(1); // ❌
  }
}
