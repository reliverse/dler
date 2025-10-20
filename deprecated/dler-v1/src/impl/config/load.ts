import { resolve } from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { createJiti } from "jiti";
import type { ReliverseConfig } from "~/impl/schema/mod";
import { defineConfig } from "~/impl/schema/mod";

const CONFIG_FILENAME = "reliverse.ts";

/**
 * Searches for and loads the configuration file `reliverse.ts`.
 * Falls back to default configuration if the file is not found.
 * Uses jiti for seamless TypeScript and ESM support.
 */
export async function getConfigDler(): Promise<ReliverseConfig> {
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
          return defineConfig(result as Partial<ReliverseConfig>);
        }
      } else if (config && typeof config === "object") {
        // Handle case where user exports an object
        return defineConfig(config as Partial<ReliverseConfig>);
      }

      throw new Error("Invalid config format");
    } catch (error) {
      relinka("error", `Error loading config from ${configPath}:`, error);
      // Fall through to default config on error
    }
  }

  // Config file not found or error loading it, return default config
  relinka("verbose", `Config file not found at ${configPath}. Using default configuration.`);
  return defineConfig();
}

/**
 * Searches for and loads bunfig.toml configuration files.
 * Checks both local (project root) and global locations.
 * Merges configurations with local overriding global.
 *
 * @returns The merged bunfig configuration or null if no config found
 */
export async function getConfigBunfig(): Promise<Record<string, any> | null> {
  const cwd = process.cwd();
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;

  // Define search paths for bunfig files
  const localPaths = [resolve(cwd, "bunfig.toml"), resolve(cwd, ".bunfig.toml")];

  const globalPaths = [
    ...(homeDir ? [resolve(homeDir, ".bunfig.toml")] : []),
    ...(xdgConfigHome ? [resolve(xdgConfigHome, ".bunfig.toml")] : []),
  ];

  let globalConfig: Record<string, any> = {};
  let localConfig: Record<string, any> = {};

  // Load global configs first
  for (const configPath of globalPaths) {
    if (await fs.pathExists(configPath)) {
      try {
        const configContent = await fs.readFile(configPath, "utf-8");
        let config: Record<string, any>;

        if (typeof Bun !== "undefined") {
          // Use Bun's built-in TOML support
          config = Bun.TOML.parse(configContent);
        } else {
          // TOML parsing requires Bun runtime
          throw new Error(
            "TOML parsing requires Bun runtime. Please run with Bun to load bunfig.toml files.",
          );
        }

        globalConfig = { ...globalConfig, ...config };
        // relinka("verbose", `Loaded global bunfig from ${configPath}`);
      } catch (error) {
        relinka("error", `Error loading global bunfig from ${configPath}:`, error);
      }
    }
  }

  // Load local configs (these override global)
  for (const configPath of localPaths) {
    if (await fs.pathExists(configPath)) {
      try {
        const configContent = await fs.readFile(configPath, "utf-8");
        let config: Record<string, any>;

        if (typeof Bun !== "undefined") {
          // Use Bun's built-in TOML support
          config = Bun.TOML.parse(configContent);
        } else {
          // TOML parsing requires Bun runtime
          throw new Error(
            "TOML parsing requires Bun runtime. Please run with Bun to load bunfig.toml files.",
          );
        }

        localConfig = { ...localConfig, ...config };
        // relinka("verbose", `Loaded local bunfig from ${configPath}`);
        break; // Only load the first local config found
      } catch (error) {
        relinka("error", `Error loading local bunfig from ${configPath}:`, error);
      }
    }
  }

  // Shallow merge configs with local overriding global
  const mergedConfig = { ...globalConfig, ...localConfig };

  // Return null if no config was found
  if (Object.keys(mergedConfig).length === 0) {
    // relinka("verbose", "No bunfig.toml configuration found.");
    return null;
  }

  return mergedConfig;
}
