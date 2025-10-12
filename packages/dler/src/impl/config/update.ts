/* ------------------------------------------------------------------
 * Update Project Config
 * ------------------------------------------------------------------
 */

import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { parseJSONC } from "confbox";
import { writeReliverseConfig } from "~/impl/config/create";
import { getReliverseConfigPath } from "~/impl/config/path";
import { getBackupAndTempPaths } from "~/impl/config/utils";
import type { ReliverseConfig } from "~/impl/schema/mod";
import { DEFAULT_CONFIG_RELIVERSE } from "~/impl/schema/mod";

/**
 * Deep merges two objects recursively while preserving nested structures.
 */
function deepMerge<T extends Record<string, unknown>>(
	target: T,
	source: Partial<T>,
): T {
	const result = { ...target };
	for (const key in source) {
		if (!Object.hasOwn(source, key)) continue;
		const sourceValue = source[key];
		const targetValue = target[key];
		if (sourceValue !== undefined) {
			if (
				sourceValue !== null &&
				typeof sourceValue === "object" &&
				!Array.isArray(sourceValue) &&
				targetValue !== null &&
				typeof targetValue === "object" &&
				!Array.isArray(targetValue)
			) {
				result[key] = deepMerge(
					targetValue as Record<string, unknown>,
					sourceValue as Record<string, unknown>,
				) as T[Extract<keyof T, string>];
			} else {
				result[key] = sourceValue as T[Extract<keyof T, string>];
			}
		}
	}
	return result;
}

/**
 * Compares two objects and returns an array of paths where values differ
 */
function findObjectDifferences(
	obj1: Record<string, unknown>,
	obj2: Record<string, unknown>,
	path = "",
): string[] {
	const differences: string[] = [];
	const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

	for (const key of allKeys) {
		const currentPath = path ? `${path}.${key}` : key;
		const val1 = obj1[key];
		const val2 = obj2[key];

		if (val1 === undefined || val2 === undefined) {
			differences.push(
				`${currentPath}: ${val1 === undefined ? "removed" : "added"}`,
			);
			continue;
		}

		if (
			typeof val1 === "object" &&
			val1 !== null &&
			typeof val2 === "object" &&
			val2 !== null
		) {
			if (Array.isArray(val1) && Array.isArray(val2)) {
				if (JSON.stringify(val1) !== JSON.stringify(val2)) {
					differences.push(`${currentPath}: array values differ`);
				}
			} else {
				differences.push(
					...findObjectDifferences(
						val1 as Record<string, unknown>,
						val2 as Record<string, unknown>,
						currentPath,
					),
				);
			}
		} else if (val1 !== val2) {
			differences.push(
				`${currentPath}: ${JSON.stringify(val1)} → ${JSON.stringify(val2)}`,
			);
		}
	}

	return differences;
}

/**
 * Filters out memory-related fields that should not be in the rse config
 */
function filterMemoryFields<T extends Record<string, unknown>>(config: T): T {
	const { code, key, ...rest } = config;
	return rest as T;
}

/**
 * Updates project configuration by merging new updates with the existing config.
 * Creates a backup before overwriting and attempts to restore from backup on error.
 */
export async function updateReliverseConfig(
	projectPath: string,
	updates: Partial<ReliverseConfig>,
	isDev: boolean,
): Promise<boolean> {
	const { configPath } = await getReliverseConfigPath(
		projectPath,
		isDev,
		false,
	);
	const { backupPath, tempPath } = getBackupAndTempPaths(configPath);

	try {
		let existingConfig: ReliverseConfig = {} as ReliverseConfig;
		if (await fs.pathExists(configPath)) {
			const existingContent = await fs.readFile(configPath, "utf-8");
			const parsed = parseJSONC(existingContent);
			if (parsed && typeof parsed === "object")
				existingConfig = parsed as ReliverseConfig;
		}

		// Filter out memory fields before merging
		const filteredUpdates = filterMemoryFields(updates);
		const mergedConfig = deepMerge(
			existingConfig as unknown as Record<string, unknown>,
			filteredUpdates as unknown as Record<string, unknown>,
		) as unknown as ReliverseConfig;

		// Check if there are actual changes before updating
		const differences = findObjectDifferences(
			existingConfig as unknown as Record<string, unknown>,
			mergedConfig as unknown as Record<string, unknown>,
		);
		if (differences.length === 0) {
			relinka("verbose", "No changes detected in config, skipping update");
			return true;
		}

		// Log the changes
		relinka("info", "Config changes detected:");
		for (const diff of differences) {
			relinka("info", `  ${diff}`);
		}

		// Backup current config (if exists) and write merged config
		if (await fs.pathExists(configPath)) {
			await fs.copy(configPath, backupPath);
		}
		await writeReliverseConfig(configPath, mergedConfig, isDev);
		if (await fs.pathExists(backupPath)) {
			await fs.remove(backupPath);
		}
		relinka("null", "");
		relinka("success", "rse config updated successfully");
		return true;
	} catch (error) {
		relinka("error", "Failed to update config:", String(error));
		if (
			(await fs.pathExists(backupPath)) &&
			!(await fs.pathExists(configPath))
		) {
			try {
				await fs.copy(backupPath, configPath);
				relinka("warn", "Restored config from backup after failed update");
			} catch (restoreError) {
				relinka(
					"error",
					"Failed to restore config from backup:",
					String(restoreError),
				);
			}
		}
		if (await fs.pathExists(tempPath)) {
			await fs.remove(tempPath);
		}
		return false;
	}
}

/**
 * Merges a partial config with the default config.
 */
export function mergeWithDefaults(
	partial: Partial<ReliverseConfig>,
): ReliverseConfig {
	return {
		...DEFAULT_CONFIG_RELIVERSE,
		...partial,
		features: partial.features
			? {
					...DEFAULT_CONFIG_RELIVERSE.features,
					...partial.features,
				}
			: DEFAULT_CONFIG_RELIVERSE.features,
		codeStyle: partial.codeStyle
			? {
					...(DEFAULT_CONFIG_RELIVERSE.codeStyle ?? {}),
					...partial.codeStyle,
					modernize: partial.codeStyle.modernize
						? {
								...(DEFAULT_CONFIG_RELIVERSE.codeStyle?.modernize ?? {}),
								...partial.codeStyle.modernize,
							}
						: DEFAULT_CONFIG_RELIVERSE.codeStyle?.modernize,
				}
			: DEFAULT_CONFIG_RELIVERSE.codeStyle,
		preferredLibraries: partial.preferredLibraries
			? {
					...DEFAULT_CONFIG_RELIVERSE.preferredLibraries,
					...partial.preferredLibraries,
				}
			: DEFAULT_CONFIG_RELIVERSE.preferredLibraries,
		monorepo: partial.monorepo
			? {
					...DEFAULT_CONFIG_RELIVERSE.monorepo,
					...partial.monorepo,
				}
			: DEFAULT_CONFIG_RELIVERSE.monorepo,
		customRules: partial.customRules
			? {
					...DEFAULT_CONFIG_RELIVERSE.customRules,
					...partial.customRules,
				}
			: DEFAULT_CONFIG_RELIVERSE.customRules,
		ignoreDependencies:
			partial.ignoreDependencies ?? DEFAULT_CONFIG_RELIVERSE.ignoreDependencies,
	} as ReliverseConfig;
}
