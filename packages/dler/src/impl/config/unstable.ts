import { loadConfig, watchConfig } from "c12";
import type { ReliverseConfig } from "~/impl/schema/mod";
import { DEFAULT_CONFIG_RELIVERSE } from "~/impl/schema/mod";

/**
 * Loads the rse config using c12. Merges:
 * 1) File named `rse.*`
 * 2) Optional overrides
 */
export async function loadrse(
  projectPath: string,
  //   overrides?: Partial<ReliverseConfig>,
): Promise<ReliverseConfig> {
  // c12 automatically detects supported file types (.ts, .js, .jsonc, etc.)
  const { config } = await loadConfig<ReliverseConfig>({
    cwd: projectPath,
    name: "reliverse",
    configFile: "reliverse", // will look for files like `reliverse.{ts,jsonc}`
    rcFile: false,
    packageJson: false,
    dotenv: false, // disable loading .env
    defaults: DEFAULT_CONFIG_RELIVERSE as ReliverseConfig, // merged first
    // overrides: overrides || {}, // highest priority
  });

  return config;
}

/**
 * Watches the rse config for changes and reloads on each update.
 */
export async function watchrse(
  projectPath: string,
  onUpdate: (newconfig: ReliverseConfig) => void,
): Promise<void> {
  const watcher = await watchConfig<ReliverseConfig>({
    cwd: projectPath,
    name: "reliverse",
    onUpdate({ newConfig, getDiff }) {
      // Any changes are inspected via getDiff()
      onUpdate(newConfig as unknown as ReliverseConfig);
      console.log("Diff:", getDiff());
    },
  });

  // Logs all files that are being watched
  console.log("Watching config:", watcher.watchingFiles);
}
