// apps/dler/src/cmds/build/plugins/css-modules.ts

import { logger } from "@reliverse/dler-logger";
import type { BunBuildConfig, DlerPlugin } from "../types";

export const CSSModulesPlugin: DlerPlugin = {
  name: "css-modules",
  setup: (buildConfig: BunBuildConfig) => {
    // Configure CSS modules loader
    buildConfig.loader = {
      ...buildConfig.loader,
      '.module.css': 'css',
      '.module.scss': 'css',
      '.module.sass': 'css',
      '.module.less': 'css',
      '.module.styl': 'css',
    };

    // Add CSS modules support to the build
    if (!buildConfig.define) {
      buildConfig.define = {};
    }
    
    buildConfig.define['__CSS_MODULES__'] = 'true';
    
    logger.debug("CSS modules plugin applied");
  },
};
