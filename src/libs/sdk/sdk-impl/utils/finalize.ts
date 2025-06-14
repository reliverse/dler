import { setBumpDisabledValueTo } from "@reliverse/bleump";
import { relinka } from "@reliverse/relinka";
import prettyMilliseconds from "pretty-ms";

import type { LibConfig } from "~/libs/sdk/sdk-impl/config/types";
import type { PerfTimer } from "~/libs/sdk/sdk-types";

import { removeDistFolders } from "~/libs/sdk/sdk-impl/utils/utils-clean";
import { getElapsedPerfTime } from "~/libs/sdk/sdk-impl/utils/utils-perf";

/**
 * Finalizes the build process and reports completion.
 */
export async function finalizeBuild(timer: PerfTimer, commonPubPause: boolean): Promise<void> {
  const elapsedTime = getElapsedPerfTime(timer);
  const transpileFormattedTime = prettyMilliseconds(elapsedTime, {
    verbose: true,
  });

  console.log("-".repeat(50));
  relinka("success", `🎉 Build completed successfully (done in: ${transpileFormattedTime})`);
  if (commonPubPause) {
    relinka("info", "📝 Publish process is currently paused in your config file");
  }
}

/**
 * Finalizes the publish process, cleans up, and reports completion.
 */
export async function finalizePub(
  timer: PerfTimer,
  libsList: Record<string, LibConfig>,
  distNpmDirName: string,
  distJsrDirName: string,
  libsDirDist: string,
): Promise<void> {
  const elapsedTime = getElapsedPerfTime(timer);
  const transpileFormattedTime = prettyMilliseconds(elapsedTime, {
    verbose: true,
  });

  // Clean up and reset bump
  await removeDistFolders(distNpmDirName, distJsrDirName, libsDirDist, libsList);

  try {
    await setBumpDisabledValueTo(false);
  } catch {
    throw new Error("[.config/dler.ts] Failed to set bumpDisable to false");
  }

  relinka("success", `🎉 Publish completed successfully (build time: ${transpileFormattedTime})`);
}
