import { resolve } from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { createJiti } from "jiti";

import type { DlerConfig } from "~/libs/sdk/sdk-impl/config/types";

import { defineConfigDler } from "~/libs/sdk/sdk-impl/config/default";

const CONFIG_FILENAME = ".config/dler.ts";

/**
 * Searches for and loads the configuration file `.config/dler.ts`.
 * Falls back to default configuration if the file is not found.
 * Uses jiti for seamless TypeScript and ESM support.
 */
export async function getConfigDler(): Promise<DlerConfig> {
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
          return defineConfigDler(result as Partial<DlerConfig>);
        }
      } else if (config && typeof config === "object") {
        // Handle case where user exports an object
        return defineConfigDler(config as Partial<DlerConfig>);
      }

      throw new Error("Invalid config format");
    } catch (error) {
      relinka("error", `Error loading config from ${configPath}:`, error);
      // Fall through to default config on error
    }
  }

  // Config file not found or error loading it, return default config
  relinka("log", `Config file not found at ${configPath}. Using default configuration.`);
  return defineConfigDler();
}
