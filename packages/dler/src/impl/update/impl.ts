import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import pMap from "p-map";
import { glob } from "tinyglobby";

import { detectPackageManager } from "~/impl/utils/pm/pm-detect";
import {
	applyVersionUpdate,
	checkPackageUpdate,
	collectTargetDependencies,
	type PackageCheckOptions,
	prepareDependenciesForUpdate,
	runInstallCommand,
	type UpdateResult,
} from "./utils";

interface UpdateArgs {
	ci?: boolean;
	cwd?: string;
	name?: string[];
	ignore?: string[];
	dryRun?: boolean;
	install?: boolean;
	allowMajor?: boolean;
	concurrency?: number;
	ignoreFields?: string[];
}

export async function validatePackageJson(): Promise<string> {
	const packageJsonPath = path.resolve(process.cwd(), "package.json");

	if (!(await fs.pathExists(packageJsonPath))) {
		relinka("error", "No package.json found in current directory");
		process.exit(1);
	}

	return packageJsonPath;
}

export async function prepareAllUpdateCandidates(): Promise<{
	packageJsonFiles: string[];
	fileDepsMap: Map<string, Record<string, any>>;
}> {
	// Find ALL package.json files in the project using tinyglobby
	const packageJsonFiles = await glob("**/package.json", {
		cwd: process.cwd(),
		absolute: true,
		ignore: [
			"**/node_modules/**",
			"**/dist/**",
			"**/build/**",
			"**/.git/**",
			"**/coverage/**",
			"**/.next/**",
			"**/.nuxt/**",
			"**/out/**",
			"**/target/**",
			"**/.turbo/**",
		],
	});

	if (packageJsonFiles.length === 0) {
		relinka("warn", "No package.json files found");
		return { packageJsonFiles: [], fileDepsMap: new Map() };
	}

	relinka("verbose", `Found ${packageJsonFiles.length} package.json files`);

	// Process each package.json file independently
	const fileDepsMap = new Map<string, Record<string, any>>();

	for (const packageJsonPath of packageJsonFiles) {
		try {
			const packageJson = JSON.parse(
				await fs.readFile(packageJsonPath, "utf8"),
			);
			const { map } = collectTargetDependencies(packageJson);

			// Store file-specific dependencies
			fileDepsMap.set(packageJsonPath, map);
		} catch (error) {
			relinka(
				"warn",
				`Failed to process ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	relinka(
		"verbose",
		`Processing ${packageJsonFiles.length} package.json files`,
	);
	return { packageJsonFiles, fileDepsMap };
}

export async function checkPackageUpdatesForFile(
	fileDepsMap: Record<string, any>,
	args: UpdateArgs,
): Promise<UpdateResult[]> {
	const options: PackageCheckOptions = {
		allowMajor: !!args.allowMajor,
		savePrefix: "^", // Use default prefix
		concurrency: args.concurrency || 5,
	};

	// Get candidates for this specific file
	const candidates = prepareDependenciesForUpdate(fileDepsMap, args);

	if (candidates.length === 0) {
		return [];
	}

	return await pMap(
		candidates,
		async (dep): Promise<UpdateResult> => {
			const depInfo = fileDepsMap[dep];
			if (!depInfo?.versionSpec) {
				return {
					package: dep,
					currentVersion: "unknown",
					latestVersion: "unknown",
					updated: false,
					error: "Current version not found",
					semverCompatible: false,
					location: "unknown",
				};
			}

			return checkPackageUpdate(
				dep,
				depInfo.versionSpec,
				depInfo.locations,
				options,
			);
		},
		{ concurrency: args.concurrency || 5 },
	);
}

export async function updatePackageJsonFileDirectly(
	packageJsonPath: string,
	fileDepsMap: Record<string, any>,
	updatesToApply: UpdateResult[],
	savePrefix: string,
	fieldsToIgnore: string[] = [],
): Promise<number> {
	if (updatesToApply.length === 0) return 0;

	try {
		const packageJson = JSON.parse(
			await fs.readFile(packageJsonPath, "utf8"),
		) as Record<string, any>;
		const updatedPackageJson = { ...packageJson };

		for (const update of updatesToApply) {
			const depInfo = fileDepsMap[update.package];
			if (!depInfo) continue;

			const locations = depInfo.locations || new Set<string>();

			// Check if any of the dependency's locations should be ignored
			const shouldIgnore = Array.from(locations).some((location) =>
				fieldsToIgnore.includes(String(location)),
			);

			if (shouldIgnore) {
				continue; // Skip this update
			}

			// Determine the version prefix based on dependency type
			let newVersion: string;
			if (locations.has("peerDependencies")) {
				// For peerDependencies, preserve the >= prefix if it exists
				const currentVersion = String(
					fileDepsMap[update.package]?.versionSpec || "",
				);
				if (currentVersion.startsWith(">=")) {
					newVersion = `>=${update.latestVersion}`;
				} else {
					newVersion =
						savePrefix === "none"
							? update.latestVersion
							: `${savePrefix}${update.latestVersion}`;
				}
			} else {
				// For other dependency types, use the standard prefix
				newVersion =
					savePrefix === "none"
						? update.latestVersion
						: `${savePrefix}${update.latestVersion}`;
			}

			applyVersionUpdate(
				updatedPackageJson,
				update.package,
				newVersion,
				locations,
			);
		}

		await fs.writeFile(
			packageJsonPath,
			JSON.stringify(updatedPackageJson, null, 2) + "\n",
			"utf8",
		);

		return updatesToApply.length;
	} catch (error) {
		relinka(
			"warn",
			`Failed to update ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 0;
	}
}

export async function handleInstallation(): Promise<void> {
	const packageManager = await detectPackageManager(process.cwd());
	if (!packageManager) {
		relinka(
			"warn",
			"Could not detect package manager. Please run install manually.",
		);
		return;
	}

	try {
		await runInstallCommand(packageManager);
		relinka("log", "Installation completed successfully");
	} catch (error) {
		relinka(
			"warn",
			`Install failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		relinka(
			"log",
			`Run '${packageManager.command} install' manually to apply the changes`,
		);
	}
}
