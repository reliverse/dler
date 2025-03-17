import type { BuildPublishConfig } from "~/types.js";

import { DEFAULT_CONFIG } from "./cfg-default.js";

export const defineConfig = (userConfig: Partial<BuildPublishConfig> = {}) => {
  return { ...DEFAULT_CONFIG, ...userConfig };
};
