import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";

/**
 * Checks if a file exists at the given path
 */
export async function fileExists(filePath: string): Promise<boolean> {
	return await fs.pathExists(filePath);
}

/**
 * Finds the main package based on dler configuration with fallbacks
 */
export async function findMainEntryFile(config: any): Promise<string | null> {
	const { commonEntryFile, commonEntrySrcDir } = config;

	// Check the configured entry file first
	if (commonEntryFile && commonEntrySrcDir) {
		const configuredPath = path.join(commonEntrySrcDir, commonEntryFile);
		if (await fileExists(configuredPath)) {
			return configuredPath;
		}
	}

	// Fallback to common entry file patterns
	const fallbackPatterns = [
		path.join(commonEntrySrcDir || "src", "mod.ts"),
		path.join(commonEntrySrcDir || "src", "index.ts"),
		path.join(commonEntrySrcDir || "src", "mod.js"),
		path.join(commonEntrySrcDir || "src", "index.js"),
	];

	for (const pattern of fallbackPatterns) {
		if (await fileExists(pattern)) {
			return pattern;
		}
	}

	return null;
}
