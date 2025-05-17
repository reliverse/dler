import { relinka } from "@reliverse/relinka";
import pAll from "p-all";

import type {
  BundlerName,
  ExcludeMode,
  NpmOutExt,
  Sourcemap,
  transpileFormat,
  transpileTarget,
} from "~/libs/sdk/sdk-types.js";

import type { PerfTimer } from "./utils/utils-perf.js";

import {
  regular_buildJsrDist,
  regular_buildNpmDist,
} from "./build/build-regular.js";
import { regular_pubToJsr, regular_pubToNpm } from "./pub/pub-regular.js";
import { CONCURRENCY_DEFAULT } from "./utils/utils-consts.js";

/**
 * Processes the main project based on build mode and commonPubRegistry.
 */
export async function processRegularFlow(
  timer: PerfTimer,
  isDev: boolean,
  coreIsCLI: { enabled: boolean; scripts: Record<string, string> },
  libsActMode: string,
  commonPubRegistry: string,
  coreEntrySrcDir: string,
  distNpmDirName: string,
  distNpmBuilder: BundlerName,
  coreEntryFile: string,
  distJsrDryRun: boolean,
  distJsrFailOnWarn: boolean,
  commonPubPause: boolean,
  distJsrDirName: string,
  distJsrBuilder: BundlerName,
  transpileTarget: transpileTarget,
  transpileFormat: transpileFormat,
  transpileSplitting: boolean,
  transpileMinify: boolean,
  transpileSourcemap: Sourcemap,
  transpilePublicPath: string,
  distJsrAllowDirty: boolean,
  distJsrSlowTypes: boolean,
  distNpmOutFilesExt: NpmOutExt,
  rmDepsMode: ExcludeMode,
  transpileStub: boolean,
  transpileWatch: boolean,
  distJsrGenTsconfig: boolean,
  coreDeclarations: boolean,
  config: { coreDescription: string; coreBuildOutDir: string },
): Promise<void> {
  if (libsActMode === "libs-only") {
    relinka(
      "log",
      "Skipping main project build/publish as libsActMode is set to 'libs-only'",
    );
    return;
  }

  switch (commonPubRegistry) {
    case "jsr":
      relinka(
        "log",
        "Initializing build process for main project to JSR only...",
      );
      await regular_buildJsrDist(
        isDev,
        true,
        coreIsCLI,
        coreEntrySrcDir,
        distJsrDirName,
        distJsrBuilder,
        coreEntryFile,
        transpileTarget,
        transpileFormat,
        transpileSplitting,
        transpileMinify,
        transpileSourcemap,
        transpilePublicPath,
        distNpmOutFilesExt,
        rmDepsMode,
        timer,
        transpileStub,
        transpileWatch,
        distJsrGenTsconfig,
        coreDeclarations,
        config,
      );
      await regular_pubToJsr(
        distJsrDryRun,
        distJsrFailOnWarn,
        isDev,
        commonPubPause,
        distJsrDirName,
        distJsrAllowDirty,
        distJsrSlowTypes,
        timer,
      );
      break;
    case "npm":
      relinka(
        "log",
        "Initializing build process for main project to NPM only...",
      );
      await regular_buildNpmDist(
        isDev,
        coreEntrySrcDir,
        distNpmDirName,
        distNpmBuilder,
        coreEntryFile,
        distNpmOutFilesExt,
        rmDepsMode,
        coreIsCLI,
        transpileTarget,
        transpileFormat,
        transpileSplitting,
        transpileMinify,
        transpileSourcemap,
        transpilePublicPath,
        transpileStub,
        transpileWatch,
        timer,
        coreDeclarations,
        config,
      );
      await regular_pubToNpm(
        distJsrDryRun,
        isDev,
        commonPubPause,
        distNpmDirName,
        timer,
      );
      break;
    case "npm-jsr": {
      relinka(
        "log",
        "Initializing build process for main project to both NPM and JSR...",
      );

      const buildTasks = [
        () =>
          regular_buildJsrDist(
            isDev,
            true,
            coreIsCLI,
            coreEntrySrcDir,
            distJsrDirName,
            distJsrBuilder,
            coreEntryFile,
            transpileTarget,
            transpileFormat,
            transpileSplitting,
            transpileMinify,
            transpileSourcemap,
            transpilePublicPath,
            distNpmOutFilesExt,
            rmDepsMode,
            timer,
            transpileStub,
            transpileWatch,
            distJsrGenTsconfig,
            coreDeclarations,
            config,
          ),
        () =>
          regular_buildNpmDist(
            isDev,
            coreEntrySrcDir,
            distNpmDirName,
            distNpmBuilder,
            coreEntryFile,
            distNpmOutFilesExt,
            rmDepsMode,
            coreIsCLI,
            transpileTarget,
            transpileFormat,
            transpileSplitting,
            transpileMinify,
            transpileSourcemap,
            transpilePublicPath,
            transpileStub,
            transpileWatch,
            timer,
            coreDeclarations,
            config,
          ),
      ];
      await pAll(buildTasks, { concurrency: CONCURRENCY_DEFAULT });
      const publishTasks = [
        () =>
          regular_pubToJsr(
            distJsrDryRun,
            distJsrFailOnWarn,
            isDev,
            commonPubPause,
            distJsrDirName,
            distJsrAllowDirty,
            distJsrSlowTypes,
            timer,
          ),
        () =>
          regular_pubToNpm(
            distJsrDryRun,
            isDev,
            commonPubPause,
            distNpmDirName,
            timer,
          ),
      ];
      await pAll(publishTasks, { concurrency: CONCURRENCY_DEFAULT });
      break;
    }
    default: {
      relinka(
        "warn",
        `Registry "${commonPubRegistry}" not recognized. Building main project only...`,
      );

      const fallbackBuildTasks = [
        () =>
          regular_buildNpmDist(
            isDev,
            coreEntrySrcDir,
            distNpmDirName,
            distNpmBuilder,
            coreEntryFile,
            distNpmOutFilesExt,
            rmDepsMode,
            coreIsCLI,
            transpileTarget,
            transpileFormat,
            transpileSplitting,
            transpileMinify,
            transpileSourcemap,
            transpilePublicPath,
            transpileStub,
            transpileWatch,
            timer,
            coreDeclarations,
            config,
          ),
        () =>
          regular_buildJsrDist(
            isDev,
            true,
            coreIsCLI,
            coreEntrySrcDir,
            distJsrDirName,
            distJsrBuilder,
            coreEntryFile,
            transpileTarget,
            transpileFormat,
            transpileSplitting,
            transpileMinify,
            transpileSourcemap,
            transpilePublicPath,
            distNpmOutFilesExt,
            rmDepsMode,
            timer,
            transpileStub,
            transpileWatch,
            distJsrGenTsconfig,
            coreDeclarations,
            config,
          ),
      ];
      await pAll(fallbackBuildTasks, { concurrency: CONCURRENCY_DEFAULT });
    }
  }
}
