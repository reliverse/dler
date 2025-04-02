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
  coreIsCLI: boolean,
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
  unifiedBundlerOutExt: NpmOutExt,
  rmDepsMode: ExcludeMode,
  transpileStub: boolean,
  transpileWatch: boolean,
  distJsrGenTsconfig: boolean,
  coreDeclarations: boolean,
): Promise<void> {
  if (libsActMode !== "main-project-only" && libsActMode !== "main-and-libs") {
    relinka(
      "info",
      "Skipping main project build/publish as libsActMode is set to 'libs-only'",
    );
    return;
  }
  switch (commonPubRegistry) {
    case "jsr":
      relinka(
        "info",
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
        unifiedBundlerOutExt,
        rmDepsMode,
        timer,
        transpileStub,
        transpileWatch,
        distJsrGenTsconfig,
        coreDeclarations,
      );
      if (!isDev) {
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
      }
      break;
    case "npm":
      relinka(
        "info",
        "Initializing build process for main project to NPM only...",
      );
      await regular_buildNpmDist(
        isDev,
        coreEntrySrcDir,
        distNpmDirName,
        distNpmBuilder,
        coreEntryFile,
        unifiedBundlerOutExt,
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
      );
      if (!isDev) {
        await regular_pubToNpm(
          distJsrDryRun,
          isDev,
          commonPubPause,
          distNpmDirName,
          timer,
        );
      }
      break;
    case "npm-jsr": {
      relinka(
        "info",
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
            unifiedBundlerOutExt,
            rmDepsMode,
            timer,
            transpileStub,
            transpileWatch,
            distJsrGenTsconfig,
            coreDeclarations,
          ),
        () =>
          regular_buildNpmDist(
            isDev,
            coreEntrySrcDir,
            distNpmDirName,
            distNpmBuilder,
            coreEntryFile,
            unifiedBundlerOutExt,
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
          ),
      ];
      await pAll(buildTasks, { concurrency: CONCURRENCY_DEFAULT });
      if (!isDev) {
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
      }
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
            unifiedBundlerOutExt,
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
            unifiedBundlerOutExt,
            rmDepsMode,
            timer,
            transpileStub,
            transpileWatch,
            distJsrGenTsconfig,
            coreDeclarations,
          ),
      ];
      await pAll(fallbackBuildTasks, { concurrency: CONCURRENCY_DEFAULT });
    }
  }
}
