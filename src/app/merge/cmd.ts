import path from "@reliverse/pathkit";
import { glob } from "@reliverse/reglob";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import {
  defineCommand,
  inputPrompt,
  confirmPrompt,
  multiselectPrompt,
  defineArgs,
} from "@reliverse/rempts";
import MagicString from "magic-string";
import { Bundle } from "magic-string";
import pMap from "p-map";
import prettyMilliseconds from "pretty-ms";

import { isBinaryExt } from "~/libs/sdk/sdk-impl/utils/binary";
import { getCommentPrefix } from "~/libs/sdk/sdk-impl/utils/comments";
import { createPerfTimer, getElapsedPerfTime } from "~/libs/sdk/sdk-impl/utils/utils-perf";
import {
  checkPermissions,
  checkFileSize,
  handleError,
  validateFileExists,
  sanitizeInput,
  validateMergeOperation,
  setFileSizeLimits,
  validatePath,
  validateFileType,
  validateContent,
} from "~/libs/sdk/sdk-impl/utils/utils-security";

// ---------- constants ----------

const DEFAULT_IGNORES = ["**/.git/**", "**/node_modules/**"] as const;
const DEFAULT_SEPARATOR_RAW = "\\n\\n";

// ---------- helpers ----------

const normalizeGlobPattern = (pattern: string): string => {
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

const parseCSV = (s: string) =>
  s
    .split(",")
    .map((t) => sanitizeInput(t.trim()))
    .filter(Boolean);

const unescape = (s: string) => s.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

const maybePrompt = async <T>(
  interactive: boolean,
  value: T | undefined,
  promptFn: () => Promise<T>,
): Promise<T | undefined> => {
  if (!interactive || value !== undefined) return value;
  return promptFn();
};

const collectFiles = async (
  include: string[],
  extraIgnore: string[],
  recursive: boolean,
  sortBy: "name" | "path" | "mtime" | "none",
  depth: number,
): Promise<string[]> => {
  try {
    // Normalize glob patterns to handle directory paths without glob characters
    const normalizedInclude = include.map(normalizeGlobPattern);

    const files = await glob(normalizedInclude, {
      ignore: [...DEFAULT_IGNORES, ...extraIgnore.map(sanitizeInput)],
      absolute: true,
      onlyFiles: true,
      deep: recursive ? undefined : 1,
    });

    // Validate each file and filter out binary files
    const validFiles: string[] = [];
    let binaryFilesDetected = false;

    for (const file of files) {
      await validateFileExists(file, "merge");
      await checkFileSize(file);
      await checkPermissions(file, "read");

      // Skip binary files
      if (await isBinaryExt(file)) {
        binaryFilesDetected = true;
        continue;
      }

      validFiles.push(file);
    }

    if (binaryFilesDetected) {
      relinka("info", "Binary files were detected and skipped");
    }

    // Deduplicate files
    let filtered = [...new Set(validFiles)];

    // Group files by their directory structure based on depth
    if (depth > 0) {
      const fileGroups = new Map<string, string[]>();
      for (const file of filtered) {
        const relPath = path.relative(process.cwd(), file);
        const parts = relPath.split(path.sep);
        const groupKey = parts.slice(0, depth).join(path.sep);

        if (!fileGroups.has(groupKey)) {
          fileGroups.set(groupKey, []);
        }
        const group = fileGroups.get(groupKey);
        if (group) {
          group.push(file);
        }
      }
      filtered = Array.from(fileGroups.values()).flat();
    }

    if (sortBy === "name") {
      filtered.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
    } else if (sortBy === "path") {
      filtered.sort();
    } else if (sortBy === "mtime") {
      filtered = await pMap(filtered, async (f) => ({ f, mtime: (await fs.stat(f)).mtimeMs }), {
        concurrency: 8,
      }).then((arr) => arr.sort((a, b) => a.mtime - b.mtime).map((x) => x.f));
    }
    return filtered;
  } catch (error) {
    handleError(error, "collectFiles");
    return []; // Return empty array on error
  }
};

const writeResult = async (
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
    handleError(error, "writeResult");
  }
};

const writeFilesPreserveStructure = async (
  files: string[],
  outDir: string,
  preserveStructure: boolean,
  increment: boolean,
  concurrency: number,
  dryRun: boolean,
  backup: boolean,
): Promise<void> => {
  try {
    if (!files?.length) {
      throw new Error("No files provided for merge operation");
    }

    const cwd = process.cwd();
    const fileNameCounts = new Map<string, Map<string, number>>();

    // Validate merge operation
    await validateMergeOperation(files);

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
      },
      { concurrency },
    );
  } catch (error) {
    handleError(error, "writeFilesPreserveStructure");
  }
};

