import prettyMilliseconds from "pretty-ms";

import type { LibConfig } from "~/libs/sdk/sdk-types.js";

import { setBumpDisabled } from "./utils-bump.js";
import { removeDistFolders } from "./utils-clean.js";
import { relinka } from "@reliverse/relinka";
import { getElapsedPerfTime, type PerfTimer } from "./utils-perf.js";

/**
 * Finalizes the build process and reports completion.
 */
export async function finalizeBuild(
  timer: PerfTimer,
  commonPubPause: boolean,
  libsList: Record<string, LibConfig>,
  distNpmDirName: string,
  distJsrDirName: string,
  libsDirDist: string,
  isDev: boolean,
): Promise<void> {
  if (!commonPubPause) {
    await removeDistFolders(
      distNpmDirName,
      distJsrDirName,
      libsDirDist,
      libsList,
    );
    await setBumpDisabled(false, commonPubPause);
  }
  const elapsedTime = getElapsedPerfTime(timer);
  const transpileFormattedTime = prettyMilliseconds(elapsedTime, {
    verbose: true,
  });
  if (!commonPubPause) {
    relinka(
      "success",
      `🎉 Build and publishing completed successfully (in ${transpileFormattedTime})`,
    );
  } else {
    relinka(
      "success",
      `🎉 Test build completed successfully (in ${transpileFormattedTime})`,
    );
    if (!isDev) {
      relinka(
        "info",
        "📝 Publish process is currently paused in your config file",
      );
    } else {
      relinka(
        "info",
        "📝 Publish is paused, you're in dev mode (use `bun pub` to publish)",
      );
    }
  }
}
