import { relinka } from "@reliverse/relinka";
import pAll from "p-all";

import type { DlerConfig, PerfTimer } from "~/libs/sdk/sdk-types";

import { regular_buildJsrDist, regular_buildNpmDist } from "./build/build-regular";
import { regular_pubToJsr, regular_pubToNpm } from "./pub/pub-regular";
import { CONCURRENCY_DEFAULT } from "./utils/utils-consts";

/**
 * Processes the main project based on build mode and commonPubRegistry.
 */
export async function processRegularFlow(
  timer: PerfTimer,
  isDev: boolean,
  config: DlerConfig,
): Promise<void> {
  if (config.libsActMode === "libs-only") {
    relinka("log", "Skipping main project build/publish as libsActMode is set to 'libs-only'");
    return;
  }

  switch (config.commonPubRegistry) {
    case "jsr":
      relinka("log", "Initializing build process for main project to JSR only...");
      await regular_buildJsrDist(
        isDev,
        true,
        config.coreIsCLI,
        config.coreEntrySrcDir,
        config.distJsrDirName,
        config.distJsrBuilder,
        config.coreEntryFile,
        config.transpileTarget,
        config.transpileFormat,
        config.transpileSplitting,
        config.transpileMinify,
        config.transpileSourcemap,
        config.transpilePublicPath,
        config.distNpmOutFilesExt,
        config,
        timer,
        config.transpileStub,
        config.transpileWatch,
        config.distJsrGenTsconfig,
        config.coreDeclarations,
      );
      await regular_pubToJsr(
        config.distJsrDryRun,
        config.distJsrFailOnWarn,
        isDev,
        config.commonPubPause,
        config.distJsrDirName,
        config.distJsrAllowDirty,
        config.distJsrSlowTypes,
        timer,
      );
      break;
    case "npm":
      relinka("log", "Initializing build process for main project to NPM only...");
      await regular_buildNpmDist(
        isDev,
        config.coreIsCLI,
        config.coreEntrySrcDir,
        config.distNpmDirName,
        config.distNpmBuilder,
        config.coreEntryFile,
        config.distNpmOutFilesExt,
        config,
        config.transpileTarget,
        config.transpileFormat,
        config.transpileSplitting,
        config.transpileMinify,
        config.transpileSourcemap,
        config.transpilePublicPath,
        config.transpileStub,
        config.transpileWatch,
        timer,
        config.coreDeclarations,
      );
      await regular_pubToNpm(
        config.distJsrDryRun,
        isDev,
        config.commonPubPause,
        config.distNpmDirName,
        timer,
      );
      break;
    case "npm-jsr": {
      relinka("log", "Initializing build process for main project to both NPM and JSR...");

      const buildTasks = [
        () =>
          regular_buildJsrDist(
            isDev,
            true,
            config.coreIsCLI,
            config.coreEntrySrcDir,
            config.distJsrDirName,
            config.distJsrBuilder,
            config.coreEntryFile,
            config.transpileTarget,
            config.transpileFormat,
            config.transpileSplitting,
            config.transpileMinify,
            config.transpileSourcemap,
            config.transpilePublicPath,
            config.distNpmOutFilesExt,
            config,
            timer,
            config.transpileStub,
            config.transpileWatch,
            config.distJsrGenTsconfig,
            config.coreDeclarations,
          ),
        () =>
          regular_buildNpmDist(
            isDev,
            config.coreIsCLI,
            config.coreEntrySrcDir,
            config.distNpmDirName,
            config.distNpmBuilder,
            config.coreEntryFile,
            config.distNpmOutFilesExt,
            config,
            config.transpileTarget,
            config.transpileFormat,
            config.transpileSplitting,
            config.transpileMinify,
            config.transpileSourcemap,
            config.transpilePublicPath,
            config.transpileStub,
            config.transpileWatch,
            timer,
            config.coreDeclarations,
          ),
      ];
      await pAll(buildTasks, { concurrency: CONCURRENCY_DEFAULT });
      const publishTasks = [
        () =>
          regular_pubToJsr(
            config.distJsrDryRun,
            config.distJsrFailOnWarn,
            isDev,
            config.commonPubPause,
            config.distJsrDirName,
            config.distJsrAllowDirty,
            config.distJsrSlowTypes,
            timer,
          ),
        () =>
          regular_pubToNpm(
            config.distJsrDryRun,
            isDev,
            config.commonPubPause,
            config.distNpmDirName,
            timer,
          ),
      ];
      await pAll(publishTasks, { concurrency: CONCURRENCY_DEFAULT });
      break;
    }
    default:
      relinka("error", `Invalid commonPubRegistry: ${config.commonPubRegistry}`);
      throw new Error(`Invalid commonPubRegistry: ${config.commonPubRegistry}`);
  }
}
