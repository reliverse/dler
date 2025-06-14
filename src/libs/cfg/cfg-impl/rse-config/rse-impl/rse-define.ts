import type { RseConfig } from "./rse-types";

import { DEFAULT_CONFIG_RSE } from "./rse-default";

export const defineConfigRse = (userConfig: Partial<RseConfig> = {}) => {
  return { ...DEFAULT_CONFIG_RSE, ...userConfig };
};
