import { relinka } from "@reliverse/relinka";
import { execaCommand } from "execa";
import pAll from "p-all";

import type { PerfTimer } from "~/libs/sdk/sdk-types.js";

import { CONCURRENCY_DEFAULT } from "~/libs/sdk/sdk-impl/utils/utils-consts.js";
import { withWorkingDirectory } from "~/libs/sdk/sdk-impl/utils/utils-cwd.js";
import {
  pausePerfTimer,
  resumePerfTimer,
} from "~/libs/sdk/sdk-impl/utils/utils-perf.js";

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
      relinka("log", `Publishing lib ${libName} to JSR only...`);
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
      relinka("log", `Publishing lib ${libName} to NPM only...`);
      await library_pubToNpm(
        npmOutDir,
        distJsrDryRun,
        distJsrFailOnWarn,
        libName,
        isDev,
        timer,
      );
      break;
    case "npm-jsr": {
      relinka("log", `Publishing lib ${libName} to both NPM and JSR...`);
      const publishTasks = [
        () =>
          library_pubToNpm(
            npmOutDir,
            distJsrDryRun,
            distJsrFailOnWarn,
            libName,
            isDev,
            timer,
          ),
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
  try {
    if (timer) pausePerfTimer(timer);
    await withWorkingDirectory(libOutDir, async () => {
      relinka("log", `Publishing lib ${libName} to JSR from ${libOutDir}`);
      const command = [
        "bun x jsr publish",
        distJsrDryRun ? "--dry-run" : "",
        distJsrFailOnWarn ? "--fail-on-warn" : "",
        distJsrAllowDirty ? "--allow-dirty" : "",
        distJsrSlowTypes ? "--allow-slow-types" : "",
      ]
        .filter(Boolean)
        .join(" ");
      try {
        await execaCommand(command, { stdio: "inherit" });
      } catch (error) {
        relinka("error", `Failed to publish lib ${libName} to JSR`, error);
        throw error;
      }
      relinka(
        "success",
        `Successfully ${distJsrDryRun ? "validated" : "published"} lib ${libName} to JSR registry`,
      );
    });
    if (timer) resumePerfTimer(timer);
  } catch (error) {
    if (timer) resumePerfTimer(timer);
    relinka("error", `Failed to publish lib ${libName} to JSR`, error);
    throw error;
  } finally {
    relinka("verbose", `Exiting library_pubToJsr for lib: ${libName}`);
  }
}

/**
 * Publishes a lib to NPM.
 */
async function library_pubToNpm(
  libOutDir: string,
  distJsrDryRun: boolean,
  distJsrFailOnWarn: boolean,
  libName: string,
  isDev: boolean,
  timer: PerfTimer,
): Promise<void> {
  relinka("verbose", `Starting library_pubToNpm for lib: ${libName}`);
  try {
    if (timer) pausePerfTimer(timer);
    await withWorkingDirectory(libOutDir, async () => {
      relinka("log", `Publishing lib ${libName} to NPM from ${libOutDir}`);
      const command = ["bun publish", distJsrDryRun ? "--dry-run" : ""]
        .filter(Boolean)
        .join(" ");
      await execaCommand(command, { stdio: "inherit" });
      relinka(
        "success",
        `Successfully ${distJsrDryRun ? "validated" : "published"} lib ${libName} to NPM registry`,
      );
    });
    if (timer) resumePerfTimer(timer);
  } catch (error) {
    if (timer) resumePerfTimer(timer);
    relinka("error", `Failed to publish lib ${libName} to NPM`, error);
    throw error;
  } finally {
    relinka("verbose", `Exiting library_pubToNpm for lib: ${libName}`);
  }
}
