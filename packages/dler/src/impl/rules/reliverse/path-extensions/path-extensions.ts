import { extname, getFileImportsExports } from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";

import type { AllowedFileExtensionsType } from "~/impl/rules/rules-consts";
import {
	ALLOWED_IMPORT_EXTENSIONS,
	STRICT_IMPORT_EXTENSIONS,
} from "~/impl/rules/rules-consts";
import { getAllFiles, getLineNumber } from "~/impl/rules/rules-utils";
import type {
	CheckIssue,
	CheckResult,
	RulesCheckOptions,
} from "~/impl/types/mod";

// get allowed import path extensions (for import statements)
function getAllowedImportExtensions(
	directory: AllowedFileExtensionsType,
	strict: boolean,
): string[] {
	if (strict) {
		return STRICT_IMPORT_EXTENSIONS[directory];
	}
	return ALLOWED_IMPORT_EXTENSIONS[directory];
}

// check import path extensions (what's written in import statements)
export async function checkPathExtensions(
	options: RulesCheckOptions,
): Promise<CheckResult> {
	const startTime = Date.now();
	const issues: CheckIssue[] = [];
	const { directory, strict, onProgress } = options;

	const allowedExts = getAllowedImportExtensions(directory, strict);

	try {
		const files = await getAllFiles(directory);
		let totalImports = 0;

		// filter only files that might contain imports
		const importableFiles = files.filter((file) => {
			const ext = extname(file);
			return [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext);
		});

		// process files in parallel batches
		const batchSize = 20;
		const batches = [];

		for (let i = 0; i < importableFiles.length; i += batchSize) {
			batches.push(importableFiles.slice(i, i + batchSize));
		}

		for (const [batchIndex, batch] of batches.entries()) {
			const batchPromises = batch.map(async (file, fileIndex) => {
				const globalIndex = batchIndex * batchSize + fileIndex;
				onProgress?.(globalIndex + 1, importableFiles.length, file);

				try {
					const content = await fs.readFile(file, "utf8");
					const imports = getFileImportsExports(content, {
						kind: "import",
						pathTypes: ["relative", "alias"],
					});

					totalImports += imports.length;
					const fileIssues: CheckIssue[] = [];

					for (const imp of imports) {
						if (!imp.source) continue;

						const ext = extname(imp.source);
						if (!allowedExts.includes(ext)) {
							// special message for .ts imports in js environments
							const isTypeScriptImport = ext === ".ts";
							const isJsEnvironment =
								directory === "src" ||
								directory === "dist-npm" ||
								directory === "dist-libs/npm";

							let message: string;
							if (isTypeScriptImport && isJsEnvironment) {
								message = `import uses .ts extension in javascript environment: ${imp.source} (use .js extension instead)`;
							} else {
								message = `import has disallowed extension "${ext}": ${imp.source} (allowed: ${allowedExts.join(", ")})`;
							}

							fileIssues.push({
								file,
								message,
								type: "path-extension",
								line: getLineNumber(content, imp.start),
							});
						}
					}

					return { issues: fileIssues, importCount: imports.length };
				} catch {
					relinka("warn", `skipping unreadable file: ${file}`);
					return { issues: [], importCount: 0 };
				}
			});

			const batchResults = await Promise.all(batchPromises);
			for (const result of batchResults) {
				issues.push(...result.issues);
				totalImports += result.importCount;
			}
		}

		return {
			success: issues.length === 0,
			issues,
			stats: {
				filesChecked: importableFiles.length,
				importsChecked: totalImports,
				timeElapsed: Date.now() - startTime,
			},
		};
	} catch (error) {
		throw new Error(
			`failed to check path extensions: ${error instanceof Error ? error.message : "unknown error"}`,
		);
	}
}
