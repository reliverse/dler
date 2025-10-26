// packages/helpers/src/impl/replace-exports.ts

import { Glob } from "bun";
import { readFileSync, writeFileSync } from "node:fs";

interface ReplaceExportsOptions {
	direction?: "ts-to-js" | "js-to-ts";
	cwd?: string;
	ignorePackages?: string | string[];
	verbose?: boolean;
}

interface ReplaceResult {
	updated: number;
	skipped: number;
	files: string[];
}

function matchesPattern(str: string, pattern: string): boolean {
	if (pattern.includes("*")) {
		const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
		return regex.test(str);
	}
	return str === pattern;
}

function shouldIgnorePackage(
	packageName: string,
	ignorePackages: string | string[],
): boolean {
	const patterns = typeof ignorePackages === "string" ? [ignorePackages] : ignorePackages;
	return patterns.some((pattern) => matchesPattern(packageName, pattern));
}

function replaceInPackageJson(
	filePath: string,
	direction: "ts-to-js" | "js-to-ts",
): boolean {
	const content = readFileSync(filePath, "utf-8");

	if (direction === "ts-to-js") {
		let updated = content;
		let hasChanges = false;

		// Replace ./src/*.ts → ./dist/*.js (for default)
		const defaultPattern = /"default":\s*"\.\/src\/([^"]+)\.ts"/g;
		if (defaultPattern.test(content)) {
			defaultPattern.lastIndex = 0;
			updated = updated.replace(defaultPattern, '"default": "./dist/$1.js"');
			hasChanges = true;
		}

		// Replace ./src/*.ts → ./dist/*.d.ts (for types)
		const typesPattern = /"types":\s*"\.\/src\/([^"]+)\.ts"/g;
		if (typesPattern.test(content)) {
			typesPattern.lastIndex = 0;
			updated = updated.replace(typesPattern, '"types": "./dist/$1.d.ts"');
			hasChanges = true;
		}

		// Replace ./file.js → ./dist/file.js (if not already in dist/)
		const rootJsPattern = /"default":\s*"\.\/([^"]+\.js)"/g;
		updated = updated.replace(rootJsPattern, (match, fileName) => {
			if (!fileName.startsWith("dist/")) {
				hasChanges = true;
				return `"default": "./dist/${fileName}"`;
			}
			return match;
		});

		// Replace ./file.d.ts → ./dist/file.d.ts (if not already in dist/)
		const rootDtsPattern = /"types":\s*"\.\/([^"]+\.d\.ts)"/g;
		updated = updated.replace(rootDtsPattern, (match, fileName) => {
			if (!fileName.startsWith("dist/")) {
				hasChanges = true;
				return `"types": "./dist/${fileName}"`;
			}
			return match;
		});

		if (hasChanges) {
			writeFileSync(filePath, updated, "utf-8");
			return true;
		}
	} else {
		let updated = content;
		let hasChanges = false;

		// Replace ./dist/*.js → ./src/*.ts (for default)
		const distJsPattern = /"default":\s*"\.\/dist\/([^"]+)\.js"/g;
		if (distJsPattern.test(content)) {
			distJsPattern.lastIndex = 0;
			updated = updated.replace(distJsPattern, '"default": "./src/$1.ts"');
			hasChanges = true;
		}

		// Replace ./dist/*.d.ts → ./src/*.ts (for types)
		const distDtsPattern = /"types":\s*"\.\/dist\/([^"]+)\.d\.ts"/g;
		if (distDtsPattern.test(content)) {
			distDtsPattern.lastIndex = 0;
			updated = updated.replace(distDtsPattern, '"types": "./src/$1.ts"');
			hasChanges = true;
		}

		// Replace ./file.js → ./src/file.ts (if not already in src/ or dist/)
		const rootJsPattern = /"default":\s*"\.\/([^"]+\.js)"/g;
		updated = updated.replace(rootJsPattern, (match, fileName) => {
			if (!fileName.startsWith("src/") && !fileName.startsWith("dist/")) {
				const baseName = fileName.replace(/\.js$/, "");
				hasChanges = true;
				return `"default": "./src/${baseName}.ts"`;
			}
			return match;
		});

		// Replace ./file.d.ts → ./src/file.ts (if not already in src/ or dist/)
		const rootDtsPattern = /"types":\s*"\.\/([^"]+\.d\.ts)"/g;
		updated = updated.replace(rootDtsPattern, (match, fileName) => {
			if (!fileName.startsWith("src/") && !fileName.startsWith("dist/")) {
				const baseName = fileName.replace(/\.d\.ts$/, "");
				hasChanges = true;
				return `"types": "./src/${baseName}.ts"`;
			}
			return match;
		});

		if (hasChanges) {
			writeFileSync(filePath, updated, "utf-8");
			return true;
		}
	}

	return false;
}

export async function replaceExportsInPackages(
	options: ReplaceExportsOptions = {},
): Promise<ReplaceResult> {
	const { direction = "ts-to-js", cwd = process.cwd(), ignorePackages } = options;

	const glob = new Glob("**/package.json");
	const packageJsonFiles: string[] = [];

	for await (const file of glob.scan({ cwd, onlyFiles: true })) {
		if (!file.includes("node_modules/")) {
			packageJsonFiles.push(file);
		}
	}

	let filteredFiles = packageJsonFiles;

	if (ignorePackages) {
		filteredFiles = [];
		for (const file of packageJsonFiles) {
			try {
				const content = readFileSync(file, "utf-8");
				const pkg = JSON.parse(content);
				if (!pkg?.name || !shouldIgnorePackage(pkg.name, ignorePackages)) {
					filteredFiles.push(file);
				}
			} catch {
				filteredFiles.push(file);
			}
		}
	}

	let updatedCount = 0;
	for (const file of filteredFiles) {
		if (replaceInPackageJson(file, direction)) {
			updatedCount++;
		}
	}

	return {
		updated: updatedCount,
		skipped: filteredFiles.length - updatedCount,
		files: filteredFiles,
	};
}

