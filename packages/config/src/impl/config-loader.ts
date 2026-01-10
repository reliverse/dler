import { existsSync } from "node:fs";
import path from "node:path";
import { remptsConfigSchema } from "@reliverse/rempts-core";
import type { BuildConfig } from "./build";
import type { PublishConfig } from "./publish";

// Type for loaded config with defaults applied by @reliverse/rempts schema
// Note: The build field is overridden to use the extended BuildConfig instead of the simple @reliverse/rempts build config
export interface LoadedConfig {
  name?: string;
  version?: string;
  description?: string;
  commands?: {
    manifest?: string;
    directory?: string;
    generateReport?: boolean;
  };
  // Extended build configuration supporting all build types (libraries, browser apps, native apps, CLIs)
  // with per-package configuration (global, packages, patterns)
  build?: BuildConfig;
  dev: {
    watch: boolean; // Always has default true
    inspect: boolean; // Always has default false
    port?: number;
  };
  test: {
    pattern: string | string[]; // Always has default ['**/*.test.ts', '**/*.spec.ts']
    coverage: boolean; // Always has default false
    watch: boolean; // Always has default false
  };
  workspace: {
    packages?: string[];
    shared?: any;
    versionStrategy: "fixed" | "independent"; // Always has default 'fixed'
  };
  release: {
    npm: boolean; // Always has default true
    github: boolean; // Always has default false
    tagFormat: string; // Always has default 'v{{version}}'
    conventionalCommits: boolean; // Always has default true
  };
  plugins: any[]; // Always has default []

  // Publish configuration with per-package support
  publish?: PublishConfig;
}

// Config file names to search for
const CONFIG_NAMES = ["dler.config.ts", "dler.config.js", "dler.config.mjs"];

/**
 * Transform simple build config to extended BuildConfig format
 */
function transformBuildConfig(build: any): BuildConfig | undefined {
  if (!build) {
    return undefined;
  }

  // If it's already in extended format (has global, packages, or patterns), return as-is
  if (build.global || build.packages || build.patterns) {
    return build as BuildConfig;
  }

  // Transform simple build config to extended format
  return {
    global: build,
  };
}

export async function loadConfig(cwd = process.cwd()): Promise<LoadedConfig> {
  // Look for config file
  for (const configName of CONFIG_NAMES) {
    const configPath = path.join(cwd, configName);
    if (existsSync(configPath)) {
      try {
        const module = await import(configPath);
        // Arktype assert automatically validates and applies defaults
        const validatedConfig = remptsConfigSchema.assert(module.default || module) as any;

        // Transform the config to use extended BuildConfig format
        // The @reliverse/rempts schema applies defaults, so these fields should always be present
        const config: LoadedConfig = {
          ...validatedConfig,
          build: transformBuildConfig(validatedConfig.build),
          dev: validatedConfig.dev ?? { watch: true, inspect: false },
          test: validatedConfig.test ?? {
            pattern: ["**/*.test.ts", "**/*.spec.ts"],
            coverage: false,
            watch: false,
          },
          workspace: validatedConfig.workspace ?? { versionStrategy: "fixed" },
          release: validatedConfig.release ?? {
            npm: true,
            github: false,
            tagFormat: "v${version}",
            conventionalCommits: true,
          },
          plugins: validatedConfig.plugins ?? [],
        };

        return config;
      } catch (error) {
        console.error(`Error loading config from ${configPath}:`, error);
        throw error;
      }
    }
  }

  // Return default config if no file found
  // Arktype assert with empty object will validate and return defaults
  const validatedConfig = remptsConfigSchema.assert({}) as any;
  return {
    ...validatedConfig,
    build: transformBuildConfig(validatedConfig.build),
    dev: validatedConfig.dev ?? { watch: true, inspect: false },
    test: validatedConfig.test ?? {
      pattern: ["**/*.test.ts", "**/*.spec.ts"],
      coverage: false,
      watch: false,
    },
    workspace: validatedConfig.workspace ?? { versionStrategy: "fixed" },
    release: validatedConfig.release ?? {
      npm: true,
      github: false,
      tagFormat: "v${version}",
      conventionalCommits: true,
    },
    plugins: validatedConfig.plugins ?? [],
  };
}
