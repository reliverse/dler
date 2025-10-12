// inject-impl-mod.ts (transform-impl-mod.ts → inject-impl-mod.ts → e-ms-inject.ts)

import { promises as fs } from "node:fs";
import { isBinaryExt } from "@reliverse/filetype-dler-plugin";
import path from "@reliverse/pathkit";
import {
	createTransformer,
	insertAt,
	readAndTransform,
	remove,
	type StringTransformer,
} from "~/impl/transform/transform-impl-mod";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface InjectionLocation {
	line: number;
	column?: number;
}

export interface SingleInjection {
	filePath: string;
	location?: InjectionLocation;
	content: string | string[];
	injectBefore?: string | string[];
	injectAfter?: string | string[];
}

export interface InjectionResult {
	success: boolean;
	filePath: string;
	location?: InjectionLocation;
	injectBefore?: string | string[];
	injectAfter?: string | string[];
	error?: string;
	code?: string;
	hasChanged?: boolean;

	/**
	 * TODO: format results as {"path/to/file1": {}, "path/to/file2": {}} instead of [{filePath: "path/to/file1", ...}, {filePath: "path/to/file2", ...}]
	 *
	 * TODO: matchesFound will be more useful in this case (because currently we always have 1 matchFound for each injection)
	 */
	matchesFound?: number;
}

