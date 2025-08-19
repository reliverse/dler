import { setBumpDisabledValueTo } from "@reliverse/bleump";
import { relinka } from "@reliverse/relinka";
import prettyMilliseconds from "pretty-ms";
import type { LibConfig, PerfTimer } from "~/impl/types/mod";

import { removeDistFolders } from "~/impl/utils/utils-clean";
import { getElapsedPerfTime } from "~/impl/utils/utils-perf";

/**
 * Provides guidance about publishing based on the current mode and pause state.
 */
function providePublishGuidance(usedMode: "build" | "pub", commonPubPause: boolean): void {
  if (commonPubPause) {
    relinka("info", "📝 Publishing is paused in your config (commonPubPause=true)");
    relinka(
      "info",
      usedMode === "pub"
        ? "💡 To enable publishing: set commonPubPause=false in your config"
        : "💡 To publish: set commonPubPause=false, then run 'dler pub'",
    );
  } else {
    relinka("info", "💡 To publish: run 'dler pub'");
  }
}

/**
 * Finalizes the build process and reports completion.
 */
export async function finalizeBuild(
  timer: PerfTimer,
  commonPubPause: boolean,
  usedMode: "build" | "pub",
): Promise<void> {
  const elapsedTime = getElapsedPerfTime(timer);
  const formattedPerfTime = prettyMilliseconds(elapsedTime, { verbose: true });

  // Print separator for better visual separation
  console.log("\n" + "=".repeat(60));

  // Report build completion with timing
  relinka("success", `🎉 Build completed successfully in ${formattedPerfTime}`);

  // Provide publish guidance
  providePublishGuidance(usedMode, commonPubPause);
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
  const formattedPerfTime = prettyMilliseconds(elapsedTime, { verbose: true });

  // Delete dist folders
  await removeDistFolders(distNpmDirName, distJsrDirName, libsDirDist, libsList);

  // Reset bump if it was disabled
  try {
    await setBumpDisabledValueTo(false);
  } catch {
    throw new Error("[relivereliverse.ts] Failed to set bumpDisable to false");
  }

  // Report success
  relinka("success", `🎉 Build and publish completed successfully in ${formattedPerfTime}`);
}
