import { relinka } from "@reliverse/relinka";
import fs from "fs-extra";
import { resolve } from "node:path";

import type { BuildPublishConfig } from "~/libs/sdk/sdk-types.js";

import { defineConfig } from "~/libs/cfg/cfg-mod.js";

/**
 * Searches for and loads a configuration file in the current dir.
 * Falls back to default configuration if no config file is found.
 */
export async function loadConfig(): Promise<BuildPublishConfig> {
  const cwd = process.cwd();
  const configFileNames = [
    "relidler.cfg.ts",
    "build.pub.ts",
    "build.cfg.ts",
    "relidler.config.ts",
  ];

  // Try to find a config file
  for (const fileName of configFileNames) {
    const configPath = resolve(cwd, fileName);

    if (await fs.pathExists(configPath)) {
      try {
        // Dynamic import (works with both ESM and CJS)
        const configModule = await import(`file://${configPath}`);
        const config = configModule.default || configModule;

        if (typeof config === "function") {
          // Handle case where user exports a function
          return defineConfig(config());
        }
        // Handle case where user exports an object
        return defineConfig(config);
      } catch (error) {
        relinka("error", `Error loading config from ${configPath}:`, error);
        // Continue to next file on error
      }
    }
  }

  // No config file found, return default config
  return defineConfig();
}
