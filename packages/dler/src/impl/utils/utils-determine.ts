import type { LibConfig } from "~/impl/schema/mod";

/**
 * Determines the distribution name based on the file path and build type.
 * This function is used for logging and determining output paths.
 *
 * @returns The distribution name in the transpileFormat of:
 *   - For empty isJsr: "root"
 *   - For regular builds: "dist-jsr" or "dist-npm"
 *   - For library builds: "dist-libs/{lib-name}/jsr" or "dist-libs/{lib-name}/npm"
 *   - For library builds with libDirName: "dist-libs/{libDirName}/jsr" or "dist-libs/{libDirName}/npm"
 */
export function determineDistName(
	filePath: string,
	isJsr: "" | boolean,
	libsList?: Record<string, LibConfig>,
): string {
	// If isJsr is an empty string, return "root"
	if (isJsr === "") {
		return "root";
	}

	// First determine the base distribution type based on isJsr flag
	const baseDistName = isJsr ? "dist-jsr" : "dist-npm";

	// Check if this is a library path by looking for "/libs/" or "\libs\" in the path
	const isLibraryPath =
		filePath.includes("/libs/") || filePath.includes("\\libs\\");

	if (!isLibraryPath) {
		// For non-library paths, just return the base distribution name
		return baseDistName;
	}

	// For library paths, extract the library name
	const libPathRegex = /[/\\]libs[/\\]([^/\\]+)/;
	const libPathResult = libPathRegex.exec(filePath);
	const extractedLibName = libPathResult?.[1];

	if (!extractedLibName) {
		// If we couldn't extract a library name for some reason, fall back to the base name
		return baseDistName;
	}

	// If we have access to libs config, check for libDirName
	if (libsList) {
		// Try to find the library config by matching the extracted library name
		for (const [libName, libConfig] of Object.entries(libsList)) {
			// For scoped packages like @reliverse/dler-sdk, extract the part after /
			const simplifiedLibName = libName.startsWith("@")
				? libName.split("/")[1]
				: libName;

			// Check if this library matches our extracted name
			if (simplifiedLibName === extractedLibName && libConfig.libDirName) {
				// Use libDirName if available
				return isJsr
					? `dist-libs/${libConfig.libDirName}/jsr`
					: `dist-libs/${libConfig.libDirName}/npm`;
			}
		}
	}

	// Return the default library distribution path based on the extracted name
	return isJsr
		? `dist-libs/${extractedLibName}/jsr`
		: `dist-libs/${extractedLibName}/npm`;
}
