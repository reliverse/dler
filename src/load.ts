import { relinka } from "@reliverse/relinka";
import fs from "fs-extra";
import { resolve } from "node:path";

import type { BuildPublishConfig } from "~/libs/sdk/sdk-types.js";

import { defineConfig } from "~/libs/cfg/cfg-mod.js";

const CONFIG_FILENAME = ".config/dler.ts";

/**
 * Searches for and loads the configuration file `.config/dler.ts`.
 * Falls back to default configuration if the file is not found.
 */
export async function loadConfig(): Promise<BuildPublishConfig> {
  const cwd = process.cwd();
  const configPath = resolve(cwd, CONFIG_FILENAME);

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
      // Fall through to default config on error
    }
  }

  // Config file not found or error loading it, return default config
  relinka(
    "log",
    `Config file not found at ${configPath}. Using default configuration.`, // Inform user about fallback
  );
  return defineConfig();
}
