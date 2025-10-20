import { relinka } from "@reliverse/relinka";
import { createSpinnerGroup } from "@reliverse/rempts";
import pAll from "p-all";
import { CONCURRENCY_DEFAULT } from "~/impl/config/constants";
import type { ReliverseConfig } from "~/impl/schema/mod";
import type { PerfTimer } from "~/impl/types/mod";
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
		relinka(
			"verbose",
			"Skipping main project build as libsActMode is set to 'libs-only'",
		);
		return;
	}

	switch (config.commonPubRegistry) {
		case "jsr":
			relinka(
				"verbose",
				"Initializing build process for main project to JSR only...",
			);
			await regular_buildJsrDist(
				isDev,
				true,
				config.commonIsCLI,
				".", // Main project package name
				config.commonEntrySrcDir,
				config.distJsrDirName,
				config.distJsrBuilder,
				config.commonEntryFile,
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
				config.commonDeclarations,
			);
			break;
		case "npm":
			relinka(
				"verbose",
				"Initializing build process for main project to NPM only...",
			);
			await regular_buildNpmDist(
				isDev,
				config.commonIsCLI,
				".", // Main project package name
				config.commonEntrySrcDir,
				config.distNpmDirName,
				config.distNpmBuilder,
				config.commonEntryFile,
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
				config.commonDeclarations,
			);
			break;
		case "npm-jsr": {
			relinka(
				"verbose",
				"Initializing build process for main project to both NPM and JSR...",
			);

			// Use spinner group for concurrent NPM + JSR builds
			const shouldShowSpinner = config.commonDisableSpinner === false;
			let buildSpinnerGroup: ReturnType<typeof createSpinnerGroup> | null =
				null;

			if (shouldShowSpinner) {
				buildSpinnerGroup = createSpinnerGroup({
					items: ["Building for NPM", "Building for JSR"],
					concurrent: true,
					color: "cyan",
				});

				for (const spinner of buildSpinnerGroup.spinners) {
					spinner.start();
				}
			}

			const buildTasks = [
				async () => {
					try {
						await regular_buildJsrDist(
							isDev,
							true,
							config.commonIsCLI,
							".", // Main project package name
							config.commonEntrySrcDir,
							config.distJsrDirName,
							config.distJsrBuilder,
							config.commonEntryFile,
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
							config.commonDeclarations,
						);
						if (buildSpinnerGroup?.spinners[1]) {
							buildSpinnerGroup.spinners[1].succeed("JSR build completed");
						}
					} catch (error) {
						if (buildSpinnerGroup?.spinners[1]) {
							buildSpinnerGroup.spinners[1].fail("JSR build failed");
						}
						throw error;
					}
				},
				async () => {
					try {
						await regular_buildNpmDist(
							isDev,
							config.commonIsCLI,
							".", // Main project package name
							config.commonEntrySrcDir,
							config.distNpmDirName,
							config.distNpmBuilder,
							config.commonEntryFile,
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
							config.commonDeclarations,
						);
						if (buildSpinnerGroup?.spinners[0]) {
							buildSpinnerGroup.spinners[0].succeed("NPM build completed");
						}
					} catch (error) {
						if (buildSpinnerGroup?.spinners[0]) {
							buildSpinnerGroup.spinners[0].fail("NPM build failed");
						}
						throw error;
					}
				},
			];
			await pAll(buildTasks, { concurrency: CONCURRENCY_DEFAULT });
			break;
		}
		default:
			relinka(
				"error",
				`Invalid commonPubRegistry: ${config.commonPubRegistry}`,
			);
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
		relinka(
			"verbose",
			"Skipping main project publish as libsActMode is set to 'libs-only'",
		);
		return;
	}

	const shouldShowSpinner = config.commonDisableSpinner === false;

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
				shouldShowSpinner,
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
				shouldShowSpinner,
			);
			break;
		case "npm-jsr": {
			relinka("verbose", "Publishing main project to both NPM and JSR...");

			// Use spinner group for concurrent NPM + JSR publishing
			let pubSpinnerGroup: ReturnType<typeof createSpinnerGroup> | null = null;

			if (shouldShowSpinner) {
				pubSpinnerGroup = createSpinnerGroup({
					items: ["Publishing to NPM", "Publishing to JSR"],
					concurrent: true,
					color: "magenta",
				});

				for (const spinner of pubSpinnerGroup.spinners) {
					spinner.start();
				}
			}

			const publishTasks = [
				async () => {
					try {
						await regular_pubToJsr(
							config.distJsrDryRun,
							config.distJsrFailOnWarn,
							isDev,
							config.commonPubPause,
							config.distJsrDirName,
							config.distJsrAllowDirty,
							config.distJsrSlowTypes,
							timer,
							shouldShowSpinner,
						);
						if (pubSpinnerGroup?.spinners[1]) {
							pubSpinnerGroup.spinners[1].succeed("JSR publish completed");
						}
					} catch (error) {
						if (pubSpinnerGroup?.spinners[1]) {
							pubSpinnerGroup.spinners[1].fail("JSR publish failed");
						}
						throw error;
					}
				},
				async () => {
					try {
						await regular_pubToNpm(
							config.distJsrDryRun,
							isDev,
							config.commonPubPause,
							config.distNpmDirName,
							timer,
							shouldShowSpinner,
						);
						if (pubSpinnerGroup?.spinners[0]) {
							pubSpinnerGroup.spinners[0].succeed("NPM publish completed");
						}
					} catch (error) {
						if (pubSpinnerGroup?.spinners[0]) {
							pubSpinnerGroup.spinners[0].fail("NPM publish failed");
						}
						throw error;
					}
				},
			];
			await pAll(publishTasks, { concurrency: CONCURRENCY_DEFAULT });
			break;
		}
		default:
			relinka(
				"error",
				`Invalid commonPubRegistry: ${config.commonPubRegistry}`,
			);
			throw new Error(`Invalid commonPubRegistry: ${config.commonPubRegistry}`);
	}
}
