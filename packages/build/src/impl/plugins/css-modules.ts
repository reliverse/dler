// packages/build/src/impl/plugins/css-modules.ts

import { logger } from "@reliverse/dler-logger";
import type { BunBuildConfig, DlerPlugin } from "../types";

export const CSSModulesPlugin: DlerPlugin = {
  name: "css-modules",
  setup: (buildConfig: BunBuildConfig) => {
    // Configure CSS modules loader
    buildConfig.loader = {
      ...buildConfig.loader,
      ".module.css": "file",
      ".module.less": "file",
      ".module.styl": "file",
    };

    // Add CSS modules support to the build
    if (!buildConfig.define) {
      buildConfig.define = {};
    }

    buildConfig.define["__CSS_MODULES__"] = "true";

    logger.debug("CSS modules plugin applied");
  },
};