export interface InjectionOptions {
	generateSourceMap?: boolean;
	sourceMapPath?: string;
	preserveOriginal?: boolean;
	writeToFile?: boolean;
	revert?: boolean;
	based?: "0-based" | "1-based";
	logCode?: boolean;
	strict?: boolean;
	arrayBeforeAfter?: "array-means-multiline" | "append-to-each-element";
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Counts newline characters in a string.
 */
const countNewlines = (str: string): number => (str.match(/\n/g) || []).length;

/**
 * Validates line and column numbers based on indexing mode
 */
const validateLineColumn = (
	line: number,
	column: number | undefined,
	based: "0-based" | "1-based" = "1-based",
): string | null => {
	const minValue = based === "0-based" ? 0 : 1;

	if (!Number.isInteger(line) || line < minValue) {
		return `Line number must be a ${
			based === "0-based" ? "non-negative" : "positive"
		} integer (${based})`;
	}

	if (
		column !== undefined &&
		(!Number.isInteger(column) || column < minValue)
	) {
		return `Column number must be a ${
			based === "0-based" ? "non-negative" : "positive"
		} integer when provided (${based})`;
	}

	return null;
};

/**
 * Validates injection positioning - ensures only one method is used
 */
const validateInjectionPositioning = (
	injection: SingleInjection,
): string | null => {
	const positioningMethods = [
		injection.location ? "location" : null,
		injection.injectBefore ? "injectBefore" : null,
		injection.injectAfter ? "injectAfter" : null,
	].filter(Boolean);

	if (positioningMethods.length === 0) {
		return "Must specify exactly one of: location, injectBefore, or injectAfter";
	}

	if (positioningMethods.length > 1) {
		return `Cannot use multiple positioning methods. Found: ${positioningMethods.join(", ")}`;
	}

	return null;
};

/**
 * Converts line/column position to character index in string
 * Handles both CRLF and LF line endings and both indexing modes
 */
const getLineColumnPosition = (
	content: string,
	line: number,
	column: number | undefined,
	based: "0-based" | "1-based" = "1-based",
): number => {
	const lines = content.split(/\r?\n/);

	// Convert to 0-based indexing for internal calculations
	const zeroBasedLine = based === "0-based" ? line : line - 1;
	const zeroBasedColumn =
		column !== undefined
			? based === "0-based"
				? column
				: column - 1
			: undefined;

	if (zeroBasedLine >= lines.length || zeroBasedLine < 0) {
		const displayLine = based === "0-based" ? line : line;
		throw new Error(
			`Line ${displayLine} does not exist (file has ${lines.length} lines, ${based})`,
		);
	}

	let position = 0;
	const hasCarriageReturn = content.includes("\r\n");

	// Calculate position up to target line
	for (let i = 0; i < zeroBasedLine; i++) {
		const currentLine = lines[i];
		if (currentLine === undefined) continue;
		position += currentLine.length + (hasCarriageReturn ? 2 : 1);
	}

	// Handle column positioning
	if (zeroBasedColumn !== undefined) {
		const targetLine = lines[zeroBasedLine];
		if (targetLine === undefined) {
			const displayLine = based === "0-based" ? line : line;
			throw new Error(`Line ${displayLine} does not exist (${based})`);
		}
		if (zeroBasedColumn > targetLine.length) {
			const displayLine = based === "0-based" ? line : line;
			const displayColumn = based === "0-based" ? column : column;
			throw new Error(
				`Column ${displayColumn} does not exist in line ${displayLine} (line has ${targetLine.length} characters, ${based})`,
			);
		}
		position += zeroBasedColumn;
	} else {
		// Append to end of line if no column specified
		const lastLine = lines[zeroBasedLine];
		if (lastLine === undefined) {
			const displayLine = based === "0-based" ? line : line;
			throw new Error(`Line ${displayLine} does not exist (${based})`);
		}
		position += lastLine.length;
	}

	return position;
};

/**
 * Normalizes content from string or string[] to a single string
 * Preserves newlines within individual strings
 */
const normalizeContent = (content: string | string[]): string => {
	if (Array.isArray(content)) {
		return content.join("\n");
	}
	return content;
};

/**
 * Normalizes target strings for before/after injection based on arrayBeforeAfter option
 */
const normalizeTargetStrings = (
	target: string | string[],
	arrayBeforeAfter:
		| "array-means-multiline"
		| "append-to-each-element" = "array-means-multiline",
): string[] => {
	if (typeof target === "string") {
		return [target];
	}

	if (arrayBeforeAfter === "array-means-multiline") {
		return [target.join("\n")];
	}
	return target;
};

/**
 * Finds all positions of target strings in content and returns injection positions
 */
const findInjectionPositions = (
	content: string,
	targets: string[],
	mode: "before" | "after",
): { position: number; target: string }[] => {
	const positions: { position: number; target: string }[] = [];

	for (const target of targets) {
		let searchStart = 0;
		let foundIndex = content.indexOf(target, searchStart);

		while (foundIndex !== -1) {
			const position =
				mode === "before" ? foundIndex : foundIndex + target.length;
			positions.push({ position, target });

			searchStart = foundIndex + target.length;
			foundIndex = content.indexOf(target, searchStart);
		}
	}

	// Sort positions in reverse order for consistent injection without position shifts
	return positions.sort((a, b) => b.position - a.position);
};

/**
 * Finds content at specific location and returns removal range
 * In non-strict mode, returns null if content doesn't match (graceful handling)
 */
const getRemovalRange = (
	fileContent: string,
	line: number,
	column: number | undefined,
	contentToRemove: string,
	based: "0-based" | "1-based" = "1-based",
	strict = false,
): { start: number; end: number } | null => {
	const startPosition = getLineColumnPosition(fileContent, line, column, based);

	// Check if the content at the position matches what we want to remove
	const actualContent = fileContent.slice(
		startPosition,
		startPosition + contentToRemove.length,
	);

	if (actualContent !== contentToRemove) {
		if (!strict) {
			// In non-strict mode, return null to indicate graceful handling
			return null;
		}

		const displayLine = based === "0-based" ? line : line;
		const displayColumn =
			column !== undefined
				? based === "0-based"
					? column
					: column
				: undefined;
		throw new Error(
			`Content mismatch at line ${displayLine}${
				displayColumn !== undefined ? `, column ${displayColumn}` : ""
			} (${based}). Expected: "${contentToRemove}", Found: "${actualContent}"`,
		);
	}

	return {
		start: startPosition,
		end: startPosition + contentToRemove.length,
	};
};

/**
 * Finds and removes injected content for revert operations with before/after targeting
 */
const getBeforeAfterRemovalPositions = (
	content: string,
	targets: string[],
	injectedContent: string,
	mode: "before" | "after",
	strict = false,
): { start: number; end: number }[] | null => {
	const positions: { start: number; end: number }[] = [];

	for (const target of targets) {
		let searchStart = 0;
		let foundIndex = content.indexOf(target, searchStart);

		while (foundIndex !== -1) {
			let contentStart: number;
			let contentEnd: number;

			if (mode === "before") {
				contentEnd = foundIndex;
				contentStart = contentEnd - injectedContent.length;
			} else {
				contentStart = foundIndex + target.length;
				contentEnd = contentStart + injectedContent.length;
			}

			// Validate that the content at this position matches what we want to remove
			if (contentStart >= 0 && contentEnd <= content.length) {
				const actualContent = content.slice(contentStart, contentEnd);
				if (actualContent === injectedContent) {
					positions.push({ start: contentStart, end: contentEnd });
				} else if (strict) {
					throw new Error(
						`Content mismatch near target "${target}". Expected: "${injectedContent}", Found: "${actualContent}"`,
					);
				}
			} else if (strict) {
				throw new Error(
					`Injected content not found ${mode} target "${target}"`,
				);
			}

			searchStart = foundIndex + target.length;
			foundIndex = content.indexOf(target, searchStart);
		}
	}

	if (positions.length === 0 && strict) {
		throw new Error("No injected content found to remove");
	}

	if (positions.length === 0) {
		return null; // Graceful handling in non-strict mode
	}

	// Sort positions in reverse order for consistent removal
	return positions.sort((a, b) => b.start - a.start);
};

/**
 * Validates file accessibility and type
 */
const validateFile = async (filePath: string): Promise<string | null> => {
	try {
		await fs.access(filePath);
	} catch {
		return `File does not exist: ${filePath}`;
	}

	if (await isBinaryExt(filePath)) {
		return `Cannot inject into binary file: ${filePath}`;
	}

	return null;
};

/**
 * Creates a result object with conditional code inclusion
 */
const createResult = (
	success: boolean,
	filePath: string,
	injection: SingleInjection,
	transformer?: StringTransformer,
	error?: string,
	logCode?: boolean,
	matchesFound?: number,
): InjectionResult => {
	const result: InjectionResult = {
		success,
		filePath,
	};

	// Include positioning information based on what was used
	if (injection.location) {
		result.location = injection.location;
	}
	if (injection.injectBefore) {
		result.injectBefore = injection.injectBefore;
	}
	if (injection.injectAfter) {
		result.injectAfter = injection.injectAfter;
	}

	if (error) {
		result.error = error;
	}

	if (transformer) {
		if (logCode) {
			result.code = transformer.current();
		}
		result.hasChanged = transformer.hasChanged();
	}

	if (matchesFound !== undefined) {
		result.matchesFound = matchesFound;
	}

	return result;
};

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Injects or reverts content at a specific location in a single file
 */
export const injectAtLocation = async (
	injection: SingleInjection,
	options: InjectionOptions = {},
): Promise<InjectionResult> => {
	const { filePath, location, content, injectBefore, injectAfter } = injection;
	const {
		revert = false,
		based = "1-based",
		logCode = false,
		strict = false,
		arrayBeforeAfter = "array-means-multiline",
	} = options;

	try {
		// Validate positioning
		const positioningError = validateInjectionPositioning(injection);
		if (positioningError) {
			return createResult(
				false,
				filePath,
				injection,
				undefined,
				positioningError,
				logCode,
			);
		}

		// Validate line/column if using location-based injection
		if (location) {
			const validationError = validateLineColumn(
				location.line,
				location.column,
				based,
			);
			if (validationError) {
				return createResult(
					false,
					filePath,
					injection,
					undefined,
					validationError,
					logCode,
				);
			}
		}

		// Validate file
		const fileError = await validateFile(filePath);
		if (fileError) {
			return createResult(
				false,
				filePath,
				injection,
				undefined,
				fileError,
				logCode,
			);
		}

		// Read and transform file
		let matchesFound = 0;
		const result = await readAndTransform(filePath, (transformer) => {
			try {
				const currentContent = transformer.current();
				const normalizedContent = normalizeContent(content);

				if (location) {
					// Location-based injection/revert
					if (revert) {
						const removalRange = getRemovalRange(
							currentContent,
							location.line,
							location.column,
							normalizedContent,
							based,
							strict,
						);

						if (removalRange === null) {
							return transformer; // No changes in non-strict mode
						}

						const { start, end } = removalRange;
						return remove(transformer, start, end);
					}

					const position = getLineColumnPosition(
						currentContent,
						location.line,
						location.column,
						based,
					);

					return insertAt(transformer, position, normalizedContent);
				}
				if (injectBefore || injectAfter) {
					// Before/after injection/revert
					const target = injectBefore || injectAfter;
					if (!target) {
						throw new Error("Invalid injection configuration");
					}
					const mode = injectBefore ? "before" : "after";
					const targets = normalizeTargetStrings(target, arrayBeforeAfter);

					if (revert) {
						const removalPositions = getBeforeAfterRemovalPositions(
							currentContent,
							targets,
							normalizedContent,
							mode,
							strict,
						);

						if (removalPositions === null) {
							return transformer; // No changes in non-strict mode
						}

						let modifiedTransformer = transformer;
						for (const { start, end } of removalPositions) {
							modifiedTransformer = remove(modifiedTransformer, start, end);
							matchesFound++;
						}
						return modifiedTransformer;
					}
					const positions = findInjectionPositions(
						currentContent,
						targets,
						mode,
					);
					matchesFound = positions.length;

					let modifiedTransformer = transformer;
					for (const { position } of positions) {
						modifiedTransformer = insertAt(
							modifiedTransformer,
							position,
							normalizedContent,
						);
					}
					return modifiedTransformer;
				}

				throw new Error("Invalid injection configuration");
			} catch (error) {
				const operation = revert ? "Revert" : "Injection";
				throw new Error(
					`${operation} failed: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		});

		// Write to file if requested (default: true)
		if (options.writeToFile !== false) {
			await fs.writeFile(filePath, result.code);
		}

		// Generate source map if requested
		if (options.generateSourceMap && options.sourceMapPath) {
			const originalContent = await fs.readFile(filePath, "utf-8");
			const transformer = createTransformer(originalContent);
			const normalizedContent = normalizeContent(content);

			let transformedContent: StringTransformer;

			if (location) {
				if (revert) {
					const removalRange = getRemovalRange(
						originalContent,
						location.line,
						location.column,
						normalizedContent,
						based,
						strict,
					);

					if (removalRange === null) {
						transformedContent = transformer;
					} else {
						const { start, end } = removalRange;
						transformedContent = remove(transformer, start, end);
					}
				} else {
					const position = getLineColumnPosition(
						originalContent,
						location.line,
						location.column,
						based,
					);

					transformedContent = insertAt(
						transformer,
						position,
						normalizedContent,
					);
				}
			} else if (injectBefore || injectAfter) {
				const target = injectBefore || injectAfter;
				if (!target) {
					throw new Error("Invalid injection configuration");
				}
				const mode = injectBefore ? "before" : "after";
				const targets = normalizeTargetStrings(target, arrayBeforeAfter);

				if (revert) {
					const removalPositions = getBeforeAfterRemovalPositions(
						originalContent,
						targets,
						normalizedContent,
						mode,
						strict,
					);

					transformedContent = transformer;
					if (removalPositions) {
						for (const { start, end } of removalPositions) {
							transformedContent = remove(transformedContent, start, end);
						}
					}
				} else {
					const positions = findInjectionPositions(
						originalContent,
						targets,
						mode,
					);
					transformedContent = transformer;
					for (const { position } of positions) {
						transformedContent = insertAt(
							transformedContent,
							position,
							normalizedContent,
						);
					}
				}
			} else {
				transformedContent = transformer;
			}

			const map = transformedContent.generateMap({
				source: filePath,
				file: options.sourceMapPath,
				includeContent: true,
			});
			await fs.writeFile(options.sourceMapPath, map.toString());
		}

		const transformer = createTransformer(result.code);
		return createResult(
			true,
			filePath,
			injection,
			transformer,
			undefined,
			logCode,
			matchesFound,
		);
	} catch (error) {
		return createResult(
			false,
			filePath,
			injection,
			undefined,
			error instanceof Error ? error.message : String(error),
			logCode,
		);
	}
};

/**
 * Injects or reverts content at multiple locations across multiple files
 * Processes injections efficiently by grouping by file
 *
 * Supports automatic line-offset handling:
 * Whenever an earlier injection adds newline characters, subsequent
 * location-based injections will transparently subtract the cumulative
 * newline count so users can keep writing “line: N” without manual fixes.
 */
export const injectMultiple = async (
	injections: SingleInjection[],
	options: InjectionOptions = {},
): Promise<InjectionResult[]> => {
	const results: InjectionResult[] = [];
	const {
		revert = false,
		based = "1-based",
		logCode = false,
		strict = false,
		arrayBeforeAfter = "array-means-multiline",
	} = options;

	// Group injections by file path for efficient processing
	const injectionsByFile = new Map<string, SingleInjection[]>();

	for (const injection of injections) {
		const fileInjections = injectionsByFile.get(injection.filePath) || [];
		fileInjections.push(injection);
		injectionsByFile.set(injection.filePath, fileInjections);
	}

	// Process each file atomically
	for (const [filePath, fileInjections] of injectionsByFile) {
		try {
			// Validate file once per file
			const fileError = await validateFile(filePath);
			if (fileError) {
				for (const injection of fileInjections) {
					results.push(
						createResult(
							false,
							filePath,
							injection,
							undefined,
							fileError,
							logCode,
						),
					);
				}
				continue;
			}

			// Validate all injections for this file
			const validationErrors: { injection: SingleInjection; error: string }[] =
				[];

			for (const injection of fileInjections) {
				const positioningError = validateInjectionPositioning(injection);
				if (positioningError) {
					validationErrors.push({ injection, error: positioningError });
					continue;
				}

				if (injection.location) {
					const validationError = validateLineColumn(
						injection.location.line,
						injection.location.column,
						based,
					);
					if (validationError) {
						validationErrors.push({ injection, error: validationError });
					}
				}
			}

			// Add validation errors to results
			for (const { injection, error } of validationErrors) {
				results.push(
					createResult(false, filePath, injection, undefined, error, logCode),
				);
			}

			// Filter out invalid injections
			const validInjections = fileInjections.filter(
				(inj) => !validationErrors.some((ve) => ve.injection === inj),
			);

			if (validInjections.length === 0) {
				continue;
			}

			// Separate location-based and before/after injections
			const locationInjections = validInjections.filter((inj) => inj.location);
			const beforeAfterInjections = validInjections.filter(
				(inj) => inj.injectBefore || inj.injectAfter,
			);

			let transformer = createTransformer(await fs.readFile(filePath, "utf-8"));
			let hasAnyChanges = false;

			// Calculate positions for all location-based injections using the original content
			const originalContent = transformer.current();
			const allInjectionsWithPositions: {
				injection: SingleInjection;
				originalPosition: number;
				normalizedContent: string;
				lineNumber: number;
			}[] = [];

			/* -------- automatic line-offset handling for “location” injections ---- */
			let cumulativeNewlineOffset = 0;

			for (const injection of locationInjections) {
				try {
					const normalizedContent = normalizeContent(injection.content);

					// Every newline added by *earlier* injections shifts lines below.
					// We therefore subtract the running offset so the user can keep
					// writing intuitive line numbers.
					const effectiveLine = Math.max(
						based === "0-based" ? 0 : 1,
						injection.location!.line - cumulativeNewlineOffset,
					);

					if (revert) {
						const removalRange = getRemovalRange(
							originalContent,
							effectiveLine,
							injection.location!.column,
							normalizedContent,
							based,
							strict,
						);

						if (removalRange !== null) {
							allInjectionsWithPositions.push({
								injection,
								originalPosition: removalRange.start,
								normalizedContent: `__REMOVE_${removalRange.start}_${removalRange.end}__`,
								lineNumber: effectiveLine,
							});
						}
					} else {
						const position = getLineColumnPosition(
							originalContent,
							effectiveLine,
							injection.location!.column,
							based,
						);

						allInjectionsWithPositions.push({
							injection,
							originalPosition: position,
							normalizedContent,
							lineNumber: effectiveLine,
						});
					}

					// Update the running offset only AFTER processing this injection.
					cumulativeNewlineOffset += countNewlines(normalizedContent);
				} catch (error) {
					results.push(
						createResult(
							false,
							filePath,
							injection,
							undefined,
							error instanceof Error ? error.message : String(error),
							logCode,
						),
					);
				}
			}

			// Sort all injections by position (right to left for inject, left to right for revert)
			allInjectionsWithPositions.sort((a, b) => {
				if (revert) {
					return a.originalPosition - b.originalPosition; // Left to right for revert
				}
				return b.originalPosition - a.originalPosition; // Right to left for inject
			});

			// Apply all location-based injections
			for (const {
				injection,
				originalPosition,
				normalizedContent,
			} of allInjectionsWithPositions) {
				try {
					let matchesFound = 0;

					if (revert && normalizedContent.startsWith("__REMOVE_")) {
						// Extract removal range from the encoded string
						const match = normalizedContent.match(/^__REMOVE_(\d+)_(\d+)__$/);
						if (match?.[1] && match?.[2]) {
							const start = Number.parseInt(match[1], 10);
							const end = Number.parseInt(match[2], 10);
							transformer = remove(transformer, start, end);
							matchesFound = 1;
						}
					} else if (!revert) {
						transformer = insertAt(
							transformer,
							originalPosition,
							normalizedContent,
						);
						matchesFound = 1;
					}

					hasAnyChanges = true;
					results.push(
						createResult(
							true,
							filePath,
							injection,
							transformer,
							undefined,
							logCode,
							matchesFound,
						),
					);
				} catch (error) {
					results.push(
						createResult(
							false,
							filePath,
							injection,
							undefined,
							error instanceof Error ? error.message : String(error),
							logCode,
						),
					);
				}
			}

			/* ----------------------- before / after injections ------------------- */
			for (const injection of beforeAfterInjections) {
				try {
					const currentContent = transformer.current();
					const normalizedContent = normalizeContent(injection.content);
					let matchesFound = 0;

					const target = injection.injectBefore || injection.injectAfter;
					if (!target) {
						throw new Error("Invalid injection configuration");
					}
					const mode = injection.injectBefore ? "before" : "after";
					const targets = normalizeTargetStrings(target, arrayBeforeAfter);

					if (revert) {
						const removalPositions = getBeforeAfterRemovalPositions(
							currentContent,
							targets,
							normalizedContent,
							mode,
							strict,
						);

						if (removalPositions === null) {
							results.push(
								createResult(
									true,
									filePath,
									injection,
									transformer,
									undefined,
									logCode,
									0,
								),
							);
							continue;
						}

						for (const { start, end } of removalPositions) {
							transformer = remove(transformer, start, end);
							matchesFound++;
						}
					} else {
						const positions = findInjectionPositions(
							currentContent,
							targets,
							mode,
						);
						matchesFound = positions.length;

						for (const { position } of positions) {
							transformer = insertAt(transformer, position, normalizedContent);
						}
					}

					hasAnyChanges = true;
					results.push(
						createResult(
							true,
							filePath,
							injection,
							transformer,
							undefined,
							logCode,
							matchesFound,
						),
					);
				} catch (error) {
					results.push(
						createResult(
							false,
							filePath,
							injection,
							undefined,
							error instanceof Error ? error.message : String(error),
							logCode,
						),
					);
				}
			}

			// Write to file if there were changes
			if (hasAnyChanges && options.writeToFile !== false) {
				await fs.writeFile(filePath, transformer.current());
			}

			// Generate source map if requested
			if (hasAnyChanges && options.generateSourceMap && options.sourceMapPath) {
				const map = transformer.generateMap({
					source: filePath,
					file: options.sourceMapPath,
					includeContent: true,
				});
				const sourceMapFilename = `${path.parse(filePath).name}.map`;
				const sourceMapPath = path.join(
					path.dirname(options.sourceMapPath),
					sourceMapFilename,
				);
				await fs.writeFile(sourceMapPath, map.toString());
			}
		} catch (error) {
			// Handle file-level errors
			for (const injection of fileInjections) {
				results.push(
					createResult(
						false,
						filePath,
						injection,
						undefined,
						error instanceof Error ? error.message : String(error),
						logCode,
					),
				);
			}
		}
	}

	return results;
};

/**
 * Creates a single injection object with validation
 */
export const createInjection = (
	filePath: string,
	content: string | string[],
	positioning:
		| { line: number; column?: number }
		| { injectBefore: string | string[] }
		| { injectAfter: string | string[] },
): SingleInjection => {
	const injection: SingleInjection = {
		filePath,
		content,
	};

	if ("line" in positioning) {
		injection.location = {
			line: positioning.line,
			column: positioning.column,
		};
	} else if ("injectBefore" in positioning) {
		injection.injectBefore = positioning.injectBefore;
	} else if ("injectAfter" in positioning) {
		injection.injectAfter = positioning.injectAfter;
	}

	return injection;
};

/**
 * Validates a single injection configuration
 */
export const validateInjection = (
	injection: SingleInjection,
	based: "0-based" | "1-based" = "1-based",
): string | null => {
	if (!injection.filePath) {
		return "File path is required";
	}

	if (
		!injection.content ||
		(Array.isArray(injection.content) && injection.content.length === 0)
	) {
		return "Content is required";
	}

	if (Array.isArray(injection.content)) {
		for (const item of injection.content) {
			if (typeof item !== "string") {
				return "All content array items must be strings";
			}
		}
	}

	const positioningError = validateInjectionPositioning(injection);
	if (positioningError) {
		return positioningError;
	}

	if (injection.location) {
		return validateLineColumn(
			injection.location.line,
			injection.location.column,
			based,
		);
	}

	// Validate before/after targets
	if (injection.injectBefore) {
		if (
			typeof injection.injectBefore !== "string" &&
			!Array.isArray(injection.injectBefore)
		) {
			return "injectBefore must be a string or string array";
		}
		if (Array.isArray(injection.injectBefore)) {
			for (const item of injection.injectBefore) {
				if (typeof item !== "string") {
					return "All injectBefore array items must be strings";
				}
			}
			if (injection.injectBefore.length === 0) {
				return "injectBefore array cannot be empty";
			}
		}
	}

	if (injection.injectAfter) {
		if (
			typeof injection.injectAfter !== "string" &&
			!Array.isArray(injection.injectAfter)
		) {
			return "injectAfter must be a string or string array";
		}
		if (Array.isArray(injection.injectAfter)) {
			for (const item of injection.injectAfter) {
				if (typeof item !== "string") {
					return "All injectAfter array items must be strings";
				}
			}
			if (injection.injectAfter.length === 0) {
				return "injectAfter array cannot be empty";
			}
		}
	}

	return null;
};

/**
 * Batch validates multiple injections
 */
export const validateMultipleInjections = (
	injections: SingleInjection[],
	based: "0-based" | "1-based" = "1-based",
): { index: number; error: string }[] => {
	const errors: { index: number; error: string }[] = [];

	for (let i = 0; i < injections.length; i++) {
		const injection = injections[i];
		if (!injection) continue;
		const error = validateInjection(injection, based);
		if (error) {
			errors.push({ index: i, error });
		}
	}

	return errors;
};

/**
 * Preview injection without writing to file
 */
export const previewInjection = async (
	injection: SingleInjection,
	options: Omit<InjectionOptions, "writeToFile"> = {},
): Promise<InjectionResult> =>
	injectAtLocation(injection, { ...options, writeToFile: false });

/**
 * Preview multiple injections without writing to files
 */
export const previewMultipleInjections = async (
	injections: SingleInjection[],
	options: Omit<InjectionOptions, "writeToFile"> = {},
): Promise<InjectionResult[]> =>
	injectMultiple(injections, { ...options, writeToFile: false });

/**
 * Preview revert operation without writing to file
 */
export const previewRevert = async (
	injection: SingleInjection,
	options: Omit<InjectionOptions, "writeToFile" | "revert"> = {},
): Promise<InjectionResult> =>
	injectAtLocation(injection, {
		...options,
		writeToFile: false,
		revert: true,
	});

/**
 * Preview multiple revert operations without writing to files
 */
export const previewMultipleReverts = async (
	injections: SingleInjection[],
	options: Omit<InjectionOptions, "writeToFile" | "revert"> = {},
): Promise<InjectionResult[]> =>
	injectMultiple(injections, {
		...options,
		writeToFile: false,
		revert: true,
	});

export default {
	injectAtLocation,
	injectMultiple,
	createInjection,
	validateInjection,
	validateMultipleInjections,
	previewInjection,
	previewMultipleInjections,
	previewRevert,
	previewMultipleReverts,
};
