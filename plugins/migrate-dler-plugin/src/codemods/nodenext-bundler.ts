import { existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, getFileImportsExports, join } from "@reliverse/pathkit";

interface MigrationResult {
	file: string;
	success: boolean;
	message: string;
	changes?: string[];
}

interface PackageJson {
	type?: "module" | "commonjs";
	compilerOptions?: {
		moduleResolution?: string;
		module?: string;
		target?: string;
	};
}

interface TsConfig {
	compilerOptions?: {
		moduleResolution?: "node" | "nodenext" | "bundler";
		module?: "commonjs" | "esnext" | "nodenext" | "preserve";
		target?: string;
		noEmit?: boolean;
		verbatimModuleSyntax?: boolean;
	};
	extends?: string;
}

async function getAllTsFiles(dir: string): Promise<string[]> {
	const files: string[] = [];

	try {
		const entries = await readdir(dir);

		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stats = await stat(fullPath);

			if (
				stats.isDirectory() &&
				!entry.startsWith(".") &&
				entry !== "node_modules"
			) {
				const subFiles = await getAllTsFiles(fullPath);
				files.push(...subFiles);
			} else if (stats.isFile()) {
				const ext = extname(entry);
				if ([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"].includes(ext)) {
					files.push(fullPath);
				}
			}
		}
	} catch {
		// skip directories we can't read
	}

	return files;
}

async function updateTsConfig(
	targetResolution: "nodenext" | "bundler",
	dryRun = false,
): Promise<MigrationResult[]> {
	const results: MigrationResult[] = [];
	const tsConfigPath = "./tsconfig.json";

	if (!existsSync(tsConfigPath)) {
		results.push({
			file: tsConfigPath,
			success: false,
			message: "tsconfig.json not found",
		});
		return results;
	}

	try {
		const content = await readFile(tsConfigPath, "utf8");
		const tsConfig = JSON.parse(content) as TsConfig;
		const changes: string[] = [];

		if (!tsConfig.compilerOptions) {
			tsConfig.compilerOptions = {};
		}

		// update module resolution
		if (tsConfig.compilerOptions.moduleResolution !== targetResolution) {
			tsConfig.compilerOptions.moduleResolution = targetResolution;
			changes.push(`Set moduleResolution to ${targetResolution}`);
		}

		// update module based on target resolution
		if (targetResolution === "nodenext") {
			if (tsConfig.compilerOptions.module !== "nodenext") {
				tsConfig.compilerOptions.module = "nodenext";
				changes.push("Set module to nodenext");
			}
		} else if (targetResolution === "bundler") {
			if (tsConfig.compilerOptions.module !== "preserve") {
				tsConfig.compilerOptions.module = "preserve";
				changes.push("Set module to preserve");
			}

			// bundler-specific options
			if (!tsConfig.compilerOptions.noEmit) {
				tsConfig.compilerOptions.noEmit = true;
				changes.push("Enabled noEmit");
			}
		}

		// set target if not specified
		if (!tsConfig.compilerOptions.target) {
			tsConfig.compilerOptions.target = "ES2022";
			changes.push("Set target to ES2022");
		}

		if (changes.length > 0) {
			if (!dryRun) {
				await writeFile(
					tsConfigPath,
					`${JSON.stringify(tsConfig, null, 2)}\n`,
					"utf8",
				);
			}

			results.push({
				file: tsConfigPath,
				success: true,
				message: `${changes.length} change(s) made`,
				changes,
			});
		} else {
			results.push({
				file: tsConfigPath,
				success: true,
				message: "Already configured correctly",
			});
		}
	} catch (error) {
		results.push({
			file: tsConfigPath,
			success: false,
			message: `Failed to update: ${error instanceof Error ? error.message : String(error)}`,
		});
	}

	return results;
}

async function updatePackageJson(dryRun = false): Promise<MigrationResult[]> {
	const results: MigrationResult[] = [];
	const packageJsonPath = "./package.json";

	if (!existsSync(packageJsonPath)) {
		results.push({
			file: packageJsonPath,
			success: false,
			message: "package.json not found",
		});
		return results;
	}

	try {
		const content = await readFile(packageJsonPath, "utf8");
		const packageJson = JSON.parse(content) as PackageJson;
		const changes: string[] = [];

		// always ensure type: "module" for both cases
		if (packageJson.type !== "module") {
			packageJson.type = "module";
			changes.push('Set type to "module"');
		}

		if (changes.length > 0) {
			if (!dryRun) {
				await writeFile(
					packageJsonPath,
					`${JSON.stringify(packageJson, null, 2)}\n`,
					"utf8",
				);
			}

			results.push({
				file: packageJsonPath,
				success: true,
				message: `${changes.length} change(s) made`,
				changes,
			});
		} else {
			results.push({
				file: packageJsonPath,
				success: true,
				message: "Already configured correctly",
			});
		}
	} catch (error) {
		results.push({
			file: packageJsonPath,
			success: false,
			message: `Failed to update: ${error instanceof Error ? error.message : String(error)}`,
		});
	}

	return results;
}

