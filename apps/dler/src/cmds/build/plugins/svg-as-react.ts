// apps/dler/src/cmds/build/plugins/svg-as-react.ts

import { logger } from "@reliverse/dler-logger";
import type { BunBuildConfig, DlerPlugin } from "../types";

export const SVGAsReactPlugin: DlerPlugin = {
  name: "svg-as-react",
  setup: (buildConfig: BunBuildConfig) => {
    // Configure SVG loader to transform SVGs into React components
    buildConfig.loader = {
      ...buildConfig.loader,
      '.svg': 'jsx', // Use JSX loader for SVG files
    };

    // Add SVG transformation support
    if (!buildConfig.define) {
      buildConfig.define = {};
    }
    
    buildConfig.define['__SVG_AS_REACT__'] = 'true';
    
    logger.debug("SVG as React plugin applied");
  },
};
