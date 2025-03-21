// ============================
// Distribution Publish Functions
// ============================

import { execaCommand } from "execa";
import path from "pathe";

import { PROJECT_ROOT } from "~/libs/sdk/sdk-impl/utils/utils-consts.js";
import { withWorkingDirectory } from "~/libs/sdk/sdk-impl/utils/utils-cwd.js";
import { relinka } from "~/libs/sdk/sdk-impl/utils/utils-logs.js";
import {
  pausePerfTimer,
  type PerfTimer,
  resumePerfTimer,
} from "~/libs/sdk/sdk-impl/utils/utils-perf.js";

/**
 * Publishes the JSR distribution.
 */
export async function regular_pubToJsr(
  distJsrDryRun: boolean,
  isDev: boolean,
  commonPubPause: boolean,
  distJsrDirName: string,
  distJsrAllowDirty: boolean,
  distJsrSlowTypes: boolean,
  timer: PerfTimer,
): Promise<void> {
  try {
    if (isDev) {
      relinka("info", "Skipping JSR publish in development mode");
      return;
    }
    if (!commonPubPause) {
      relinka("info", "Publishing to JSR...");
      const distJsrDirNameResolved = path.resolve(PROJECT_ROOT, distJsrDirName);

      // Pause the timer before publishing (interactive)
      if (timer) pausePerfTimer(timer);

      await withWorkingDirectory(distJsrDirNameResolved, async () => {
        const command = [
          "bun x jsr publish",
          distJsrDryRun ? "--dry-run" : "",
          distJsrAllowDirty ? "--allow-dirty" : "",
          distJsrSlowTypes ? "--allow-slow-types" : "",
        ]
          .filter(Boolean)
          .join(" ");
        relinka("verbose", `Running publish command: ${command}`);
        await execaCommand(command, { stdio: "inherit" });
        relinka(
          "success",
          `Successfully ${distJsrDryRun ? "validated" : "published"} to JSR registry`,
        );
      });

      // Resume the timer after publishing is complete
      if (timer) resumePerfTimer(timer);
    }
  } catch (error) {
    // Resume timer even on error
    if (timer) resumePerfTimer(timer);
    relinka("error", "Failed to publish to JSR:", error);
    throw error;
  }
}

/**
 * Publishes the NPM distribution.
 */
export async function regular_pubToNpm(
  distJsrDryRun: boolean,
  isDev: boolean,
  commonPubPause: boolean,
  distNpmDirName: string,
  timer: PerfTimer,
): Promise<void> {
  try {
    if (isDev) {
      relinka("info", "Skipping NPM publish in development mode");
      return;
    }
    if (!commonPubPause) {
      relinka("info", "Publishing to NPM...");
      const distNpmDirNameResolved = path.resolve(PROJECT_ROOT, distNpmDirName);

      // Pause the timer before publishing (non-interactive)
      if (timer) pausePerfTimer(timer);

      await withWorkingDirectory(distNpmDirNameResolved, async () => {
        const command = ["bun publish", distJsrDryRun ? "--dry-run" : ""]
          .filter(Boolean)
          .join(" ");
        relinka("verbose", `Running publish command: ${command}`);
        await execaCommand(command, { stdio: "inherit" });
        relinka(
          "success",
          `Successfully ${distJsrDryRun ? "validated" : "published"} to NPM registry`,
        );
      });

      // Resume the timer after publishing is complete
      if (timer) resumePerfTimer(timer);
    }
  } catch (error) {
    // Resume timer even on error
    if (timer) resumePerfTimer(timer);
    relinka("error", "Failed to publish to NPM:", error);
    throw error;
  }
}
