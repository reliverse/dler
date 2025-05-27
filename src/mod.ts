import type { BuildPublishConfig } from "~/libs/sdk/sdk-types";

import { DEFAULT_CONFIG } from "./libs/sdk/default";

// TODO: implement migrator from build.config.ts to .config/dler.ts
// export function defineBuildConfig(
//   config: UnifiedBuildConfig | UnifiedBuildConfig[],
// ): UnifiedBuildConfig[] {
//   return (Array.isArray(config) ? config : [config]).filter(Boolean);
// }

export const defineConfig = (userConfig: Partial<BuildPublishConfig> = {}) => {
  return { ...DEFAULT_CONFIG, ...userConfig };
};
