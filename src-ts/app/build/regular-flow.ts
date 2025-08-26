import { relinka } from "@reliverse/relinka";
import pAll from "p-all";
import { CONCURRENCY_DEFAULT } from "~/app/config/constants";
import type { ReliverseConfig } from "~/app/schema/mod";
import type { PerfTimer } from "~/app/types/mod";
import { regular_pubToJsr, regular_pubToNpm } from "../pub/pub-regular";
import { regular_buildJsrDist, regular_buildNpmDist } from "./build-regular";

/**
 * Builds the main project based on build mode and commonPubRegistry.
 */
export async function regular_buildFlow(
  timer: PerfTimer,
  isDev: boolean,
  config: ReliverseConfig,
): Promise<void> {
  relinka("verbose", "— — — regular_buildFlow — — —");

  if (config.libsActMode === "libs-only") {
    relinka("verbose", "Skipping main project build as libsActMode is set to 'libs-only'");
    return;
  }

  switch (config.commonPubRegistry) {
    case "jsr":
      relinka("verbose", "Initializing build process for main project to JSR only...");
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
      break;
    case "npm":
      relinka("verbose", "Initializing build process for main project to NPM only...");
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
        config.transpileMinify,
        config.transpileSourcemap,
        config.transpilePublicPath,
        config.transpileStub,
        config.transpileWatch,
        timer,
        config.coreDeclarations,
      );
      break;
    case "npm-jsr": {
      relinka("verbose", "Initializing build process for main project to both NPM and JSR...");

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
      break;
    }
    default:
      relinka("error", `Invalid commonPubRegistry: ${config.commonPubRegistry}`);
      throw new Error(`Invalid commonPubRegistry: ${config.commonPubRegistry}`);
  }
}

/**
 * Publishes the main project based on commonPubRegistry.
 */
export async function regular_pubFlow(
  timer: PerfTimer,
  isDev: boolean,
  config: ReliverseConfig,
): Promise<void> {
  relinka("verbose", "— — — regular_pubFlow — — —");

  if (config.libsActMode === "libs-only") {
    relinka("verbose", "Skipping main project publish as libsActMode is set to 'libs-only'");
    return;
  }

  switch (config.commonPubRegistry) {
    case "jsr":
      relinka("verbose", "Publishing main project to JSR...");
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
      relinka("verbose", "Publishing main project to NPM...");
      await regular_pubToNpm(
        config.distJsrDryRun,
        isDev,
        config.commonPubPause,
        config.distNpmDirName,
        timer,
      );
      break;
    case "npm-jsr": {
      relinka("verbose", "Publishing main project to both NPM and JSR...");
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