const processSection = (
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

// ---------- command ----------

export default defineCommand({
  meta: {
    name: "merge",
    version: "1.2.1",
    description:
      "Merge text files with optional commented path header/footer, skips binaries/media, built for CI & interactive use. Supports copy-like patterns and advanced options.",
  },
  args: defineArgs({
    /* ===== GENERAL ARGS ===== */
    s: { type: "array", description: "Input glob patterns" },
    d: { type: "string", description: "Output file path or directory" },
    ignore: { type: "array", description: "Extra ignore patterns" },
    format: {
      type: "string",
      default: "txt",
      description: "Fallback extension when output path is omitted",
    },
    "max-file-size": {
      type: "number",
      description: "Maximum size of a single file in bytes (default: 10MB)",
    },
    "max-merge-size": {
      type: "number",
      description: "Maximum total size of all files to merge in bytes (default: 100MB)",
    },
    stdout: { type: "boolean", description: "Print to stdout" },
    noPath: {
      type: "boolean",
      description: "Don't inject relative path below each file",
    },
    pathAbove: {
      type: "boolean",
      description: "Print file path above each file's content (default: true)",
      default: true,
    },
    separator: {
      type: "string",
      description: `Custom separator (default ${DEFAULT_SEPARATOR_RAW})`,
    },
    comment: {
      type: "string",
      description: "Custom comment prefix (e.g. '# ')",
    },
    forceComment: {
      type: "boolean",
      description: "Force custom comment prefix for all file types",
    },
    batch: {
      type: "boolean",
      description: "Disable interactive prompts (CI/non-interactive mode)",
    },
    recursive: {
      type: "boolean",
      description: "Recursively process all files in subdirectories (default: true)",
      default: true,
    },
    preserveStructure: {
      type: "boolean",
      description: "Preserve source directory structure in output (default: true)",
      default: true,
    },
    increment: {
      type: "boolean",
      description: "Attach an incrementing index to each output filename if set (default: false)",
    },
    concurrency: {
      type: "number",
      description: "Number of concurrent file operations (default: 8)",
      default: 8,
    },
    sort: {
      type: "string",
      description: "Sort files by: name, path, mtime, none (default: path)",
      default: "path",
    },
    dryRun: {
      type: "boolean",
      description: "Show what would be done, but don't write files",
    },
    backup: {
      type: "boolean",
      description: "Backup output files before overwriting",
    },
    dedupe: {
      type: "boolean",
      description: "Remove duplicate file contents in merge",
    },
    header: {
      type: "string",
      description: "Header text to add at the start of merged output",
    },
    footer: {
      type: "string",
      description: "Footer text to add at the end of merged output",
    },
    "select-files": {
      type: "boolean",
      description: "Prompt for file selection before merging",
    },
    interactive: {
      type: "boolean",
      description: "Enable interactive mode with prompts (default: false)",
    },
    depth: {
      type: "number",
      description: "Depth level to start processing from (default: 0)",
      default: 0,
    },
    sourcemap: {
      type: "boolean",
      description: "Generate source map for the merged output",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging",
    },
    force: {
      type: "boolean",
      description: "Overwrite or delete existing paths when conflicts are detected (default: true)",
      default: true,
    },
  }),
  async run({ args }) {
    try {
      const timer = createPerfTimer();
      const interactive = args.interactive ?? false;
      const depth = args.depth ?? 0;
      const verbose = args.verbose ?? false;
      const force = args.force ?? true;

      if (verbose) {
        relinka("log", "Verbose logging enabled");
        relinka("log", `Force mode: ${force ? "enabled" : "disabled"}`);
      }

      let include = args.s ?? [];
      if (include.length === 0) {
        const raw = await maybePrompt(interactive, undefined, () =>
          inputPrompt({
            title: "Input glob patterns (comma separated)",
            placeholder: "src/**/*.ts, !**/*.test.ts",
          }),
        );
        if (raw) include = parseCSV(raw as string);
      }
      if (include.length === 0) {
        throw new Error("No input patterns supplied and prompts disabled");
      }

      let ignore = args.ignore ?? [];
      if (ignore.length === 0) {
        const raw = await maybePrompt(interactive, undefined, () =>
          inputPrompt({
            title: "Ignore patterns (comma separated, blank for none)",
            placeholder: "**/*.d.ts",
          }),
        );
        if (raw) ignore = parseCSV(raw as string);
      }

      let customComment = args.comment;
      if (customComment === undefined) {
        const want = await maybePrompt(interactive, undefined, () =>
          confirmPrompt({
            title: "Provide custom comment prefix?",
            defaultValue: false,
          }),
        );
        if (want) {
          customComment = (await inputPrompt({
            title: "Custom comment prefix (include trailing space if needed)",
            placeholder: "# ",
          })) as string;
        }
      }
      const forceComment = args.forceComment ?? false;
      const injectPath = !args.noPath;
      const pathAbove = args.pathAbove ?? true;

      const sepRaw =
        args.separator ??
        ((await maybePrompt(interactive, undefined, () =>
          inputPrompt({
            title: "Separator between files (\\n for newline, blank → blank line)",
            placeholder: DEFAULT_SEPARATOR_RAW,
          }),
        )) as string | undefined) ??
        DEFAULT_SEPARATOR_RAW;
      const separator = unescape(sepRaw);

      let stdoutFlag = args.stdout ?? false;
      let outFile = args.d;

      if (!stdoutFlag && !outFile && interactive) {
        stdoutFlag = await confirmPrompt({
          title: "Print result to stdout?",
          defaultValue: false,
        });
        if (!stdoutFlag) {
          outFile = (await inputPrompt({
            title: "Output file path (blank → merged.<ext>)",
            placeholder: "",
          })) as string;
          if (!outFile) {
            const ext = (await inputPrompt({
              title: "File extension",
              placeholder: args.format,
            })) as string;
            outFile = `merged.${(ext || args.format).replace(/^\./, "")}`;
          }
        }
      }

      const recursive = args.recursive ?? true;
      const preserveStructure = args.preserveStructure ?? true;
      const increment = args.increment ?? false;
      const concurrency = args.concurrency ?? 8;
      const sortBy = args.sort as "name" | "path" | "mtime" | "none";
      const dryRun = args.dryRun ?? false;
      const backup = args.backup ?? false;
      const dedupe = args.dedupe ?? false;
      const header = args.header;
      const footer = args.footer;
      const selectFiles = args["select-files"] ?? false;

      // Set file size limits if provided
      setFileSizeLimits(args["max-file-size"], args["max-merge-size"]);

      let files = await collectFiles(include, ignore, recursive, sortBy, depth);

      if (files.length === 0) {
        throw new Error("No files matched given patterns");
      }

      if (selectFiles && interactive) {
        const selected = await multiselectPrompt({
          title: "Select files to merge",
          options: files.map((f) => ({
            label: path.relative(process.cwd(), f),
            value: f,
          })),
        });
        files = Array.isArray(selected) ? selected : [selected];
        if (files.length === 0) {
          throw new Error("No files selected for merging");
        }
      }

      const getPrefix = (filePath: string): string => {
        if (forceComment && customComment) return customComment;
        return getCommentPrefix(filePath, forceComment, customComment);
      };

      if (outFile && (await fs.pathExists(outFile)) && (await fs.stat(outFile)).isDirectory()) {
        await writeFilesPreserveStructure(
          files,
          outFile,
          preserveStructure,
          increment,
          concurrency,
          dryRun,
          backup,
        );
        return;
      }

      const cwd = process.cwd();
      const seen = new Set<string>();
      const sections = await pMap(
        files,
        async (f) => {
          const raw = (await fs.readFile(f, "utf8")) as string;
          if (dedupe) {
            const hash = raw.trim();
            if (seen.has(hash)) return null;
            seen.add(hash);
          }
          const rel = path.relative(cwd, f);
          const prefix = getPrefix(f);
          return processSection(raw, rel, prefix, pathAbove, injectPath);
        },
        { concurrency },
      );
      const filteredSections = sections.filter(Boolean) as string[];
      if (header) filteredSections.unshift(header);
      if (footer) filteredSections.push(footer);

      await writeResult(
        filteredSections,
        separator,
        outFile,
        stdoutFlag,
        dryRun,
        backup,
        args.sourcemap,
      );
      const elapsed = getElapsedPerfTime(timer);
      relinka("success", `Merge completed in ${prettyMilliseconds(elapsed)}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      relinka("error", `Error during merge operation: ${errorMessage}`);
      process.exit(1);
    }
  },
});
