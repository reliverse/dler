import {
	bumpHandler,
	isBumpDisabled,
	setBumpDisabledValueTo,
} from "@reliverse/bleump";
import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { createMultiStepSpinner } from "@reliverse/rempts";
import { dlerBuild } from "~/impl/build/impl";
import { library_pubFlow } from "~/impl/build/library-flow";
import { regular_pubFlow } from "~/impl/build/regular-flow";
import { PROJECT_ROOT } from "~/impl/config/constants";
import { getConfigDler } from "~/impl/config/load";
import type { ReliverseConfig } from "~/impl/schema/mod";
import type { PerfTimer } from "~/impl/types/mod";
import { finalizeBuild, finalizePub } from "~/impl/utils/finalize";
import { handleDlerError } from "~/impl/utils/utils-error-cwd";
import type { WorkspacePackage } from "~/impl/utils/workspace-utils";
import { sortPackagesByDependencies } from "~/impl/utils/workspace-utils";
import {
	cleanCache,
	DependencyGraph,
	findMonorepo,
	type Monorepo,
	type Package,
	readMonorepoPackageJson,
} from "~/mod";
import { createCompletionTexts } from "../utils/finish-text";

/**
 * Bumps version in workspace package.json files if they match the root package.json version
 */
async function bumpWorkspacePackages(
	workspacePackages: WorkspacePackage[],
	rootVersion: string,
	bumpMode: string,
): Promise<void> {
	if (!workspacePackages || workspacePackages.length === 0) {
		return;
	}

	relinka(
		"verbose",
		`Checking workspace packages for version bumping (root version: ${rootVersion})`,
	);

	for (const pkg of workspacePackages) {
		try {
			// Read the workspace package.json
			const packageJsonContent = await fs.readFile(
				pkg.packageJsonPath,
				"utf-8",
			);
			const packageJson = JSON.parse(packageJsonContent);

			// Check if workspace package version matches root version
			if (packageJson.version === rootVersion) {
				relinka(
					"info",
					`Bumping version for workspace package: ${pkg.name} (${packageJson.version} -> ${getNextVersion(packageJson.version, bumpMode)})`,
				);

				// Update the version using the same bump logic
				packageJson.version = getNextVersion(packageJson.version, bumpMode);

				// Write the updated package.json
				await fs.writeFile(
					pkg.packageJsonPath,
					JSON.stringify(packageJson, null, 2),
				);

				relinka(
					"success",
					`Successfully bumped ${pkg.name} to version ${packageJson.version}`,
				);
			} else {
				relinka(
					"verbose",
					`Skipping ${pkg.name} (version ${packageJson.version} doesn't match root version ${rootVersion})`,
				);
			}
		} catch (error) {
			relinka("warn", `Failed to bump version for ${pkg.name}: ${error}`);
		}
	}
}

/**
 * Gets the next version based on bump mode
 */
function getNextVersion(currentVersion: string, bumpMode: string): string {
	const parts = currentVersion.split(".").map(Number);
	const major = parts[0] || 0;
	const minor = parts[1] || 0;
	const patch = parts[2] || 0;

	switch (bumpMode) {
		case "major":
			return `${major + 1}.0.0`;
		case "minor":
			return `${major}.${minor + 1}.0`;
		case "patch":
		default:
			return `${major}.${minor}.${patch + 1}`;
	}
}

// ==========================
// rse publish
// ==========================

/**
 * Main entry point for the rse build and publish process.
 * Handles building and publishing for both main project and libraries.
 * @see `src/impl/build/impl.ts` for build main function implementation.
 */
