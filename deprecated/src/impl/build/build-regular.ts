import path, {
	convertImportsAliasToRelative,
	convertImportsExt,
} from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { build as bunBuild } from "bun";
import prettyMilliseconds from "pretty-ms";
import { unifiedBuild } from "~/impl/build/providers/build";
import {
	CONCURRENCY_DEFAULT,
	PROJECT_ROOT,
	validExtensions,
} from "~/impl/config/constants";
import type {
	BundlerName,
	NpmOutExt,
	ReliverseConfig,
	Sourcemap,
	TranspileFormat,
	TranspileTarget,
} from "~/impl/schema/mod";
import type { PerfTimer, UnifiedBuildConfig } from "~/impl/types/mod";
import {
	getBunSourcemapOption,
	getUnifiedSourcemapOption,
} from "~/impl/utils/utils-build";
import { removeLogInternalCalls } from "~/impl/utils/utils-clean";
import { copyRootFile, deleteSpecificFiles } from "~/impl/utils/utils-fs";
import { createJsrJSON, renameTsxFiles } from "~/impl/utils/utils-jsr-json";
import { regular_createPackageJSON } from "~/impl/utils/utils-package-json-regular";
import { getElapsedPerfTime } from "~/impl/utils/utils-perf";

const ALIAS_PREFIX_TO_CONVERT = "~";

/**
 * Builds a regular JSR distribution.
 * - Copies the entire source directory if `distJsrBuilder` = "jsr"
 * - Otherwise uses bun or a "unified" bundler.
 */
