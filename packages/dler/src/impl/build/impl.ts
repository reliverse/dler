import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { createMultiStepSpinner } from "@reliverse/rempts";
import { binary_buildFlow } from "~/impl/build/binary-flow";
import { library_buildFlow } from "~/impl/build/library-flow";
import { regular_buildFlow } from "~/impl/build/regular-flow";
import { PROJECT_ROOT } from "~/impl/config/constants";
import { getConfigDler } from "~/impl/config/load";
import type { ReliverseConfig } from "~/impl/schema/mod";
import type { PerfTimer } from "~/impl/types/mod";
import { removeDistFolders } from "~/impl/utils/utils-clean";
import { handleDlerError } from "~/impl/utils/utils-error-cwd";
import type { WorkspacePackage } from "~/impl/utils/workspace-utils";
import { sortPackagesByDependencies } from "~/impl/utils/workspace-utils";
import {
	cachePackageOutput,
	cleanCache,
	DependencyGraph,
	findMonorepo,
	hashPackage,
	isPackageCached,
	type Monorepo,
	type Package,
	readMonorepoPackageJson,
	restorePackageCache,
} from "~/mod";
import { createCompletionTexts } from "../utils/finish-text";
import { dlerPostBuild, wrapper_CopyNonBuildFiles } from "./postbuild";
import { dlerPreBuild } from "./prebuild";

// ==========================
// rse build
// ==========================

/**
 * Main entry point for the rse build process.
 * Handles building for both main project and libraries.
 * @see `src/impl/pub/impl.ts` for pub main function implementation.
 */
