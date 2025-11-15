// packages/build/src/impl/plugins/react-refresh.ts

import { logger } from "@reliverse/dler-logger";
import type { BunBuildConfig, DlerPlugin } from "../types";

export const ReactRefreshPlugin: DlerPlugin = {
  name: "react-refresh",
  setup: (buildConfig: BunBuildConfig) => {
    // Enable React Fast Refresh
    buildConfig.reactFastRefresh = true;

    // Add React Refresh runtime to banner
    const refreshRuntime = `
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const refreshRuntime = {
    performReactRefresh: () => {
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.onCommitFiberRoot) {
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot();
      }
    }
  };
  window.__REACT_REFRESH_RUNTIME__ = refreshRuntime;
}`;

    if (buildConfig.banner) {
      buildConfig.banner = refreshRuntime + "\n" + buildConfig.banner;
    } else {
      buildConfig.banner = refreshRuntime;
    }

    // Configure JSX for React Refresh
    if (!buildConfig.jsx) {
      buildConfig.jsx = {
        runtime: "automatic",
        importSource: "react",
      };
    }

    if (buildConfig.verbose) {
      logger.debug("React Fast Refresh plugin applied");
    }
  },
};