export async function regular_buildJsrDist(
	isDev: boolean,
	isJsr: boolean,
	commonIsCLI: {
		[packageName: string]: {
			enabled: boolean;
			scripts: Record<string, string>;
		};
	},
	packageName: string,
	commonEntrySrcDir: string,
	distJsrDirName: string,
	distJsrBuilder: BundlerName,
	commonEntryFile: string,
	transpileTarget: TranspileTarget,
	transpileFormat: TranspileFormat,
	transpileMinify: boolean,
	transpileSourcemap: Sourcemap,
	transpilePublicPath: string,
	unifiedBundlerOutExt: NpmOutExt,
	config: ReliverseConfig,
	timer: PerfTimer,
	transpileStub: boolean,
	transpileWatch: boolean,
	distJsrGenTsconfig: boolean,
	commonDeclarations: boolean,
): Promise<void> {
	// Get CLI config for this package
	const cliConfig = commonIsCLI[packageName] ||
		commonIsCLI["."] ||
		commonIsCLI["main"] || { enabled: false, scripts: {} };
    const outDirRoot = path.join(process.cwd(), distJsrDirName);
    const jsrOutDirName = config.isWorkspacePackage
        ? `${config.commonBuildOutDir || "bin"}-jsr`
        : config.commonBuildOutDir || "bin";
    const outDirBin = path.join(outDirRoot, jsrOutDirName);
	const singleFile = path.join(
		process.cwd(),
		commonEntrySrcDir,
		commonEntryFile,
	);
	const srcDir = path.join(process.cwd(), commonEntrySrcDir);

	relinka(
		"verbose",
		`Building JSR distribution (isDev=${isDev}, isJsr=${isJsr})...`,
	);

	try {
		// Create the output directory
		await fs.ensureDir(outDirBin);

		// Bundle the project
		await regular_bundleWithBuilder(distJsrBuilder, {
			commonIsCLI: {
				enabled: cliConfig.enabled,
				scripts: cliConfig.scripts,
			},
			commonDeclarations,
			outDir: outDirBin,
			singleFile,
			srcDir,
			timer,
			transpileFormat,
			transpileMinify,
			transpilePublicPath,
			transpileSourcemap,
			transpileStub,
			transpileTarget,
			transpileWatch,
			unifiedBundlerOutExt,
		});

		// Perform common build steps
		await regular_performCommonBuildSteps({
			commonIsCLI: cliConfig,
			isJsr,
			outDirBin,
			outDirRoot,
			config,
			unifiedBundlerOutExt,
			commonDescription: config.commonDescription,
			commonBuildOutDir: config.commonBuildOutDir,
		});

		// Generate tsconfig.json for JSR
		if (distJsrGenTsconfig) {
			await regular_createTsconfig(outDirRoot);
		}

		// JSR-specific post-build steps
		relinka(
			"verbose",
			`Performing JSR-specific transformations in ${outDirBin}`,
		);
		await createJsrJSON(
			outDirRoot,
			false, // isLib
			{}, // libsList (empty for regular builds)
			config,
			undefined, // libName (not needed for regular builds)
			config.commonDescription,
		);
		await renameTsxFiles(outDirBin);

		// Calculate and log build duration only if publishing is paused
		if (config.commonPubPause) {
			const duration = getElapsedPerfTime(timer);
			const transpileFormattedDuration = prettyMilliseconds(duration, {
				verbose: true,
			});
			relinka(
				"verbose",
				`JSR distribution built in ${transpileFormattedDuration}`,
			);
		} else {
			relinka("verbose", "JSR distribution built successfully");
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		relinka("error", `Failed to build JSR distribution: ${errorMessage}`);
		throw new Error(`JSR distribution build failed: ${errorMessage}`);
	}
}

/**
 * Builds a regular NPM distribution.
 * - Copies entire src dir if "jsr"
 * - Otherwise uses Bun or a unified builder
 */
export async function regular_buildNpmDist(
	isDev: boolean,
	commonIsCLI: {
		[packageName: string]: {
			enabled: boolean;
			scripts: Record<string, string>;
		};
	},
	packageName: string,
	commonEntrySrcDir: string,
	distNpmDirName: string,
	distNpmBuilder: BundlerName,
	commonEntryFile: string,
	unifiedBundlerOutExt: NpmOutExt,
	config: ReliverseConfig,
	transpileTarget: TranspileTarget,
	transpileFormat: TranspileFormat,
	transpileMinify: boolean,
	transpileSourcemap: Sourcemap,
	transpilePublicPath: string,
	transpileStub: boolean,
	transpileWatch: boolean,
	timer: PerfTimer,
	commonDeclarations: boolean,
): Promise<void> {
	// Get CLI config for this package
	const cliConfig = commonIsCLI[packageName] ||
		commonIsCLI["."] ||
		commonIsCLI["main"] || { enabled: false, scripts: {} };
    const outDirRoot = path.join(process.cwd(), distNpmDirName);
    const outDirBin = path.join(outDirRoot, config.commonBuildOutDir || "bin");
	const singleFile = path.join(
		process.cwd(),
		commonEntrySrcDir,
		commonEntryFile,
	);
	const srcDir = path.join(process.cwd(), commonEntrySrcDir);

	relinka("verbose", `Building NPM distribution (isDev=${isDev})...`);

	try {
		// Create the output directory
		await fs.ensureDir(outDirBin);

		// Bundle the project
		await regular_bundleWithBuilder(distNpmBuilder, {
			commonIsCLI: {
				enabled: cliConfig.enabled,
				scripts: cliConfig.scripts,
			},
			commonDeclarations,
			outDir: outDirBin,
			singleFile,
			srcDir,
			timer,
			transpileFormat,
			transpileMinify,
			transpilePublicPath,
			transpileSourcemap,
			transpileStub,
			transpileTarget,
			transpileWatch,
			unifiedBundlerOutExt,
		});

		// Perform common build steps
		await regular_performCommonBuildSteps({
			commonIsCLI: cliConfig,
			isJsr: false,
			outDirBin,
			outDirRoot,
			config,
			unifiedBundlerOutExt,
			commonDescription: config.commonDescription,
			commonBuildOutDir: config.commonBuildOutDir,
		});

		// Calculate and log build duration only if publishing is paused
		if (config.commonPubPause) {
			const duration = getElapsedPerfTime(timer);
			const transpileFormattedDuration = prettyMilliseconds(duration, {
				verbose: true,
			});
			relinka(
				"verbose",
				`NPM distribution built in ${transpileFormattedDuration}`,
			);
		} else {
			relinka("verbose", "NPM distribution built successfully");
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		relinka("error", `Failed to build NPM distribution: ${errorMessage}`);
		throw new Error(`NPM distribution build failed: ${errorMessage}`);
	}
}

/**
 * Bundles a regular project using Bun.
 */
async function regular_bundleUsingBun(
	commonEntryFile: string,
	outDirBin: string,
	transpileTarget: TranspileTarget,
	transpileFormat: TranspileFormat,
	transpileMinify: boolean,
	transpileSourcemap: Sourcemap,
	transpilePublicPath: string,
	timer: PerfTimer,
): Promise<void> {
	relinka(
		"verbose",
		`Bundling regular project using Bun (entry: ${commonEntryFile}, outDir: ${outDirBin})`,
	);

	if (!(await fs.pathExists(commonEntryFile))) {
		relinka("error", `Could not find entry file at: ${commonEntryFile}`);
		throw new Error(`Entry file not found: ${commonEntryFile}`);
	}

	try {
		const buildResult = await bunBuild({
			banner: "/* Bundled by @reliverse/dler */",
			define: {
				"process.env.NODE_ENV": JSON.stringify(
					process.env.NODE_ENV || "production",
				),
			},
			drop: ["debugger"],
			entrypoints: [commonEntryFile],
			footer: "/* End of bundle */",
			format: transpileFormat,
			minify: transpileMinify,
			naming: {
				asset: "[name]-[hash].[ext]",
				chunk: "[name]-[hash].[ext]",
				entry: "[dir]/[name]-[hash].[ext]",
			},
			outdir: outDirBin,
			publicPath: transpilePublicPath || "/",
			sourcemap: getBunSourcemapOption(transpileSourcemap),
			target: transpileTarget,
			throw: true,
		});

		// Build duration
		const duration = getElapsedPerfTime(timer);
		const transpileFormattedDuration = prettyMilliseconds(duration, {
			verbose: true,
		});
		relinka(
			"verbose",
			`Regular bun build completed in ${transpileFormattedDuration} with ${buildResult.outputs.length} output file(s).`,
		);

		if (buildResult.logs && buildResult.logs.length > 0) {
			buildResult.logs.forEach((log, index) => {
				relinka("verbose", `Log ${index + 1}: ${JSON.stringify(log)}`);
			});
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		relinka(
			"error",
			`Regular build failed while using bun bundler: ${errorMessage}`,
		);
		throw new Error(`Regular bundle failed for ${outDirBin}: ${errorMessage}`);
	}
}

/**
 * Bundles a regular project using JSR by copying the source directory.
 */
async function regular_bundleUsingJsr(
	src: string,
	dest: string,
): Promise<void> {
	relinka("verbose", `Starting regular_bundleUsingJsr: ${src} -> ${dest}`);
	await fs.ensureDir(path.dirname(dest));

	// Validate source is a directory
	const stats = await fs.stat(src);
	if (!stats.isDirectory()) {
		throw new Error(
			"Please provide path to directory instead of path to file when using 'jsr' builder.",
		);
	}

	try {
		// Copy the files
		await fs.copy(src, dest, { overwrite: true });
		relinka("verbose", `Copied directory from ${src} to ${dest}`);

		// Convert import paths in the copied files
		// const results = await convertImportPaths({
		//   baseDir: dest,
		//   fromType: "alias",
		//   toType: "relative",
		//   aliasPrefix: "~/",
		//   libsList: {},
		//   distJsrDryRun: false,
		// });
		// const successCount = results.filter((r) => r.success).length;
		// const changedCount = results.filter((r) =>
		//   r.message.startsWith("Processed"),
		// ).length;

		relinka(
			"verbose",
			`Completed regular bundling via 'jsr' builder`,
			// `${successCount} files processed, ${changedCount} modified`,
		);
	} catch (error) {
		// crash if there's an error
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(errorMessage);
	}
}

/**
 * Bundles a regular project using a unified builder (rollup, mkdist, etc.).
 */
async function regular_bundleUsingUnified(
	commonIsCLI: { enabled: boolean; scripts: Record<string, string> },
	commonEntryFile: string,
	outDirBin: string,
	builder: BundlerName,
	unifiedBundlerOutExt: NpmOutExt,
	commonEntrySrcDir: string,
	transpileStub: boolean,
	transpileWatch: boolean,
	transpileTarget: TranspileTarget,
	transpileMinify: boolean,
	transpileSourcemap: Sourcemap,
	timer: PerfTimer,
	commonDeclarations: boolean,
): Promise<void> {
	if (builder === "jsr" || builder === "bun") {
		throw new Error(
			"'jsr'/'bun' builder not supported for regular_bundleUsingUnified",
		);
	}

	try {
		relinka(
			"verbose",
			`Starting regular_bundleUsingUnified (builder: ${builder}): ${commonEntryFile} -> ${outDirBin}`,
		);
		const rootDir = PROJECT_ROOT;
		const srcDirResolved = path.resolve(PROJECT_ROOT, commonEntrySrcDir);

		// Validate extension
		if (!validExtensions.includes(unifiedBundlerOutExt)) {
			throw new Error(`Invalid output extension: ${unifiedBundlerOutExt}`);
		}

		// For mkdist, pass the entire directory
		// For other unified builders, pass the single file
		const input =
			builder === "mkdist" ? path.dirname(commonEntryFile) : commonEntryFile;

		const unifiedBuildConfig = {
			clean: false,
			concurrency: CONCURRENCY_DEFAULT,
			declaration: commonDeclarations,
			entries: [
				{
					builder,
					ext: unifiedBundlerOutExt,
					input:
						builder === "mkdist"
							? path.relative(rootDir, srcDirResolved) // Use relative path from PROJECT_ROOT to src dir
							: path.relative(rootDir, input), // For other builders, use relative path to entry file
					outDir: path.relative(rootDir, outDirBin),
					isLib: false,
				},
			],
			rollup: {
				emitCJS: false,
				esbuild: {
					minify: transpileMinify,
					target: transpileTarget,
				},
				inlineDependencies: true,
				output: {
					sourcemap: getUnifiedSourcemapOption(transpileSourcemap),
				},
			},
			showOutLog: true,
			transpileStub,
			transpileWatch: transpileWatch ?? false,
		} satisfies UnifiedBuildConfig & { concurrency?: number };

		await unifiedBuild(
			commonEntrySrcDir,
			commonIsCLI,
			false,
			rootDir,
			unifiedBuildConfig,
			outDirBin,
		);

		// Calculate and log build duration
		const duration = getElapsedPerfTime(timer);
		const transpileFormattedDuration = prettyMilliseconds(duration, {
			verbose: true,
		});
		relinka(
			"verbose",
			`Regular bundle completed in ${transpileFormattedDuration} using ${builder} builder`,
		);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		relinka(
			"error",
			`Failed to bundle regular project using ${builder}: ${errorMessage}`,
		);
		throw new Error(`Regular bundle failed for ${outDirBin}: ${errorMessage}`);
	}
}

/**
 * Helper function to decide bundler approach: "jsr" vs "bun" vs "unified".
 */
async function regular_bundleWithBuilder(
	builder: BundlerName,
	params: {
		commonIsCLI: { enabled: boolean; scripts: Record<string, string> };
		commonDeclarations: boolean;
		outDir: string;
		singleFile: string; // single entry file (used if bun/unified)
		srcDir: string; // entire directory (used if builder=jsr)
		timer: PerfTimer;
		transpileFormat: TranspileFormat;
		transpileMinify: boolean;
		transpilePublicPath: string;
		transpileSourcemap: Sourcemap;
		transpileStub: boolean;
		transpileTarget: TranspileTarget;
		transpileWatch: boolean;
		unifiedBundlerOutExt: NpmOutExt;
	},
): Promise<void> {
	const {
		commonIsCLI,
		commonDeclarations,
		outDir,
		singleFile,
		srcDir,
		timer,
		transpileFormat,
		transpileMinify,
		transpilePublicPath,
		transpileSourcemap,
		transpileStub,
		transpileTarget,
		transpileWatch,
		unifiedBundlerOutExt,
	} = params;

	// The "jsr" builder is basically a directory copy
	if (builder === "jsr") {
		await regular_bundleUsingJsr(srcDir, outDir);
		return;
	}

	// The "bun" builder uses a single entry file
	if (builder === "bun") {
		await regular_bundleUsingBun(
			singleFile,
			outDir,
			transpileTarget,
			transpileFormat,
			transpileMinify,
			transpileSourcemap,
			transpilePublicPath,
			timer,
		);
		return;
	}

	// Everything else is a "unified" type builder (rollup, mkdist, etc.)
	await regular_bundleUsingUnified(
		commonIsCLI,
		singleFile,
		outDir,
		builder,
		unifiedBundlerOutExt,
		// For mkdist, we pass the directory. For others, we pass the single file
		path.dirname(singleFile),
		transpileStub,
		transpileWatch,
		transpileTarget,
		transpileMinify,
		transpileSourcemap,
		timer,
		commonDeclarations,
	);
}

/**
 * Common build steps shared between JSR and NPM distributions.
 * - Convert imports, rename main entry file, optionally delete files, etc.
 */
async function regular_performCommonBuildSteps({
	commonIsCLI,
	deleteFiles = true,
	isJsr,
	outDirBin,
	outDirRoot,
	config,
	unifiedBundlerOutExt,
	commonDescription,
	commonBuildOutDir,
}: {
	commonIsCLI: { enabled: boolean; scripts: Record<string, string> };
	deleteFiles?: boolean;
	isJsr: boolean;
	outDirBin: string;
	outDirRoot: string;
	config: ReliverseConfig;
	unifiedBundlerOutExt: NpmOutExt;
	commonDescription: string;
	commonBuildOutDir?: string;
}): Promise<void> {
	relinka("verbose", `Performing common build steps in ${outDirBin} (regular)`);

	// await convertImportPaths({
	//   aliasPrefix: "~/",
	//   baseDir: outDirBin,
	//   fromType: "alias",
	//   libsList: {},
	//   toType: "relative",
	// });
	// Convert any "~/..." alias imports to relative
	relinka(
		"verbose",
		`[${isJsr ? "dist-jsr" : "dist-npm"}] Performing alias path conversion in ${outDirBin}`,
	);
	await convertImportsAliasToRelative({
		targetDir: outDirBin,
		aliasToReplace: ALIAS_PREFIX_TO_CONVERT,
		pathExtFilter: "js-ts-none",
	});
	if (isJsr) {
		relinka(
			"verbose",
			`[dist-jsr] Performing paths ext conversion in ${outDirBin} (from js to ts)`,
		);
		await convertImportsExt({
			targetDir: outDirBin,
			extFrom: "js",
			extTo: "ts",
		});
		await convertImportsExt({
			targetDir: outDirBin,
			extFrom: "none",
			extTo: "ts",
		});
	}

	// Clean up the dist from potential internal logging
	await removeLogInternalCalls(outDirBin);

	// Delete undesired files
	if (deleteFiles) {
		await deleteSpecificFiles(outDirBin);
	}

	// Create a package.json for this distribution
	await regular_createPackageJSON(
		outDirRoot,
		isJsr,
		commonIsCLI,
		unifiedBundlerOutExt,
		config,
		commonDescription,
		commonBuildOutDir,
	);

	// Copy some root files (README, LICENSE, etc.)
    await copyRootFile(
        outDirRoot,
        config.publishArtifacts?.global || ["README.md", "LICENSE"],
        { skipIfExists: Boolean(config.isWorkspacePackage) },
    );

	// Copy a few more if it's JSR and it's a CLI
	if (isJsr && commonIsCLI.enabled) {
		const jsrFiles = config.publishArtifacts?.["dist-jsr"] || [
			".gitignore",
			"reliverse.ts",
			"reliverse.jsonc",
			"drizzle.config.ts",
			"schema.json",
		];
        await copyRootFile(
            outDirRoot,
            jsrFiles,
            { skipIfExists: Boolean(config.isWorkspacePackage) },
        );
	}

	// Rename the main entry file
	// TODO: remove in the future (deprecated)
	// relinka("verbose", `Renaming entry file in ${outDirBin}.`);
	// await renameEntryFile(
	//   isJsr,
	//   outDirBin,
	//   config.commonEntryFile,
	//   unifiedBundlerOutExt,
	//   config.distJsrOutFilesExt,
	// );
}

/**
 * Creates a tsconfig.json file for JSR distribution.
 */
async function regular_createTsconfig(outDirRoot: string): Promise<void> {
	const tsconfigPath = path.join(outDirRoot, "tsconfig.json");
	const tsconfig = {
		compilerOptions: {
			target: "ES2022",
			module: "ESNext",
			moduleResolution: "bundler",
			declaration: true,
			declarationMap: true,
			sourceMap: true,
			strict: true,
			skipLibCheck: true,
			esModuleInterop: true,
			resolveJsonModule: true,
			isolatedModules: true,
			noUnusedLocals: true,
			noUnusedParameters: true,
			noImplicitReturns: true,
			noFallthroughCasesInSwitch: true,
		},
		include: ["**/*.ts"],
		exclude: ["node_modules", "dist"],
	};

	await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
	relinka("verbose", `Created tsconfig.json at ${tsconfigPath}`);
}