export async function dlerPub(
	timer: PerfTimer,
	isDev: boolean,
	config?: ReliverseConfig,
	workspacePackages?: WorkspacePackage[] | null,
	options?: {
		enableCache?: boolean;
		showGraph?: boolean;
		cleanCacheFlag?: boolean;
	},
) {
	let effectiveConfig = config;
	let shouldShowSpinner = false;
	let multiStepSpinner: ReturnType<typeof createMultiStepSpinner> | null = null;

	try {
		if (!effectiveConfig) {
			// Load config with defaults and user overrides
			// This config load is a single source of truth
			effectiveConfig = await getConfigDler();
		}

		// Handle monorepo features if enabled
		let monorepo: Monorepo | null = null;
		let dependencyGraph: DependencyGraph | null = null;

		if (options?.enableCache || options?.showGraph || options?.cleanCacheFlag) {
			monorepo = await findMonorepo();
			if (monorepo) {
				relinka("verbose", `Monorepo detected at: ${monorepo.root}`);

				// Clean cache if requested
				if (options.cleanCacheFlag) {
					await cleanCache(monorepo);
					relinka("log", "✓ Cache cleaned");
				}

				// Create dependency graph
				const { globby } = await import("globby");
				const packageJsonGlobs = monorepo.packageGlobs.map(
					(glob) => `${glob}/package.json`,
				);
				const matches = await globby(packageJsonGlobs, {
					cwd: monorepo.root,
					absolute: true,
				});

				const packages: Package[] = [];
				for (const packageJsonPath of matches) {
					const pkg = await readMonorepoPackageJson(packageJsonPath);
					if (pkg) {
						packages.push(pkg);
					}
				}

				dependencyGraph = new DependencyGraph(packages);

				// Show graph if requested
				if (options.showGraph) {
					dependencyGraph.print();
				}
			} else {
				relinka("warn", "Monorepo features requested but no monorepo detected");
			}
		}

		// Handle workspace packages if provided
		if (workspacePackages && workspacePackages.length > 0) {
			relinka(
				"info",
				`Publishing ${workspacePackages.length} workspace package(s)`,
			);

			// Sort packages by dependencies
			const sortedPackages = sortPackagesByDependencies(workspacePackages);

			// Build and publish each package sequentially
			for (const pkg of sortedPackages) {
				relinka("info", `Processing package: ${pkg.name}`);

				// Create a modified config for this package using root config as base
				const packageConfig = {
					...effectiveConfig,
					// Override package-specific settings
					projectName: pkg.name,
					projectAuthor: "reliverse",
					projectDescription:
						"Dler plugin for code migration and modernization codemods",
					projectLicense: "MIT",
					commonEntrySrcDir: path.join(pkg.path, "src"), // Assume src dir in package
					commonEntryFile: "mod.ts", // Default entry file for workspace packages
					// Override dist directories to be package-specific
					distNpmDirName: path.join("dist-workspace", pkg.name, "npm"),
					distJsrDirName: path.join("dist-workspace", pkg.name, "jsr"),
					libsDirDist: path.join("dist-workspace", pkg.name, "libs"),
					// Get CLI config for this package, fallback to main project config
					commonIsCLI: {
						[pkg.name]: effectiveConfig.commonIsCLI[pkg.name] ||
							effectiveConfig.commonIsCLI["."] ||
							effectiveConfig.commonIsCLI["main"] || {
								enabled: false,
								scripts: {},
							},
					},
					// Use ESM format for workspace packages
					transpileFormat: "esm" as const,
					transpileTarget: "node" as const,
					// Keep readable for libraries
					transpileMinify: false,
					transpileSourcemap: "none" as const,
					// Use package-specific package.json
					corePackageJsonPath: pkg.packageJsonPath,
				};

				// Build this package first
				await dlerBuild({
					flow: "pub",
					timer,
					isDev,
					config: packageConfig,
					debugOnlyCopyNonBuildFiles: false,
					debugDontCopyNonBuildFiles: false,
					disableOwnSpinner: true,
					enableCache: options?.enableCache,
					showGraph: false, // Already shown above if requested
					cleanCacheFlag: false, // Already cleaned above if requested
				});

				// Copy the workspace package's package.json to the dist directory
				const distPackageJsonPath = path.join(
					packageConfig.distNpmDirName,
					"package.json",
				);
				relinka(
					"verbose",
					`Copying package.json from ${pkg.packageJsonPath} to ${distPackageJsonPath}`,
				);
				await fs.copy(pkg.packageJsonPath, distPackageJsonPath);

				// Update the package.json to point to the correct paths (bin directory)
				const packageJsonContent = await fs.readFile(
					distPackageJsonPath,
					"utf-8",
				);
				const packageJson = JSON.parse(packageJsonContent);

				// Update paths to point to bin directory where files are actually built
				packageJson.main = "./bin/mod.js";
				packageJson.types = "./bin/mod.d.ts";
				packageJson.exports = {
					".": {
						types: "./bin/mod.d.ts",
						default: "./bin/mod.js",
					},
				};
				// Determine which files to include in the package
				const filesToInclude = ["bin"];

				// Check for workspace-specific README.md and LICENSE files
				const workspaceReadmePath = path.join(pkg.path, "README.md");
				const workspaceLicensePath = path.join(pkg.path, "LICENSE");
				const rootReadmePath = path.join(PROJECT_ROOT, "README.md");
				const rootLicensePath = path.join(PROJECT_ROOT, "LICENSE");

				// Use workspace README.md if it exists, otherwise use root README.md
				if (await fs.pathExists(workspaceReadmePath)) {
					filesToInclude.push("README.md");
					relinka("verbose", `Using workspace README.md for ${pkg.name}`);
				} else if (await fs.pathExists(rootReadmePath)) {
					filesToInclude.push("README.md");
					relinka("verbose", `Using root README.md for ${pkg.name}`);
				}

				// Use workspace LICENSE if it exists, otherwise use root LICENSE
				if (await fs.pathExists(workspaceLicensePath)) {
					filesToInclude.push("LICENSE");
					relinka("verbose", `Using workspace LICENSE for ${pkg.name}`);
				} else if (await fs.pathExists(rootLicensePath)) {
					filesToInclude.push("LICENSE");
					relinka("verbose", `Using root LICENSE for ${pkg.name}`);
				}

				packageJson.files = filesToInclude;

				// Add missing fields that regular builds have
				packageJson.module = "./bin/mod.js";
				packageJson.publishConfig = { access: "public" };

				// Add homepage if not present
				if (!packageJson.homepage) {
					packageJson.homepage = "https://docs.reliverse.org/cli";
				}

				// Add bugs field if not present
				if (!packageJson.bugs) {
					packageJson.bugs = {
						email: "blefnk@gmail.com",
						url: `https://github.com/reliverse/dler/issues`,
					};
				}

				// Add devDependencies field if not present (empty object)
				if (!packageJson.devDependencies) {
					packageJson.devDependencies = {};
				}

				await fs.writeFile(
					distPackageJsonPath,
					JSON.stringify(packageJson, null, 2),
				);
				relinka(
					"verbose",
					`Updated package.json paths to point to bin directory`,
				);

				// Copy README.md and LICENSE files to dist directory
				if (filesToInclude.includes("README.md")) {
					const readmeSource = (await fs.pathExists(workspaceReadmePath))
						? workspaceReadmePath
						: rootReadmePath;
					const readmeDest = path.join(
						packageConfig.distNpmDirName,
						"README.md",
					);
					await fs.copy(readmeSource, readmeDest);
					relinka(
						"verbose",
						`Copied README.md from ${readmeSource} to ${readmeDest}`,
					);
				}

				if (filesToInclude.includes("LICENSE")) {
					const licenseSource = (await fs.pathExists(workspaceLicensePath))
						? workspaceLicensePath
						: rootLicensePath;
					const licenseDest = path.join(
						packageConfig.distNpmDirName,
						"LICENSE",
					);
					await fs.copy(licenseSource, licenseDest);
					relinka(
						"verbose",
						`Copied LICENSE from ${licenseSource} to ${licenseDest}`,
					);
				}

				// Publish this package
				if (!effectiveConfig.commonPubPause) {
					await regular_pubFlow(timer, isDev, packageConfig);
					await library_pubFlow(timer, isDev, packageConfig);
				}

				relinka("success", `Successfully published package: ${pkg.name}`);
			}

			relinka(
				"success",
				`Successfully published all ${workspacePackages.length} workspace package(s)`,
			);

			// Continue with regular publish flow instead of returning early
			relinka("info", "Publishing main project and libraries...");
		}

		// Start multi-step spinner if commonDisableSpinner is false
		shouldShowSpinner = effectiveConfig.commonDisableSpinner === false;

		const pubSteps = effectiveConfig.commonPubPause
			? [
					"Loading configuration",
					"Version bumping",
					"Building project",
					"Finalizing",
				]
			: [
					"Loading configuration",
					"Version bumping",
					"Building project",
					"Publishing",
					"Finalizing",
				];

		multiStepSpinner = shouldShowSpinner
			? createMultiStepSpinner("Build and Publish Process", pubSteps, {
					color: "cyan",
				})
			: null;

		if (multiStepSpinner) multiStepSpinner.nextStep(); // Move to version bumping

		// Handle version bumping if enabled
		const bumpIsDisabled = await isBumpDisabled();
		if (!bumpIsDisabled && !effectiveConfig.commonPubPause) {
			try {
				// First, bump workspace packages if they match the current root version
				if (workspacePackages && workspacePackages.length > 0) {
					// Get the current root package.json version before bumping
					const rootPackageJson = await fs.readFile("package.json", "utf-8");
					const rootPackage = JSON.parse(rootPackageJson);

					await bumpWorkspacePackages(
						workspacePackages,
						rootPackage.version,
						effectiveConfig.bumpMode,
					);
				}

				// Then bump the main project
				await bumpHandler(
					effectiveConfig.bumpMode,
					false,
					effectiveConfig.bumpFilter,
					effectiveConfig.bumpSet,
				);
				await setBumpDisabledValueTo(true);
			} catch {
				throw new Error("[reliverse.ts] Failed to set bumpDisable to true");
			}
		}

		// Move to building step
		if (multiStepSpinner) multiStepSpinner.nextStep();

		// Build step (disable build's own spinner since pub is handling it)
		const buildResult = await dlerBuild({
			flow: "pub",
			timer,
			isDev,
			config: effectiveConfig,
			debugOnlyCopyNonBuildFiles: false,
			debugDontCopyNonBuildFiles: false,
			disableOwnSpinner: true, // disable build's spinner if pub is showing one
		});

		const buildConfig = buildResult?.effectiveConfig || effectiveConfig;

		// Move to next step based on whether we're publishing
		if (multiStepSpinner) multiStepSpinner.nextStep();

		if (effectiveConfig.commonPubPause) {
			// Finalize build
			await finalizeBuild(
				shouldShowSpinner,
				timer,
				effectiveConfig.commonPubPause,
				"pub",
			);
			// Complete multi-step spinner for build-only with detailed message
			const buildTexts = await createCompletionTexts(
				buildConfig,
				timer,
				"build",
			);
			if (multiStepSpinner) {
				multiStepSpinner.complete(buildTexts.plain);
			} else {
				relinka("success", buildTexts.withEmoji);
			}
		} else {
			// Publish step
			await regular_pubFlow(timer, isDev, buildConfig);
			await library_pubFlow(timer, isDev, buildConfig);

			// Move to finalizing step
			if (multiStepSpinner) multiStepSpinner.nextStep();

			// Finalize publish
			await finalizePub(
				buildConfig.libsList,
				buildConfig.distNpmDirName,
				buildConfig.distJsrDirName,
				buildConfig.libsDirDist,
			);

			// Complete multi-step spinner for build+publish
			const publishTexts = await createCompletionTexts(
				buildConfig,
				timer,
				"publish",
			);
			if (multiStepSpinner) {
				multiStepSpinner.complete(publishTexts.plain);
			} else {
				relinka("success", publishTexts.withEmoji);
			}
		}
	} catch (error) {
		// Stop multi-step spinner with error message if it was running
		if (multiStepSpinner) {
			const currentStep = multiStepSpinner.getCurrentStep();
			multiStepSpinner.error(error as Error, currentStep);
		}
		handleDlerError(error);
	}
}