async function updateImportExtensions(
	targetResolution: "nodenext" | "bundler",
	dryRun = false,
): Promise<MigrationResult[]> {
	const results: MigrationResult[] = [];
	const files = await getAllTsFiles(".");

	for (const file of files) {
		try {
			const content = await readFile(file, "utf8");
			const analysis = getFileImportsExports(content, {
				kind: "import",
				pathTypes: ["relative", "absolute", "alias"],
			});

			if (analysis.length === 0) continue;

			let modified = content;
			const changes: string[] = [];
			let hasChanges = false;

			for (const imp of analysis) {
				if (!imp.source) continue;

				const isRelativeOrAbsolute =
					imp.pathType === "relative" ||
					imp.pathType === "absolute" ||
					imp.pathType === "alias";

				if (!isRelativeOrAbsolute) continue;

				if (targetResolution === "nodenext") {
					// nodenext requires explicit .js extensions
					if (imp.source.endsWith(".ts") || imp.source.endsWith(".tsx")) {
						const newSource = imp.source.replace(/\.tsx?$/, ".js");
						modified = modified
							.replace(`"${imp.source}"`, `"${newSource}"`)
							.replace(`'${imp.source}'`, `'${newSource}'`);
						changes.push(`${imp.source} → ${newSource}`);
						hasChanges = true;
					} else if (!imp.source.includes(".") && !imp.source.endsWith("/")) {
						// add .js extension to extensionless imports
						const newSource = `${imp.source}.js`;
						modified = modified
							.replace(`"${imp.source}"`, `"${newSource}"`)
							.replace(`'${imp.source}'`, `'${newSource}'`);
						changes.push(`${imp.source} → ${newSource}`);
						hasChanges = true;
					}
				} else if (targetResolution === "bundler") {
					// bundler: remove all extensions
					if (imp.source.match(/\.(js|jsx|ts|tsx)$/)) {
						const newSource = imp.source.replace(/\.(js|jsx|ts|tsx)$/, "");
						modified = modified
							.replace(`"${imp.source}"`, `"${newSource}"`)
							.replace(`'${imp.source}'`, `'${newSource}'`);
						changes.push(`${imp.source} → ${newSource}`);
						hasChanges = true;
					}
				}
			}

			if (hasChanges) {
				if (!dryRun) {
					await writeFile(file, modified, "utf8");
				}

				results.push({
					file,
					success: true,
					message: `${changes.length} import(s) updated`,
					changes,
				});
			}
		} catch (error) {
			results.push({
				file,
				success: false,
				message: `Failed to process: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	}

	return results;
}

export async function migrateToNodeNext(
	dryRun = false,
): Promise<MigrationResult[]> {
	const results: MigrationResult[] = [];

	// update tsconfig.json
	const tsConfigResults = await updateTsConfig("nodenext", dryRun);
	results.push(...tsConfigResults);

	// update package.json
	const packageResults = await updatePackageJson(dryRun);
	results.push(...packageResults);

	// update import extensions to .js
	const importResults = await updateImportExtensions("nodenext", dryRun);
	results.push(...importResults);

	return results;
}

export async function migrateToBundler(
	dryRun = false,
): Promise<MigrationResult[]> {
	const results: MigrationResult[] = [];

	// update tsconfig.json
	const tsConfigResults = await updateTsConfig("bundler", dryRun);
	results.push(...tsConfigResults);

	// update package.json
	const packageResults = await updatePackageJson(dryRun);
	results.push(...packageResults);

	// remove extensions from imports
	const importResults = await updateImportExtensions("bundler", dryRun);
	results.push(...importResults);

	return results;
}

export async function migrateModuleResolution(
	target: "nodenext" | "bundler",
	dryRun = false,
): Promise<MigrationResult[]> {
	if (target === "nodenext") {
		return migrateToNodeNext(dryRun);
	}
	return migrateToBundler(dryRun);
}
