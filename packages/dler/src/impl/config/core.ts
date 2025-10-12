// TODO: make everything to be defined in a main single reliverse.ts file

import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import {
	cliConfigJsonc,
	cliConfigTs,
	RSE_SCHEMA_DEV,
	UNKNOWN_VALUE,
} from "~/impl/config/constants";
import { createReliverseConfig } from "~/impl/config/create";
import { getReliverseConfigPath } from "~/impl/config/path";
import { readReliverseConfig } from "~/impl/config/read";
import { parseAndFixReliverseConfig } from "~/impl/config/repair";
import type { ReliverseConfig } from "~/impl/schema/mod";
import { DEFAULT_CONFIG_RELIVERSE } from "~/impl/schema/mod";

/* ------------------------------------------------------------------
 * The Core Logic: Handle or Verify Config + MULTI-CONFIG
 * ------------------------------------------------------------------
 */

/**
 * Retrieves or creates the main rseg (and any 'mrse' configs).
 * Allows an optional custom path to the TS config file.
 */
export async function getOrCreateReliverseConfig({
	projectPath,
	isDev,
	overrides,
	customTsconfigPath,
}: {
	projectPath: string;
	isDev: boolean;
	overrides: Partial<ReliverseConfig>;
	customTsconfigPath?: string;
}): Promise<{ config: ReliverseConfig; mrse: ReliverseConfig[] }> {
	const githubUsername = UNKNOWN_VALUE;
	const mrseFolderPath = path.join(projectPath, "mrse");
	const results: ReliverseConfig[] = [];

	// Collect additional configs in "mrse" folder
	if (await fs.pathExists(mrseFolderPath)) {
		const dirItems = await fs.readdir(mrseFolderPath);
		const rseFiles = dirItems.filter(
			(item) => item === cliConfigJsonc || item === cliConfigTs,
		);
		const configs = await Promise.all(
			rseFiles.map(async (file) => {
				const filePath = path.join(mrseFolderPath, file);
				let foundConfig = await readReliverseConfig(filePath, isDev);
				if (!foundConfig) {
					foundConfig = await parseAndFixReliverseConfig(filePath, isDev);
				}
				if (!foundConfig) {
					relinka("warn", `Skipping invalid config file: ${filePath}`);
				}
				return foundConfig;
			}),
		);
		results.push(
			...configs.filter(
				(cfg: ReliverseConfig | null): cfg is ReliverseConfig => cfg !== null,
			),
		);
	}

	// Retrieve the path to the main rseg
	const { configPath } = await getReliverseConfigPath(
		projectPath,
		isDev,
		false,
		customTsconfigPath,
	);

	// Ensure a config file exists
	if (!(await fs.pathExists(configPath))) {
		await createReliverseConfig(projectPath, githubUsername, isDev, overrides);
	} else {
		// Check if the file is empty or has only "{}"
		const content = (await fs.readFile(configPath, "utf-8")).trim();
		if (!content || content === "{}") {
			await createReliverseConfig(
				projectPath,
				githubUsername,
				isDev,
				overrides,
			);
		} else {
			// If the existing config is invalid, attempt to fix it
			const validConfig = await readReliverseConfig(configPath, isDev);
			if (!validConfig) {
				const fixed = await parseAndFixReliverseConfig(configPath, isDev);
				if (!fixed) {
					relinka(
						"warn",
						"Could not fix existing config. Using fallback defaults.",
					);
				}
			}
		}
	}

	// Final read
	const mainConfig = await readReliverseConfig(configPath, isDev);
	if (!mainConfig) {
		relinka("warn", "Using fallback default config due to validation failure.");
		const fallbackConfig = { ...DEFAULT_CONFIG_RELIVERSE } as ReliverseConfig;
		if (isDev) {
			fallbackConfig.$schema = RSE_SCHEMA_DEV;
		}
		return { config: fallbackConfig, mrse: results };
	}
	if (isDev) {
		mainConfig.$schema = RSE_SCHEMA_DEV;
	}

	return { config: mainConfig, mrse: results };
}
