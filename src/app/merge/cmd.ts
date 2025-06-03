// merge command is used to merge multiple files into a single file.
// patterns with both glob stars and without glob stars are supported.
// simple example: `bun dler merge --s "src/**/*.ts" --d "dist/merged.ts"`
// advanced example: `bun dler merge --s ".temp1/packages/*/lib/**/*" --d ".temp2/merged.ts" --sort "mtime" --header "// Header" --footer "// Footer" --dedupe`
// generate mock template: `bun dler merge --s "src/templates" --d "templates/my-template.ts" --as-template`

import path from "@reliverse/pathkit";
import { glob } from "@reliverse/reglob";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineCommand, inputPrompt, confirmPrompt, multiselectPrompt } from "@reliverse/rempts";
import pMap from "p-map";
import prettyMilliseconds from "pretty-ms";

import type { FileContent, FileType, Template } from "~/libs/sdk/sdk-types";

import { isBinaryExt } from "~/libs/sdk/sdk-impl/utils/binary";
import { createPerfTimer, getElapsedPerfTime } from "~/libs/sdk/sdk-impl/utils/utils-perf";
import {
  checkPermissions,
  checkFileSize,
  handleError,
  validateFileExists,
  sanitizeInput,
  validateMergeOperation,
} from "~/libs/sdk/sdk-impl/utils/utils-security";

// ---------- constants ----------

const DEFAULT_IGNORES = ["**/.git/**", "**/node_modules/**"] as const;

const COMMENT_MAP: Record<string, string> = {
  js: "// ",
  jsx: "// ",
  ts: "// ",
  tsx: "// ",
  c: "// ",
  cpp: "// ",
  h: "// ",
  java: "// ",
  go: "// ",
  kt: "// ",
  swift: "// ",
  rs: "// ",
  cs: "// ",
  json: "// ",
  proto: "// ",
  dart: "// ",
  py: "# ",
  rb: "# ",
  sh: "# ",
  pl: "# ",
  r: "# ",
  yml: "# ",
  yaml: "# ",
  sql: "-- ",
  lua: "-- ",
  css: "/* ",
  scss: "/* ",
  less: "/* ",
  html: "<!-- ",
  htm: "<!-- ",
  xml: "<!-- ",
  md: "<!-- ",
};

const DEFAULT_COMMENT = "// ";
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

const ensureTrailingNL = (s: string) => (s.endsWith("\n") ? s : `${s}\n`);

const parseCSV = (s: string) =>
  s
    .split(",")
    .map((t) => sanitizeInput(t.trim()))
    .filter(Boolean);

// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
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

    // Validate each file
    for (const file of files) {
      await validateFileExists(file, "merge");
      await checkFileSize(file);
      await checkPermissions(file, "read");
    }

    // Remove the binary file filter since we want to include them in templates
    let filtered = [...new Set(files)];
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
  separator: string,
  toFile: string | undefined,
  toStdout: boolean,
  dryRun: boolean,
  backup: boolean,
) => {
  try {
    const content = `${sections.join(separator)}\n`;
    if (toStdout || !toFile) {
      process.stdout.write(content);
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
      await fs.writeFile(sanitizedPath, content, "utf8");
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

const generateTemplateFile = async (
  isDev: boolean,
  files: string[],
  outFile: string,
  dryRun: boolean,
  backup: boolean,
  customTemplateName?: string,
  whitelabel = "DLER",
): Promise<void> => {
  const cwd = process.cwd();
  const templateName = customTemplateName || path.basename(outFile, ".ts");
  // Convert template name to uppercase with underscores, handling hyphens and special characters
  const templateConstName =
    templateName
      .replace(/[^a-zA-Z0-9]/g, "_") // Replace any non-alphanumeric with underscore
      .replace(/_+/g, "_") // Replace multiple underscores with single underscore
      .replace(/^_|_$/g, "") // Remove leading/trailing underscores
      .replace(/[A-Z]/g, (letter) => `_${letter}`) // Add underscore before capital letters
      .replace(/^_/, "") // Remove leading underscore
      .toUpperCase() + `_${whitelabel}_TEMPLATE`; // Add suffix with whitelabel

  // Create a valid object key from the template name
  const templateKey = templateName
    .replace(/[^a-zA-Z0-9]/g, "_") // Replace any non-alphanumeric with underscore
    .replace(/_+/g, "_") // Replace multiple underscores with single underscore
    .replace(/^_|_$/g, "") // Remove leading/trailing underscores
    .toLowerCase(); // Convert to lowercase for the object key

  // Create template structure
  const template: Template = {
    name: templateName.charAt(0).toUpperCase() + templateName.slice(1),
    description: `Template generated from ${files.length} files`,
    config: {
      files: {},
    },
  };

  // Process files
  for (const file of files) {
    const relPath = path.relative(cwd, file);
    const ext = path.extname(file).slice(1).toLowerCase();
    const isBinary = await isBinaryExt(file);
    const fileName = path.basename(file).toLowerCase();

    let content: FileContent = "";
    let type: FileType = "binary";

    if (!isBinary) {
      try {
        const fileContent = await fs.readFile(file, "utf8");
        if (ext === "json") {
          const jsonContent = JSON.parse(fileContent) as Record<string, unknown>;

          // Add type casting for package.json and tsconfig.json
          if (fileName === "package.json") {
            content = {
              ...jsonContent,
              __type: "PackageJson",
            } as unknown as FileContent;
          } else if (fileName === "tsconfig.json") {
            content = {
              ...jsonContent,
              __type: "TSConfig",
            } as unknown as FileContent;
          } else {
            content = jsonContent;
          }
          type = "json";
        } else {
          content = fileContent;
          type = "text";
        }
      } catch {
        // If we can't read the file as text, treat it as binary
        type = "binary";
      }
    }

    template.config.files[relPath] = {
      content,
      type: type as "text" | "json", // Type assertion since we know binary files will have empty content
    };
  }

  // Generate TypeScript content
  const tsContent = `import type { Template } from "${isDev ? "~/libs/sdk/sdk-types" : "@reliverse/dler-sdk"}";
${(() => {
  const files = template.config.files;
  if (!files) return "";

  const hasPackageJson = Object.values(files).some(
    (f) => f.type === "json" && (f.content as any)?.__type === "PackageJson",
  );
  const hasTSConfig = Object.values(files).some(
    (f) => f.type === "json" && (f.content as any)?.__type === "TSConfig",
  );

  if (!hasPackageJson && !hasTSConfig) return "";

  const imports = [];
  if (hasPackageJson) imports.push("PackageJson");
  if (hasTSConfig) imports.push("TSConfig");

  return `import type { ${imports.join(", ")} } from "pkg-types";\n`;
})()}

export const ${templateConstName}: Template = ${JSON.stringify(template, null, 2)
    .replace(/"([^"]+)":/g, (_, key) => {
      // Only quote keys that contain special characters or spaces
      return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? `${key}:` : `"${key}":`;
    })
    .replace(/"([^"]+)":/g, (_, key) => {
      // Only quote keys that contain special characters or spaces
      return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? `${key}:` : `"${key}":`;
    })
    .replace(/"([^"]+)":/g, (_, key) => {
      // Only quote keys that contain special characters or spaces
      return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? `${key}:` : `"${key}":`;
    })};

export const ${whitelabel}_TEMPLATES = {
  ${templateKey}: ${templateConstName},
} as const;

export type ${whitelabel}_TEMPLATE_NAMES = keyof typeof ${whitelabel}_TEMPLATES;

export const ${whitelabel.toLowerCase()}TemplatesMap: Record<string, ${whitelabel}_TEMPLATE_NAMES> = {
  ${templateConstName}: "${templateKey}",
};
`;

  if (dryRun) {
    relinka("verbose", `[DRY RUN] Would write template file: ${outFile}`);
    return;
  }

  const dir = path.dirname(outFile);
  if (dir && dir !== ".") await fs.ensureDir(dir);
  if (backup && (await fs.pathExists(outFile))) {
    const backupPath = `${outFile}.${Date.now()}.bak`;
    await fs.copyFile(outFile, backupPath);
  }

  await fs.writeFile(outFile, tsContent, "utf8");
};

// ---------- command ----------

export default defineCommand({
  meta: {
    name: "merge",
    version: "1.0.0",
    description:
      "Merge text files with optional commented path header/footer, skips binaries/media, built for CI & interactive use. Supports copy-like patterns and advanced options.",
  },
  args: {
    dev: { type: "boolean", description: "Generate template for development" },
    s: { type: "array", description: "Input glob patterns" },
    d: { type: "string", description: "Output file path or directory" },
    ignore: { type: "array", description: "Extra ignore patterns" },
    format: {
      type: "string",
      default: "txt",
      description: "Fallback extension when output path is omitted",
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
      default: false,
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
      default: false,
    },
    backup: {
      type: "boolean",
      description: "Backup output files before overwriting",
      default: false,
    },
    dedupe: {
      type: "boolean",
      description: "Remove duplicate file contents in merge",
      default: false,
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
      default: false,
    },
    interactive: {
      type: "boolean",
      description: "Enable interactive mode with prompts (default: false)",
      default: false,
    },
    "as-template": {
      type: "boolean",
      description: "Generate a TypeScript file with MOCK_TEMPLATES structure",
      default: false,
    },
    ctn: {
      type: "string",
      description: "Custom template name when using --as-template",
    },
    whitelabel: {
      type: "string",
      description: "Custom prefix to use instead of 'DLER' in template generation",
      default: "DLER",
    },
  },
  async run({ args }) {
    try {
      const timer = createPerfTimer();
      const interactive = args.interactive ?? false;
      const isDev = args.dev ?? false;
      const whitelabel = args.whitelabel ?? "DLER";
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
      const asTemplate = args["as-template"] ?? false;
      const customTemplateName = args.ctn;

      let files = await collectFiles(include, ignore, recursive, sortBy);

      if (files.length === 0) {
        throw new Error("No text files matched given patterns (binary/media files are skipped)");
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

      if (asTemplate) {
        if (!outFile) {
          outFile = "template.ts";
        } else if (!outFile.endsWith(".ts")) {
          outFile = `${outFile}.ts`;
        }
        await generateTemplateFile(
          isDev,
          files,
          outFile,
          dryRun,
          backup,
          customTemplateName,
          whitelabel,
        );
        const elapsed = getElapsedPerfTime(timer);
        relinka(
          "success",
          `Successfully ${dryRun ? "would generate" : "generated"} template file "${outFile}" (in ${prettyMilliseconds(elapsed)})`,
        );
        return;
      }

      const getPrefix = (filePath: string): string => {
        if (forceComment && customComment) return customComment;
        const ext = path.extname(filePath).slice(1).toLowerCase();
        return COMMENT_MAP[ext] ?? customComment ?? DEFAULT_COMMENT;
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
          let section = raw;
          if (pathAbove) {
            section = `${prefix}${rel}\n${section}`;
          }
          if (injectPath) {
            section = `${ensureTrailingNL(section)}${prefix}${rel}`;
          }
          return section;
        },
        { concurrency },
      );
      const filteredSections = sections.filter(Boolean) as string[];
      if (header) filteredSections.unshift(header);
      if (footer) filteredSections.push(footer);

      await writeResult(filteredSections, separator, outFile, stdoutFlag, dryRun, backup);
      const elapsed = getElapsedPerfTime(timer);
      relinka("success", `Merge completed in ${prettyMilliseconds(elapsed)}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      relinka("error", `Error during merge operation: ${errorMessage}`);
      process.exit(1);
    }
  },
});
