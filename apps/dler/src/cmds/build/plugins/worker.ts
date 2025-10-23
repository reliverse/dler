// apps/dler/src/cmds/build/plugins/worker.ts

import { logger } from "@reliverse/dler-logger";
import type { BunBuildConfig, DlerPlugin } from "../types";

export const WorkerPlugin: DlerPlugin = {
  name: "worker",
  setup: (buildConfig: BunBuildConfig) => {
    // Configure worker loader
    buildConfig.loader = {
      ...buildConfig.loader,
      '.worker.js': 'js',
      '.worker.ts': 'ts',
      '.worker.jsx': 'jsx',
      '.worker.tsx': 'tsx',
    };

    // Add worker support
    if (!buildConfig.define) {
      buildConfig.define = {};
    }
    
    buildConfig.define['__WORKER_SUPPORT__'] = 'true';
    
    logger.debug("Worker plugin applied");
  },
};
