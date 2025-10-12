import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
// import { callCmd } from "@reliverse/rempts";
import { glob } from "tinyglobby";
// import { default as checkCmd } from "~/impl/check/cmd";
import { PROJECT_ROOT } from "~/impl/config/constants";
import type { ReliverseConfig } from "~/impl/schema/mod";

import {
	executeCommand,
	executeDlerHooks,
	isCommandAvailable,
} from "./ppb-utils";

type ToolName = "tsc" | "eslint" | "biome" | "knip" | "dler-check";

const createToolRunner = () =>
	({
		tsc: {
			name: "TypeScript compiler",
			run: () => executeCommand("tsc --noEmit"),
		},
		eslint: {
			name: "ESLint",
			run: () => executeCommand("eslint --cache --fix ."),
		},
		biome: {
			name: "Biome",
			run: () => executeCommand("biome check --fix --unsafe ."),
		},
		knip: {
			name: "Knip",
			run: () => executeCommand("knip"),
		},
		"dler-check": {
			name: "Dler Check",
			async run() {
				// TODO: uncomment this
				// await callCmd(checkCmd, {
				//   "no-exit": true,
				//   "no-progress": true,
				// });
			},
		},
	}) as const;

async function copyFilesToTempDir(
	srcDir: string,
	tempDir: string,
	extensions: string[],
	excludeDir: string,
): Promise<void> {
	try {
		// Create temp directory if it doesn't exist
		await fs.ensureDir(tempDir);

		// Get all files in src directory
		const files = await glob("**/*", {
			cwd: srcDir,
			ignore: [`**/${excludeDir}/**`],
			onlyFiles: true,
		});

		// Filter files by extension and copy them
		for (const file of files) {
			const ext = path.extname(file).slice(1);
			if (extensions.includes(ext)) {
				const srcPath = path.join(srcDir, file);
				const destPath = path.join(tempDir, file);
				await fs.ensureDir(path.dirname(destPath));
				await fs.copy(srcPath, destPath);
			}
		}
	} catch (error) {
		relinka(
			"error",
			`Error copying files to temp directory: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
}

export async function dlerPreBuild(config: ReliverseConfig): Promise<void> {
	relinka("verbose", "— — — dlerPreBuild — — —");

	await executeDlerHooks(config?.hooksBeforeBuild ?? [], "pre-build");

	// Create temporary directories and copy files
	const tempDirs = {
		npm: path.join(PROJECT_ROOT, "dist-tmp", "tmp-npm"),
		jsr: path.join(PROJECT_ROOT, "dist-tmp", "tmp-jsr"),
		libs: path.join(PROJECT_ROOT, "dist-tmp", "tmp-libs"),
	};

	// Clean up previous temp directories
	for (const dir of Object.values(tempDirs)) {
		await fs.remove(dir);
	}

	// Copy files to temp directories based on registry configuration
	if (
		config.commonPubRegistry === "npm" ||
		config.commonPubRegistry === "npm-jsr"
	) {
		const srcDir = path.join(PROJECT_ROOT, config.commonEntrySrcDir);
		if (await fs.pathExists(srcDir)) {
			await copyFilesToTempDir(
				srcDir,
				tempDirs.npm,
				config.buildPreExtensions,
				config.buildTemplatesDir,
			);
		} else {
			relinka(
				"verbose",
				`Skipping NPM build - source directory does not exist: ${srcDir}`,
			);
		}
	}

	if (
		config.commonPubRegistry === "jsr" ||
		config.commonPubRegistry === "npm-jsr"
	) {
		const srcDir = path.join(PROJECT_ROOT, config.commonEntrySrcDir);
		if (await fs.pathExists(srcDir)) {
			await copyFilesToTempDir(
				srcDir,
				tempDirs.jsr,
				config.buildPreExtensions,
				config.buildTemplatesDir,
			);
		} else {
			relinka(
				"verbose",
				`Skipping JSR build - source directory does not exist: ${srcDir}`,
			);
		}
	}

	if (
		config.libsActMode === "libs-only" ||
		config.libsActMode === "main-and-libs"
	) {
		const libsSrcDir = path.join(PROJECT_ROOT, config.libsDirSrc);
		if (await fs.pathExists(libsSrcDir)) {
			await copyFilesToTempDir(
				libsSrcDir,
				tempDirs.libs,
				config.buildPreExtensions,
				config.buildTemplatesDir,
			);
		} else {
			relinka(
				"verbose",
				`Skipping libraries build - source directory does not exist: ${libsSrcDir}`,
			);
		}
	}

	if (!config?.runBeforeBuild?.length) return;

	const tools = createToolRunner();

	const availableTools = await Promise.all(
		config.runBeforeBuild.map(async (toolName) => {
			const tool = tools[toolName as ToolName];
			if (!tool) return null;

			// For dler-check, we don't need to check availability
			if (toolName === "dler-check") {
				return { toolName, ...tool };
			}

			// Check if command is available either in package.json or globally
			const isAvailable = await isCommandAvailable(toolName);
			return isAvailable ? { toolName, ...tool } : null;
		}),
	);

	const commandsToRun = availableTools.filter(Boolean);

	for (const { name, run } of commandsToRun as {
		name: string;
		run: () => Promise<void>;
	}[]) {
		relinka("verbose", `Running ${name}...`);
		await run();
	}
}
