// ============================
// Distribution Publish Functions
// ============================

import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { execaCommand } from "execa";

import type { PerfTimer } from "~/libs/sdk/sdk-impl/sdk-types";

import { PROJECT_ROOT } from "~/libs/sdk/sdk-impl/utils/utils-consts";
import { withWorkingDirectory } from "~/libs/sdk/sdk-impl/utils/utils-error-cwd";
import { writeFileSafe } from "~/libs/sdk/sdk-impl/utils/utils-fs";
import { pausePerfTimer, resumePerfTimer } from "~/libs/sdk/sdk-impl/utils/utils-perf";

/**
 * Publishes the JSR distribution.
 */
export async function regular_pubToJsr(
  distJsrDryRun: boolean,
  distJsrFailOnWarn: boolean,
  isDev: boolean,
  commonPubPause: boolean,
  distJsrDirName: string,
  distJsrAllowDirty: boolean,
  distJsrSlowTypes: boolean,
  timer: PerfTimer,
): Promise<void> {
  try {
    if (!commonPubPause) {
      relinka("verbose", "Publishing to JSR...");
      const distJsrDirNameResolved = path.resolve(PROJECT_ROOT, distJsrDirName);

      // Prepare bun package.json if in dev mode
      let bunDirCreated = false;
      const bunDir = "node_modules/bun";
      const bunPkgPath = `${bunDir}/package.json`;
      if (isDev) {
        if (!(await fs.pathExists(bunPkgPath))) {
          await fs.ensureDir(bunDir);
          await writeFileSafe(
            bunPkgPath,
            '{\n  "name": "bun"\n}',
            "Create bun package.json for dev publish",
          );
          bunDirCreated = true;
        }
      }

      // Pause the timer before publishing (interactive)
      if (timer) pausePerfTimer(timer);

      await withWorkingDirectory(distJsrDirNameResolved, async () => {
        const command = [
          "bun x jsr publish",
          distJsrDryRun ? "--dry-run" : "",
          distJsrFailOnWarn ? "--fail-on-warn" : "",
          distJsrAllowDirty ? "--allow-dirty" : "",
          distJsrSlowTypes ? "--allow-slow-types" : "",
        ]
          .filter(Boolean)
          .join(" ");
        relinka("verbose", `Running publish command: ${command}`);
        await execaCommand(command, { stdio: "inherit" });
        relinka("null", "");
        relinka(
          "verbose",
          `Successfully ${distJsrDryRun ? "validated" : "published"} to JSR registry`,
        );
      });

      // Wait for 2 seconds so jsr.io UI will be finished
      // Without this user may see: `resource busy or locked, rm 'dist-jsr'`
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Resume the timer after publishing is complete
      if (timer) resumePerfTimer(timer);

      // Clean up node_modules/bun after publish
      if (isDev && bunDirCreated) {
        await fs.remove(bunDir);
      }
    }
  } catch (error) {
    // Resume timer even on error
    if (timer) resumePerfTimer(timer);
    throw error;
  }
}

/**
 * Publishes the NPM distribution.
 */
export async function regular_pubToNpm(
  distJsrDryRun: boolean,
  _isDev: boolean,
  commonPubPause: boolean,
  distNpmDirName: string,
  timer: PerfTimer,
): Promise<void> {
  try {
    if (!commonPubPause) {
      relinka("verbose", "Publishing to NPM...");
      const distNpmDirNameResolved = path.resolve(PROJECT_ROOT, distNpmDirName);

      // Pause the timer before publishing (non-interactive)
      if (timer) pausePerfTimer(timer);

      await withWorkingDirectory(distNpmDirNameResolved, async () => {
        const command = ["bun publish", distJsrDryRun ? "--dry-run" : ""].filter(Boolean).join(" ");
        relinka("verbose", `Running publish command: ${command}`);
        await execaCommand(command, { stdio: "inherit" });
        relinka("null", "");
        relinka(
          "verbose",
          `Successfully ${distJsrDryRun ? "validated" : "published"} to NPM registry`,
        );
      });

      // Resume the timer after publishing is complete
      if (timer) resumePerfTimer(timer);
    }
  } catch (error) {
    // Resume timer even on error
    if (timer) resumePerfTimer(timer);
    throw error;
  }
}
