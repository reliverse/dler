import { existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "@reliverse/pathkit";

interface MigrationResult {
	file: string;
	success: boolean;
	message: string;
	changes?: string[];
}

interface PackageJson {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
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
				if ([".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte"].includes(ext)) {
					files.push(fullPath);
				}
			}
		}
	} catch {
		// skip directories we can't read
	}

	return files;
}

export async function migrateReaddirToGlob(
	dryRun = false,
): Promise<MigrationResult[]> {
	const results: MigrationResult[] = [];
	const files = await getAllTsFiles(".");

	for (const file of files) {
		try {
			const content = await readFile(file, "utf8");
			let modified = content;
			const changes: string[] = [];

			// Add globby import if not present
			if (!content.includes("import") || !content.includes("globby")) {
				const importStatement = 'import globby from "globby";\n';
				modified = importStatement + modified;
				changes.push("Added globby import");
			}

			// Replace fs.readdir with globby
			const readdirRegex =
				/(?:await\s+)?(?:fs\.)?readdir(?:Sync)?\s*\(\s*([^)]+)\s*\)/g;
			if (readdirRegex.test(content)) {
				modified = modified.replace(readdirRegex, (_match, targetDir) => {
					// Remove any quotes and trim the targetDir
					const cleanTargetDir = targetDir.replace(/["']/g, "").trim();
					return `await globby("*", { cwd: ${cleanTargetDir}, onlyFiles: false })`;
				});
				changes.push("Converted fs.readdir to globby");
			}

			// Replace fs.promises.readdir with globby
			const promisesReaddirRegex =
				/(?:await\s+)?fs\.promises\.readdir\s*\(\s*([^)]+)\s*\)/g;
			if (promisesReaddirRegex.test(content)) {
				modified = modified.replace(
					promisesReaddirRegex,
					(_match, targetDir) => {
						const cleanTargetDir = targetDir.replace(/["']/g, "").trim();
						return `await globby("*", { cwd: ${cleanTargetDir}, onlyFiles: false })`;
					},
				);
				changes.push("Converted fs.promises.readdir to globby");
			}

			if (changes.length > 0) {
				if (!dryRun) {
					await writeFile(file, modified, "utf8");
				}

				results.push({
					file,
					success: true,
					message: `${changes.length} change(s) made`,
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

	// handle package.json
	await updatePackageJson(results, dryRun, {
		add: { globby: "^13.2.2" },
	});

	return results;
}

async function updatePackageJson(
	results: MigrationResult[],
	dryRun: boolean,
	config: { remove?: string[]; add: Record<string, string> },
): Promise<void> {
	try {
		const packageJsonPath = "./package.json";
		if (existsSync(packageJsonPath)) {
			const packageContent = await readFile(packageJsonPath, "utf8");
			const packageJson = JSON.parse(packageContent) as PackageJson;
			let packageChanged = false;
			const packageChanges: string[] = [];

			// remove packages
			if (config.remove) {
				for (const pkg of config.remove) {
					if (packageJson.dependencies?.[pkg]) {
						packageJson.dependencies = Object.fromEntries(
							Object.entries(packageJson.dependencies).filter(
								([key]) => key !== pkg,
							),
						);
						packageChanged = true;
						packageChanges.push(`Removed ${pkg} from dependencies`);
					}

					if (packageJson.devDependencies?.[pkg]) {
						packageJson.devDependencies = Object.fromEntries(
							Object.entries(packageJson.devDependencies).filter(
								([key]) => key !== pkg,
							),
						);
						packageChanged = true;
						packageChanges.push(`Removed ${pkg} from devDependencies`);
					}
				}
			}

			// add packages
			for (const [pkg, version] of Object.entries(config.add)) {
				if (!packageJson.dependencies?.[pkg]) {
					packageJson.dependencies = {
						...packageJson.dependencies,
						[pkg]: version,
					};
					packageChanged = true;
					packageChanges.push(`Added ${pkg} to dependencies`);
				}
			}

			if (packageChanged && !dryRun) {
				await writeFile(
					packageJsonPath,
					JSON.stringify(packageJson, null, 2),
					"utf8",
				);
			}

			if (packageChanges.length > 0) {
				results.push({
					file: packageJsonPath,
					success: true,
					message: `${packageChanges.length} change(s) made`,
					changes: packageChanges,
				});
			}
		}
	} catch (error) {
		results.push({
			file: "./package.json",
			success: false,
			message: `Failed to update package.json: ${
				error instanceof Error ? error.message : String(error)
			}`,
		});
	}
}
