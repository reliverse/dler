import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { execaCommand } from "execa";
import pAll from "p-all";
import { CONCURRENCY_DEFAULT } from "~/app/config/constants";
import type { PerfTimer } from "~/app/types/mod";
import { withWorkingDirectory } from "~/app/utils/utils-error-cwd";
import { writeFileSafe } from "~/app/utils/utils-fs";
import { pausePerfTimer, resumePerfTimer } from "~/app/utils/utils-perf";

/**
 * Publishes a library to the specified commonPubRegistry.
 */
export async function library_publishLibrary(
  effectivePubRegistry: "jsr" | "npm" | "npm-jsr" | undefined,
  libName: string,
  npmOutDir: string,
  jsrOutDir: string,
  distJsrDryRun: boolean,
  distJsrFailOnWarn: boolean,
  distJsrAllowDirty: boolean,
  distJsrSlowTypes: boolean,
  isDev: boolean,
  timer: PerfTimer,
): Promise<void> {
  switch (effectivePubRegistry) {
    case "jsr":
      relinka("verbose", `Publishing lib ${libName} to JSR only...`);
      relinka("null", "");
      await library_pubToJsr(
        jsrOutDir,
        distJsrDryRun,
        distJsrFailOnWarn,
        distJsrAllowDirty,
        distJsrSlowTypes,
        libName,
        isDev,
        timer,
      );
      break;
    case "npm":
      relinka("verbose", `Publishing lib ${libName} to NPM only...`);
      relinka("null", "");
      await library_pubToNpm(npmOutDir, distJsrDryRun, distJsrFailOnWarn, libName, isDev, timer);
      break;
    case "npm-jsr": {
      relinka("verbose", `Publishing lib ${libName} to both NPM and JSR...`);
      relinka("null", "");
      const publishTasks = [
        () => library_pubToNpm(npmOutDir, distJsrDryRun, distJsrFailOnWarn, libName, isDev, timer),
        () =>
          library_pubToJsr(
            jsrOutDir,
            distJsrDryRun,
            distJsrFailOnWarn,
            distJsrAllowDirty,
            distJsrSlowTypes,
            libName,
            isDev,
            timer,
          ),
      ];
      await pAll(publishTasks, { concurrency: CONCURRENCY_DEFAULT });
      break;
    }
    default:
      relinka(
        "log",
        `Registry "${effectivePubRegistry}" not recognized for lib ${libName}. Skipping publishing for this lib.`,
      );
  }
}

/**
 * Publishes a lib to JSR.
 */
async function library_pubToJsr(
  libOutDir: string,
  distJsrDryRun: boolean,
  distJsrFailOnWarn: boolean,
  distJsrAllowDirty: boolean,
  distJsrSlowTypes: boolean,
  libName: string,
  isDev: boolean,
  timer: PerfTimer,
): Promise<void> {
  relinka("verbose", `Starting library_pubToJsr for lib: ${libName}`);
  let bunDirCreated = false;
  const bunDir = "node_modules/bun";
  const bunPkgPath = `${bunDir}/package.json`;
  try {
    if (isDev) {
      // Ensure node_modules/bun/package.json exists
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
    if (timer) pausePerfTimer(timer);
    await withWorkingDirectory(libOutDir, async () => {
      relinka("verbose", `Publishing lib ${libName} to JSR from ${libOutDir}`);
      relinka("null", "");
      const command = [
        "bun x jsr publish",
        distJsrDryRun ? "--dry-run" : "",
        distJsrFailOnWarn ? "--fail-on-warn" : "",
        distJsrAllowDirty ? "--allow-dirty" : "",
        distJsrSlowTypes ? "--allow-slow-types" : "",
      ]
        .filter(Boolean)
        .join(" ");
      await execaCommand(command, { stdio: "inherit" });
      relinka("null", "");
      relinka(
        "log",
        `Successfully ${distJsrDryRun ? "validated" : "published"} lib ${libName} to JSR registry`,
      );
    });

    // Wait for 2 seconds so jsr.io UI will be finished
    // Without this user may see: `resource busy or locked, rm 'dist-jsr'`
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Resume the timer after publishing is complete
    if (timer) resumePerfTimer(timer);
  } catch (error) {
    if (timer) resumePerfTimer(timer);
    throw error;
  } finally {
    if (isDev && bunDirCreated) {
      // Clean up node_modules/bun after publish
      await fs.remove(bunDir);
    }
  }
}

/**
 * Publishes a lib to NPM.
 */
async function library_pubToNpm(
  libOutDir: string,
  distJsrDryRun: boolean,
  _distJsrFailOnWarn: boolean,
  libName: string,
  _isDev: boolean,
  timer: PerfTimer,
): Promise<void> {
  relinka("verbose", `Starting library_pubToNpm for lib: ${libName}`);
  try {
    if (timer) pausePerfTimer(timer);
    await withWorkingDirectory(libOutDir, async () => {
      relinka("verbose", `Publishing lib ${libName} to NPM from ${libOutDir}`);
      relinka("null", "");
      const command = ["bun publish", distJsrDryRun ? "--dry-run" : ""].filter(Boolean).join(" ");
      await execaCommand(command, { stdio: "inherit" });
      relinka("null", "");
      relinka(
        "log",
        `Successfully ${distJsrDryRun ? "validated" : "published"} lib ${libName} to NPM registry`,
      );
    });
    if (timer) resumePerfTimer(timer);
  } catch (error) {
    if (timer) resumePerfTimer(timer);
    throw error;
  }
}
