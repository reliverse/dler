import { defineCommand } from "@reliverse/prompts";
import fs from "fs-extra";
import path from "pathe";

import { DEFAULT_CONFIG } from "~/libs/cfg/cfg-default.js";
import { relinka } from "~/utils.js";

// Helper to choose a value based on the environment
function getValue<T>(isDev: boolean, devValue: T, prodValue: T): T {
  return isDev ? devValue : prodValue;
}

// Constant for configuration file name
const CONFIG_FILE_NAME = "relidler.cfg.ts";

function generateConfig(isDev: boolean): string {
  const importDefineConfigStatement = isDev
    ? `import { defineConfig } from "./src/libs/cfg/cfg-main.js";`
    : `// @ts-expect-error coming soon
import { defineConfig } from "@reliverse/relidler";`;
  const verboseValue = getValue(isDev, true, false);
  const isCLIValue = getValue(isDev, true, false);
  const npmDeclarationsValue = getValue(isDev, false, true);
  const jsrSlowTypesValue = getValue(isDev, true, false);
  const jsrAllowDirtyValue = getValue(isDev, true, false);

  const pausePublishValue = getValue(isDev, false, DEFAULT_CONFIG.pausePublish); // (?)
  const disableBumpValue = getValue(isDev, false, DEFAULT_CONFIG.disableBump); // (?)

  const buildPublishModeValue = getValue(
    isDev,
    "main-project-only",
    DEFAULT_CONFIG.buildPublishMode,
  );
  const libsObject = isDev
    ? `{
  "@reliverse/relidler-cfg": {
    main: "src/libs/cfg/cfg-main.ts",
    description: "@reliverse/relidler defineConfig",
    dependencies: ["pathe"]
  },
  "@reliverse/relidler-sdk": {
    main: "src/libs/sdk/sdk-main.ts",
    description: "@reliverse/relidler without cli",
    dependencies: true
  }
}`
    : `{}`;

  // Format the excluded dependency patterns array
  const excludedDependencyPatternsValue = JSON.stringify(
    DEFAULT_CONFIG.excludedDependencyPatterns,
  );

  /**
   * relidler.cfg.ts config template
   */
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
  bump: "${DEFAULT_CONFIG.bump}",
  disableBump: ${disableBumpValue},

  // NPM-only config
  npmDistDir: "${DEFAULT_CONFIG.npmDistDir}",
  npmBuilder: "${DEFAULT_CONFIG.npmBuilder}",
  npmOutFilesExt: "${DEFAULT_CONFIG.npmOutFilesExt}",
  npmDeclarations: ${npmDeclarationsValue},

  // JSR-only config
  jsrDistDir: "${DEFAULT_CONFIG.jsrDistDir}",
  jsrBuilder: "${DEFAULT_CONFIG.jsrBuilder}",
  jsrSlowTypes: ${jsrSlowTypesValue},
  jsrAllowDirty: ${jsrAllowDirtyValue},

  // Build optimization
  shouldMinify: ${DEFAULT_CONFIG.shouldMinify},
  splitting: ${DEFAULT_CONFIG.splitting},
  sourcemap: "${DEFAULT_CONFIG.sourcemap}",
  esbuild: "${DEFAULT_CONFIG.esbuild}",
  publicPath: "${DEFAULT_CONFIG.publicPath}",
  target: "${DEFAULT_CONFIG.target}",
  format: "${DEFAULT_CONFIG.format}",

  // Dependency filtering
  excludedDependencyPatterns: ${excludedDependencyPatternsValue},

  // Publish specific dirs as separate packages
  // This feature is experimental at the moment
  // Please commit your changes before using it
  buildPublishMode: "${buildPublishModeValue}",
  libs: ${libsObject},
});
`;

  return configTemplate;
}

export default defineCommand({
  meta: {
    name: "init",
    description: "Initializes a new relidler.cfg.ts",
  },
  args: {
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
      required: false,
    },
  },
  run: async ({ args }) => {
    // Get the dev flag
    const isDev = args.dev;

    // Get the config path
    const configPath = path.resolve(process.cwd(), CONFIG_FILE_NAME);

    // Check if the config file already exists
    if (await fs.pathExists(configPath)) {
      relinka("warn", `Configuration file already exists at ${configPath}`);
      relinka(
        "info",
        "To overwrite, delete the existing file and run init again.",
      );
      return;
    }

    try {
      // Generate and write the config file
      const configContent = generateConfig(isDev);
      await fs.outputFile(configPath, configContent, "utf-8");

      relinka("success", `Configuration file created at ${configPath}`);
      relinka(
        "info",
        "Edit this file to customize your build and publish settings",
      );
    } catch (error: any) {
      relinka(
        "error",
        `Failed to create configuration file: ${error.message || error}`,
      );
      process.exit(1);
    }
  },
});
