import { setBumpDisabledValueTo } from "@reliverse/bleump";
import { relinka } from "@reliverse/relinka";
import prettyMilliseconds from "pretty-ms";
import type { LibConfig } from "~/impl/schema/mod";
import type { PerfTimer } from "~/impl/types/mod";

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
        : "💡 To publish: set commonPubPause=false, then run: rse publish",
    );
  } else {
    relinka("info", "For publishing to NPM/JSR, use: rse publish");
  }
}

/**
 * Finalizes the build process and reports completion.
 */
export async function finalizeBuild(
  shouldShowSpinner: boolean,
  timer: PerfTimer,
  commonPubPause: boolean,
  usedMode: "build" | "pub",
): Promise<void> {
  if (!shouldShowSpinner) {
    const elapsedTime = getElapsedPerfTime(timer);
    const formattedPerfTime = prettyMilliseconds(elapsedTime, {
      verbose: true,
    });
    // Print separator for better visual separation
    console.log("\n" + "=".repeat(60));
    // Report build completion with timing
    relinka("verbose", `✅ Build completed successfully in ${formattedPerfTime}`);
  }

  providePublishGuidance(usedMode, commonPubPause);
}

/**
 * Finalizes the publish process, cleans up, and reports completion.
 */
export async function finalizePub(
  libsList: Record<string, LibConfig>,
  distNpmDirName: string,
  distJsrDirName: string,
  libsDirDist: string,
): Promise<void> {
  // Delete dist folders
  await removeDistFolders(distNpmDirName, distJsrDirName, libsDirDist, libsList);

  // Reset bump if it was disabled
  try {
    await setBumpDisabledValueTo(false);
  } catch {
    throw new Error("[reliverse.ts] Failed to set bumpDisable to false");
  }
}
