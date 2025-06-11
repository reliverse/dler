/**
 * inject-impl-mod.ts
 * -----------
 * Utility for injecting content into files at specific line/column positions.
 *
 * Fully async -– works with Node, Bun, and other
 * runtimes that support the `fs/promises` API.
 *
 * @author blefnk
 */

import MagicString from "magic-string";
import { promises as fs } from "node:fs";
import * as path from "node:path";

import { isBinaryExt } from "~/libs/sdk/sdk-impl/utils/binary";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface InjectionConfig {
  /** Absolute or relative path to target file. */
  filePath: string;
  /** 1-based line number (1 == first visible line in editors) */
  line: number;
  /** 1-based column number (1 == first visible column in editors) */
  column?: number;
  /** String or array of strings to inject. */
  content: string | string[];
  /** If `true`, inserts string (or first element of array) content on a new line AFTER the target line. */
  createNewLine?: boolean;
  /** Configuration for comment wrapping. */
  commentsMode?: {
    /** Whether to wrap content in comments. */
    activate: boolean;
    /** Whether to use JSDoc style for multiline comments. */
    useJsdocForMultiline?: boolean;
  };
}

export interface InjectionResult {
  /** Absolute or relative path to target file. */
  filePath: string;
  /** Whether the injection was successful. */
  success: boolean;
  /** Error message if injection failed. */
  error?: string;
  /** Generated source map if available. */
  sourcemap?: string;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Injects content into the given file at the requested location.
 *
 * @param filePath       Absolute or relative path to target file.
 * @param line           1-based line number (1 == first visible line in editors, internally == 0).
 * @param column         1-based column number (optional, 1 == first visible column in editors, internally == 0).
 * @param content        String or array of strings to inject.
 * @param createNewLine  If `true`, inserts string (or first element of array) content on a new line AFTER the target line.
 * @param commentsMode   If `true`, wraps injected content in file-type comments.
 * @param generateSourceMap If `true`, generates a source map for the transformation.
 *
 * @returns `true` on success, `false` on failure (errors are logged).
 */
export async function injectAtLocation(
  filePath: string,
  line: number,
  column: number | undefined,
  content: string | string[],
  createNewLine = false,
  commentsMode = { activate: false },
  generateSourceMap = false,
): Promise<boolean> {
  try {
    /* --------------------------- validations -------------------------------- */

    await validateInput(filePath, line, column);

    /* ------------------------- read & preprocess ---------------------------- */

    const originalContent = await fs.readFile(filePath, "utf8");
    const magicString = new MagicString(originalContent, {
      filename: path.basename(filePath),
    });

    /* -------------------- prepare content for injection --------------------- */

    const pieces = Array.isArray(content) ? content : [content];
    const preparedContent = prepareContentForInjection(
      pieces,
      commentsMode,
      path.extname(filePath),
      createNewLine,
    );

    /* ---------------------------- injection --------------------------------- */

    const success = injectWithMagicString(
      magicString,
      originalContent,
      line,
      column,
      preparedContent,
      createNewLine,
    );

    if (!success) return false;

    /* ------------------------ write back to disk ---------------------------- */

    const result = magicString.toString();
    await fs.writeFile(filePath, result, "utf8");

    // Optionally generate source map
    if (generateSourceMap) {
      const map = magicString.generateMap({
        source: filePath,
        file: `${filePath}.map`,
        includeContent: true,
        hires: true,
      });
      await fs.writeFile(`${filePath}.map`, map.toString(), "utf8");
    }

    return true;
  } catch (err) {
    console.error(`[injector] ${filePath}: ${(err as Error).message}`);
    return false;
  }
}

/**
 * Processes multiple injections efficiently by grouping by file and applying in reverse order.
 *
 * @param configs Array of {@link InjectionConfig}.
 * @param generateSourceMaps If `true`, generates source maps for transformations.
 * @returns Array of {@link InjectionResult} in the same order as `configs`.
 */
export async function injectMultiple(
  configs: InjectionConfig[],
  generateSourceMaps = false,
): Promise<InjectionResult[]> {
  // Group configs by file path
  const configsByFile = new Map<string, { config: InjectionConfig; originalIndex: number }[]>();

  configs.forEach((config, index) => {
    if (!configsByFile.has(config.filePath)) {
      configsByFile.set(config.filePath, []);
    }
    configsByFile.get(config.filePath)?.push({ config, originalIndex: index });
  });

  // Results array to maintain original order
  const results: InjectionResult[] = new Array(configs.length);

  // Process each file
  for (const [filePath, fileConfigs] of configsByFile) {
    try {
      // Validate and read file
      const firstConfig = fileConfigs[0]?.config;
      if (!firstConfig) {
        throw new Error(`No valid configs found for file: ${filePath}`);
      }
      await validateInput(firstConfig.filePath, firstConfig.line, firstConfig.column);

      const originalContent = await fs.readFile(filePath, "utf8");
      const magicString = new MagicString(originalContent, {
        filename: path.basename(filePath),
      });

      // Sort configs by line and column in reverse order (last to first)
      // This ensures that earlier positions don't get affected by later injections
      const sortedConfigs = [...fileConfigs].sort((a, b) => {
        const aLine = a.config.line;
        const bLine = b.config.line;
        if (aLine !== bLine) return bLine - aLine; // Reverse line order

        const aCol = a.config.column ?? Number.MAX_SAFE_INTEGER;
        const bCol = b.config.column ?? Number.MAX_SAFE_INTEGER;
        return bCol - aCol; // Reverse column order
      });

      // Apply all injections to the same MagicString instance
      let allSuccessful = true;
      let currentContent = originalContent;
      for (const { config, originalIndex } of sortedConfigs) {
        const { line, column, content, createNewLine, commentsMode } = config;

        const pieces = Array.isArray(content) ? content : [content];
        const preparedContent = prepareContentForInjection(
          pieces,
          commentsMode,
          path.extname(filePath),
          createNewLine ?? false,
        );

        const success = injectWithMagicString(
          magicString,
          currentContent,
          line,
          column,
          preparedContent,
          createNewLine ?? false,
        );

        if (success) {
          currentContent = magicString.toString();
        }

        results[originalIndex] = success
          ? { filePath, success }
          : {
              filePath,
              success: false,
              error: `Injection failed for ${filePath} at line ${line}`,
            };

        if (!success) {
          allSuccessful = false;
        }
      }

      // Write the file only if all injections succeeded
      if (allSuccessful) {
        const result = magicString.toString();
        await fs.writeFile(filePath, result, "utf8");

        // Optionally generate source map
        if (generateSourceMaps) {
          const map = magicString.generateMap({
            source: filePath,
            file: `${filePath}.map`,
            includeContent: true,
            hires: true,
          });
          await fs.writeFile(`${filePath}.map`, map.toString(), "utf8");
        }
      }
    } catch (err) {
      // Mark all configs for this file as failed
      for (const { originalIndex } of fileConfigs) {
        results[originalIndex] = {
          filePath,
          success: false,
          error: `File processing failed: ${(err as Error).message}`,
        };
      }
    }
  }

  return results;
}

/* -------------------------------------------------------------------------- */
/* Implementation details (private helpers)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Validates basic preconditions and throws if any check fails.
 */
async function validateInput(filePath: string, line: number, column?: number): Promise<void> {
  await fs.access(filePath).catch(() => {
    throw new Error("File does not exist.");
  });

  if (await isBinaryExt(filePath)) {
    throw new Error("Cannot inject into binary files.");
  }

  if (!Number.isInteger(line) || line < 1)
    throw new Error("`line` must be a positive 1-based integer.");

  if (column !== undefined && (!Number.isInteger(column) || column < 1))
    throw new Error("`column` must be a positive 1-based integer when provided.");
}

/**
 * Converts 1-based line/column coordinates to 0-based character index.
 */
function getCharacterIndex(
  content: string,
  line1Based: number,
  column1Based?: number,
): { index: number; lineEnd: number; lineStart: number } {
  const lines = content.split(/\r?\n/);
  const eolLength = content.includes("\r\n") ? 2 : 1;

  // Extend content if target line is beyond EOF
  while (lines.length < line1Based) {
    lines.push("");
  }

  let index = 0;

  // Add characters from previous lines (including newlines)
  for (let i = 0; i < line1Based - 1; i++) {
    index += lines[i]?.length ?? 0;
    if (i < lines.length - 1) index += eolLength;
  }

  const targetLine = lines[line1Based - 1] || "";
  const lineStart = index;
  const lineEnd = lineStart + targetLine.length;

  // Add column offset if specified
  if (column1Based !== undefined) {
    const colIndex = Math.min(column1Based - 1, targetLine.length);
    index += colIndex;
  } else {
    // Default to end of line
    index = lineEnd;
  }

  return { index, lineEnd, lineStart };
}

/**
 * Prepares content for injection, handling comments and newlines.
 */
function prepareContentForInjection(
  pieces: string[],
  commentsMode: InjectionConfig["commentsMode"],
  ext: string,
  createNewLine: boolean,
): string {
  let preparedPieces = pieces.slice();

  // Apply comment wrapping if requested
  if (commentsMode?.activate) {
    preparedPieces = applyCommentWrapping(preparedPieces, commentsMode, ext);
  }

  // Join pieces with newlines if multiple pieces
  let result = preparedPieces.join("\n");

  // Add leading newline if createNewLine is true
  if (createNewLine && result) {
    result = "\n" + result;
  }

  return result;
}

/**
 * Wraps content pieces in comments based on file extension.
 */
function applyCommentWrapping(
  pieces: string[],
  commentsMode: NonNullable<InjectionConfig["commentsMode"]>,
  ext: string,
): string[] {
  const { lineComment, blockStart, blockEnd } = getCommentSymbols(ext);

  // Single string case - use line comments
  if (pieces.length === 1) {
    return pieces.map((p) => ` ${lineComment} ${p}`);
  }

  // Array case - use block comments
  const isJsdoc = commentsMode.useJsdocForMultiline;
  const processedPieces = pieces.map((p) => (p === "" ? " " : p));

  return [
    ` ${blockStart}${isJsdoc ? "*" : ""} ${processedPieces[0]}`,
    ...processedPieces.slice(1, -1).map((p) => ` ${isJsdoc ? "*" : ""} ${p}`),
    ` ${isJsdoc ? "*" : ""} ${processedPieces[processedPieces.length - 1]} ${blockEnd}`,
  ];
}

/**
 * Performs the actual injection using MagicString.
 */
function injectWithMagicString(
  magicString: MagicString,
  originalContent: string,
  line1Based: number,
  column1Based: number | undefined,
  preparedContent: string,
  createNewLine: boolean,
): boolean {
  try {
    const { index, lineEnd, lineStart } = getCharacterIndex(
      originalContent,
      line1Based,
      column1Based,
    );

    // Ensure the content exists by extending if needed
    const currentLength = originalContent.length;
    if (index > currentLength) {
      // Calculate how many newlines we need to add
      const linesNeeded = Math.ceil((index - currentLength) / 50); // Rough estimate
      const extension = "\n".repeat(linesNeeded);
      magicString.append(extension);
    }

    if (createNewLine) {
      // Insert on new line after the target position
      if (column1Based !== undefined) {
        // When column is specified with createNewLine, we split the line at that column
        // and insert our content on a new line, then continue with the rest of the original line
        const currentLineContent = originalContent.split(/\r?\n/)[line1Based - 1] || "";
        const beforeColumn = currentLineContent.slice(0, column1Based - 1);
        const afterColumn = currentLineContent.slice(column1Based - 1);

        // Replace the entire line with: beforeColumn + newline + preparedContent + newline + afterColumn
        const replacement =
          beforeColumn + "\n" + preparedContent + (afterColumn ? "\n" + afterColumn : "");
        magicString.overwrite(lineStart, lineEnd, replacement);
      } else {
        // Insert after the entire line
        magicString.appendRight(lineEnd, preparedContent);
      }
    } else {
      // Insert at the exact position without creating new line
      magicString.appendRight(index, preparedContent);
    }

    return true;
  } catch (err) {
    console.error(`[injector] MagicString injection failed: ${(err as Error).message}`);
    return false;
  }
}

/** Returns comment symbols for the given file extension. */
function getCommentSymbols(ext: string): {
  lineComment: string;
  blockStart: string;
  blockEnd: string;
} {
  const map: Record<string, { line?: string; blockStart: string; blockEnd: string }> = {
    ".js": { line: "//", blockStart: "/*", blockEnd: "*/" },
    ".ts": { line: "//", blockStart: "/*", blockEnd: "*/" },
    ".jsx": { line: "//", blockStart: "/*", blockEnd: "*/" },
    ".tsx": { line: "//", blockStart: "/*", blockEnd: "*/" },
    ".css": { line: "//", blockStart: "/*", blockEnd: "*/" },
    ".scss": { line: "//", blockStart: "/*", blockEnd: "*/" },
    ".html": { line: "//", blockStart: "<!--", blockEnd: "-->" },
    ".py": { line: "#", blockStart: '"""', blockEnd: '"""' },
    ".sh": { line: "#", blockStart: ": <<'BLOCK'", blockEnd: "BLOCK" },
    ".yaml": { line: "#", blockStart: "# ---", blockEnd: "# ---" },
    ".yml": { line: "#", blockStart: "# ---", blockEnd: "# ---" },
    ".json": { line: "//", blockStart: "/*", blockEnd: "*/" },
    ".jsonc": { line: "//", blockStart: "/*", blockEnd: "*/" },
  };

  const symbols = map[ext.toLowerCase()] ?? { line: "//", blockStart: "/*", blockEnd: "*/" };
  return {
    lineComment: symbols.line ?? "//",
    blockStart: symbols.blockStart,
    blockEnd: symbols.blockEnd,
  };
}