export async function dlerBuild({
	flow,
	timer,
	isDev,
	config,
	debugOnlyCopyNonBuildFiles,
	debugDontCopyNonBuildFiles,
	disableOwnSpinner,
	workspacePackages,
	enableCache,
	depsOnly,
	showGraph,
	cleanCacheFlag,
	cwd,
}: {
	flow: "build" | "pub";
	timer: PerfTimer;
	isDev: boolean;
	config?: ReliverseConfig;
	debugOnlyCopyNonBuildFiles?: boolean;
	debugDontCopyNonBuildFiles?: boolean;
	disableOwnSpinner?: boolean;
	workspacePackages?: WorkspacePackage[] | null;
	enableCache?: boolean;
	depsOnly?: boolean;
	showGraph?: boolean;
	cleanCacheFlag?: boolean;
	cwd?: string;
}) {
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

		if (enableCache || depsOnly || showGraph || cleanCacheFlag) {
			monorepo = await findMonorepo();
			if (monorepo) {
				relinka("verbose", `Monorepo detected at: ${monorepo.root}`);

				// Clean cache if requested
				if (cleanCacheFlag) {
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
				if (showGraph) {
					dependencyGraph.print();
				}

				// Handle deps-only mode
				if (depsOnly) {
					const activePackage = dependencyGraph.findActivePackage();
					if (activePackage) {
						const dependencies =
							dependencyGraph.getPackageDependenciesBuildOrder(
								activePackage.name,
							);
						relinka(
							"info",
							`Building dependencies for ${activePackage.name}: ${dependencies.map((p) => p.name).join(", ")}`,
						);

						// Build dependencies with caching if enabled
						for (const pkg of dependencies) {
							await buildCachedPackage(pkg, monorepo, enableCache || false);
						}

						relinka("log", "✓ Dependencies built");
						return; // Exit early for deps-only mode
					} else {
						relinka(
							"warn",
							"Not in a package directory, cannot determine dependencies",
						);
					}
				}
			} else {
				relinka("warn", "Monorepo features requested but no monorepo detected");
			}
		}

		// Check if main project source directory exists
		const projectRoot = cwd || PROJECT_ROOT;
		const mainSrcDir = path.join(
			projectRoot,
			effectiveConfig.commonEntrySrcDir,
		);
		relinka("verbose", `Project root: ${projectRoot}`);
		relinka(
			"verbose",
			`CommonEntrySrcDir: ${effectiveConfig.commonEntrySrcDir}`,
		);
		relinka("verbose", `Main source directory: ${mainSrcDir}`);
		relinka(
			"verbose",
			`Config loaded from: ${config ? "provided" : "default"}`,
		);
		const mainSrcExists = await fs.pathExists(mainSrcDir);

		// Handle workspace packages if provided
		if (workspacePackages && workspacePackages.length > 0) {
			relinka(
				"info",
				`Building ${workspacePackages.length} workspace package(s)`,
			);
			relinka(
				"verbose",
				`Workspace packages: ${workspacePackages.map((p) => p.name).join(", ")}`,
			);

			// Sort packages by dependencies
			const sortedPackages = sortPackagesByDependencies(workspacePackages);

			// Build each package sequentially
			for (const pkg of sortedPackages) {
				relinka("info", `Building package: ${pkg.name}`);

				// Create a modified config for this package using root config as base
				const packageConfig = {
					...effectiveConfig,
					// Override package-specific settings
					projectName: pkg.name,
					projectAuthor: "reliverse",
					projectDescription:
						"Dler plugin for code migration and modernization codemods",
					projectLicense: "MIT",
					commonEntrySrcDir: path.join(pkg.path, "src"), // Use "src" directory in workspace package
					commonEntryFile: "mod.ts", // Default entry file for workspace packages
					// Always write directly into the package directory for workspaces
					distNpmDirName: pkg.path,
					distJsrDirName: pkg.path,
					libsDirDist: pkg.path,
					isWorkspacePackage: true,
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

				// Build this package
				await regular_buildFlow(timer, isDev, packageConfig);
				await library_buildFlow(timer, isDev, packageConfig);
				await binary_buildFlow(timer, isDev, packageConfig);

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
				const rootReadmePath = path.join(projectRoot, "README.md");
				const rootLicensePath = path.join(projectRoot, "LICENSE");

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

				relinka("success", `Successfully built package: ${pkg.name}`);
			}

			relinka(
				"success",
				`Successfully built all ${workspacePackages.length} workspace package(s)`,
			);

			// Check if we should skip main project build
			if (!mainSrcExists) {
				relinka(
					"info",
					"Skipping main project build - source directory does not exist",
				);
				relinka("verbose", `Main source directory not found: ${mainSrcDir}`);

				// Complete the build process without main project
				if (flow === "build") {
					const { plain, withEmoji } = await createCompletionTexts(
						effectiveConfig,
						timer,
						"build",
					);
					relinka("success", withEmoji);
				}
				return { timer, effectiveConfig };
			}

			// Continue with regular build flow instead of returning early
			relinka("info", "Building main project and libraries...");
		}

		// Check if main project source directory exists when no workspace packages
		if (!mainSrcExists) {
			relinka(
				"error",
				`Main project source directory does not exist: ${mainSrcDir}`,
			);
			relinka(
				"error",
				"Please ensure the source directory exists or configure workspace packages",
			);
			process.exit(1);
		}

		// Start multi-step spinner if commonDisableSpinner is false and not disabled by caller
		shouldShowSpinner =
			effectiveConfig.commonDisableSpinner === false && !disableOwnSpinner;

		const buildSteps = [
			"Loading configuration",
			"Cleaning previous build",
			"Pre-build setup",
			"Building main project",
			"Building libraries",
			"Building binaries",
			"Post-build cleanup",
		];

		multiStepSpinner = shouldShowSpinner
			? createMultiStepSpinner("Build Process", buildSteps, { color: "blue" })
			: null;

		if (multiStepSpinner) multiStepSpinner.nextStep(); // Move to cleaning step

		// Clean up previous run artifacts
		if (effectiveConfig.logsFreshFile) {
			await fs.remove(path.join(projectRoot, effectiveConfig.logsFileName));
		}
		await removeDistFolders(
			effectiveConfig.distNpmDirName,
			effectiveConfig.distJsrDirName,
			effectiveConfig.libsDirDist,
			effectiveConfig.libsList,
			"dist-tmp",
		);

		// Move to pre-build step
		if (multiStepSpinner) multiStepSpinner.nextStep();

		if (debugOnlyCopyNonBuildFiles) {
			if (debugDontCopyNonBuildFiles) {
				relinka(
					"error",
					"📝 debugOnlyCopyNonBuildFiles and debugDontCopyNonBuildFiles cannot be used together",
				);
				process.exit(1);
			}

			await wrapper_CopyNonBuildFiles(effectiveConfig);

			relinka(
				"info",
				"📝 debugOnlyCopyNonBuildFiles was used, build finished, exiting...",
			);
			process.exit(0);
		}

		// Run pre checks/tools/hooks and copy files to temp directories
		await dlerPreBuild(effectiveConfig);

		// Move to building main project step
		if (multiStepSpinner) multiStepSpinner.nextStep();

		// Build main project and, if configured, libraries
		// Use temporary directories as source for bundlers
		const tempDirs = {
			npm: "dist-tmp/tmp-npm",
			jsr: "dist-tmp/tmp-jsr",
			libs: "dist-tmp/tmp-libs",
		};

		// Create a modified config that points to temp directories
		const tempConfig = {
			...effectiveConfig,
			commonEntrySrcDir: tempDirs.npm,
			libsDirSrc: tempDirs.libs,
		};

		await regular_buildFlow(timer, isDev, tempConfig);

		// Move to building libraries step
		if (multiStepSpinner) multiStepSpinner.nextStep();
		await library_buildFlow(timer, isDev, tempConfig);

		// Move to building binaries step
		if (multiStepSpinner) multiStepSpinner.nextStep();
		await binary_buildFlow(timer, isDev, tempConfig);

		// Move to post-build step
		if (multiStepSpinner) multiStepSpinner.nextStep();

		// Run post checks/tools/hooks and copy non-build files
		await dlerPostBuild(isDev, debugDontCopyNonBuildFiles);

		// Clean up temp directories
		if (effectiveConfig.postBuildSettings?.deleteDistTmpAfterBuild) {
			await fs.remove(path.join(projectRoot, "dist-tmp"));
		}

		// Complete multi-step spinner with success message
		if (flow === "build") {
			const { plain, withEmoji } = await createCompletionTexts(
				effectiveConfig,
				timer,
				"build",
			);
			if (multiStepSpinner) {
				multiStepSpinner.complete(plain);
			} else {
				relinka("success", withEmoji);
			}
		}

		return { timer, effectiveConfig };
	} catch (error) {
		// Stop multi-step spinner with error message if it was running
		if (multiStepSpinner) {
			const currentStep = multiStepSpinner.getCurrentStep();
			multiStepSpinner.error(error as Error, currentStep);
		}
		handleDlerError(error);
	}
}

/**
 * Build a single package with caching support
 */
async function buildCachedPackage(
	pkg: Package,
	monorepo: Monorepo,
	enableCache: boolean,
): Promise<void> {
	if (!pkg.buildScript) {
		relinka("log", `✓ ${pkg.name}: Nothing to build`);
		return;
	}

	relinka("log", `◐ ${pkg.name}: ${pkg.buildScript}`);

	if (enableCache) {
		const { packageHash } = await hashPackage(pkg);

		// Check if package is cached
		if (
			(await isPackageCached(monorepo, pkg, packageHash)) &&
			pkg.config.cache
		) {
			await restorePackageCache(monorepo, pkg, packageHash);
			relinka("log", `✓ ${pkg.name}: Cached!`);
			return;
		}

		// Build the package
		const { execaCommand } = await import("execa");
		const args = [...monorepo.packageManager.runCmd, "build"];
		await execaCommand(args.join(" "), {
			cwd: pkg.dir,
			env: { ...process.env, INSIDE_DLER: "true" },
		});

		// Cache the output if enabled
		if (pkg.config.cache) {
			await cachePackageOutput(monorepo, pkg, packageHash);
		}
	} else {
		// Build without caching
		const { execaCommand } = await import("execa");
		const args = [...monorepo.packageManager.runCmd, "build"];
		await execaCommand(args.join(" "), {
			cwd: pkg.dir,
			env: { ...process.env, INSIDE_DLER: "true" },
		});
	}

	relinka("log", `✓ ${pkg.name}: Built`);
}
