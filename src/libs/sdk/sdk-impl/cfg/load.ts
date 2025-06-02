import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { createJiti } from "jiti";
import { resolve } from "node:path";

import type { DlerConfig } from "~/libs/sdk/sdk-types";

import { defineConfig } from "~/libs/sdk/sdk-impl/cfg/define";

const CONFIG_FILENAME = ".config/dler.ts";

/**
 * Searches for and loads the configuration file `.config/dler.ts`.
 * Falls back to default configuration if the file is not found.
 * Uses jiti for seamless TypeScript and ESM support.
 */
export async function loadConfig(): Promise<DlerConfig> {
  const cwd = process.cwd();
  const configPath = resolve(cwd, CONFIG_FILENAME);

  if (await fs.pathExists(configPath)) {
    try {
      // Initialize jiti instance
      const jiti = createJiti(import.meta.url, {
        debug: process.env.NODE_ENV === "development",
        fsCache: true,
        sourceMaps: true,
      });

      // Import config using jiti
      const config = await jiti.import(configPath, { default: true });

      if (typeof config === "function") {
        // Handle case where user exports a function
        const result = config();
        if (result && typeof result === "object") {
          return defineConfig(result as Partial<DlerConfig>);
        }
      } else if (config && typeof config === "object") {
        // Handle case where user exports an object
        return defineConfig(config as Partial<DlerConfig>);
      }

      throw new Error("Invalid config format");
    } catch (error) {
      relinka("error", `Error loading config from ${configPath}:`, error);
      // Fall through to default config on error
    }
  }

  // Config file not found or error loading it, return default config
  relinka("log", `Config file not found at ${configPath}. Using default configuration.`);
  return defineConfig();
}
