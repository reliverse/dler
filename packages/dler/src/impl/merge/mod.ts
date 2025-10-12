import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { withEnhancedSpinner } from "@reliverse/rempts";
import MagicString, { Bundle } from "magic-string";
import pMap from "p-map";
import {
	checkPermissions,
	handleCtxError,
	sanitizeInput,
	validateContent,
	validateFileType,
	validateMergeOperation,
	validatePath,
} from "~/impl/utils/utils-security";

// ---------- constants ----------

export const DEFAULT_IGNORES = ["**/.git/**", "**/node_modules/**"] as const;
export const DEFAULT_SEPARATOR_RAW = "\\n\\n";

// ---------- helpers ----------

export const normalizeGlobPattern = (pattern: string): string => {
	const sanitizedPattern = sanitizeInput(pattern);
	// If pattern doesn't contain any glob characters and doesn't end with a slash,
	// treat it as a directory and add /**/* to match all files recursively
	if (
		!sanitizedPattern.includes("*") &&
		!sanitizedPattern.includes("?") &&
		!sanitizedPattern.endsWith("/")
	) {
		return `${sanitizedPattern}/**/*`;
	}
	return sanitizedPattern;
};

export const parseCSV = (s: string) =>
	s
		.split(",")
		.map((t) => sanitizeInput(t.trim()))
		.filter(Boolean);

export const unescape = (s: string) =>
	s.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

export const writeResult = async (
	sections: string[],
	_separator: string,
	toFile: string | undefined,
	toStdout: boolean,
	dryRun: boolean,
	backup: boolean,
	generateSourceMap = false,
) => {
	try {
		const bundle = new Bundle();

		// Add each section as a source
		for (const section of sections) {
			validateContent(section, "text");
			bundle.addSource({
				content: new MagicString(section),
			});
		}

		// Join sections with separator
		const content = bundle.toString();
		const finalContent = `${content}\n`;

		if (toStdout || !toFile) {
			process.stdout.write(finalContent);
			return;
		}

		const sanitizedPath = sanitizeInput(toFile);
		const dir = path.dirname(sanitizedPath);
		if (dir && dir !== ".") {
			await fs.ensureDir(dir);
			await checkPermissions(dir, "write");
		}

		if (backup && (await fs.pathExists(sanitizedPath))) {
			const backupPath = `${sanitizedPath}.${Date.now()}.bak`;
			await checkPermissions(sanitizedPath, "read");
			await fs.copyFile(sanitizedPath, backupPath);
		}

		if (!dryRun) {
			await checkPermissions(sanitizedPath, "write");
			validatePath(sanitizedPath, process.cwd());
			validateFileType("text");
			await fs.writeFile(sanitizedPath, finalContent, "utf8");

			// Generate source map if requested
			if (generateSourceMap) {
				const map = bundle.generateMap({
					file: path.basename(sanitizedPath),
					source: sanitizedPath,
					includeContent: true,
					hires: true,
				});
				const mapPath = `${sanitizedPath}.map`;
				await fs.writeFile(mapPath, map.toString(), "utf8");
				// Add source map reference to the output file
				const sourceMapRef = `\n//# sourceMappingURL=${path.basename(mapPath)}`;
				await fs.appendFile(sanitizedPath, sourceMapRef, "utf8");
			}
		}
	} catch (error) {
		handleCtxError(error, "writeResult");
	}
};

export const writeFilesPreserveStructure = async (
	files: string[],
	outDir: string,
	preserveStructure: boolean,
	increment: boolean,
	concurrency: number,
	dryRun: boolean,
	backup: boolean,
): Promise<void> => {
	await withEnhancedSpinner(
		{
			text: `Copying ${files.length} files`,
			showTiming: true,
			successText: "File copy operation completed",
			failText: "File copy operation failed",
			color: "cyan",
		},
		async (spinner) => {
			try {
				if (!files?.length) {
					throw new Error("No files provided for merge operation");
				}

				const cwd = process.cwd();
				const fileNameCounts = new Map<string, Map<string, number>>();

				// Validate merge operation
				spinner.updateText("Validating files");
				await validateMergeOperation(files);

				let processedCount = 0;

				await pMap(
					files,
					async (file) => {
						const sanitizedFile = sanitizeInput(file);
						const relPath = preserveStructure
							? path.relative(cwd, sanitizedFile)
							: path.basename(sanitizedFile);

						let destPath = path.join(outDir, relPath);

						if (increment) {
							const dir = path.dirname(destPath);
							const base = path.basename(destPath);
							let dirMap = fileNameCounts.get(dir);
							if (!dirMap) {
								dirMap = new Map();
								fileNameCounts.set(dir, dirMap);
							}
							const count = dirMap.get(base) || 0;
							if (count > 0) {
								const extMatch = base.match(/(.*)(\.[^./\\]+)$/);
								let newBase: string;
								if (extMatch) {
									newBase = `${extMatch[1]}-${count + 1}${extMatch[2]}`;
								} else {
									newBase = `${base}-${count + 1}`;
								}
								destPath = path.join(dir, newBase);
							}
							dirMap.set(base, count + 1);
						}

						await fs.ensureDir(path.dirname(destPath));
						if (backup && (await fs.pathExists(destPath))) {
							const backupPath = `${destPath}.${Date.now()}.bak`;
							await checkPermissions(destPath, "read");
							await fs.copyFile(destPath, backupPath);
						}
						if (!dryRun) {
							await checkPermissions(destPath, "write");
							await fs.copyFile(sanitizedFile, destPath);
						}

						// Update progress
						processedCount++;
						spinner.setProgress(
							processedCount,
							files.length,
							`Copying ${path.basename(sanitizedFile)}`,
						);
					},
					{ concurrency },
				);

				return processedCount;
			} catch (error) {
				handleCtxError(error, "writeFilesPreserveStructure");
				throw error;
			}
		},
	);
};

export const processSection = (
	raw: string,
	rel: string,
	prefix: string,
	pathAbove: boolean,
	injectPath: boolean,
): string => {
	const magic = new MagicString(raw);

	if (pathAbove) {
		magic.prepend(`${prefix}${rel}\n`);
	}

	if (injectPath) {
		magic.append(`\n${prefix}${rel}`);
	}

	return magic.toString();
};
