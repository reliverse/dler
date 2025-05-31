// simple example: `bun dler merge --s "src/**/*.ts" --d "dist/merged.ts"`
// advanced example: `bun dler merge --s ".temp1/packages/*/lib/**/*" --d ".temp2/merged.ts" --sort "mtime" --header "// Header" --footer "// Footer" --dedupe`

import path from "@reliverse/pathkit";
import { glob } from "@reliverse/reglob";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import {
  defineCommand,
  inputPrompt,
  confirmPrompt,
  multiselectPrompt,
} from "@reliverse/rempts";
import pMap from "p-map";
import prettyMilliseconds from "pretty-ms";

import {
  createPerfTimer,
  getElapsedPerfTime,
} from "~/libs/sdk/sdk-impl/utils/utils-perf";

// ---------- constants ----------

const DEFAULT_IGNORES = ["**/.git/**", "**/node_modules/**"] as const;

const BINARY_EXTS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "webp",
  "svg",
  "ico",
  "mp4",
  "mov",
  "avi",
  "mkv",
  "mp3",
  "wav",
  "flac",
  "ogg",
  "pdf",
  "zip",
  "gz",
  "tar",
  "rar",
  "7z",
  "exe",
  "dll",
  "bin",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "class",
  "jar",
] as const;
const BINARY_SET = new Set<string>(BINARY_EXTS);

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

const isBinaryExt = (file: string) => {
  const ext = path.extname(file).slice(1).toLowerCase();
  return BINARY_SET.has(ext);
};

const ensureTrailingNL = (s: string) => (s.endsWith("\n") ? s : `${s}\n`);

const parseCSV = (s: string) =>
  s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
const unescape = (s: string) => s.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

const maybePrompt = async <T>(
  batch: boolean,
  value: T | undefined,
  promptFn: () => Promise<T>,
): Promise<T | undefined> => {
  if (batch || value !== undefined) return value;
  return promptFn();
};

const collectFiles = async (
  include: string[],
  extraIgnore: string[],
  recursive: boolean,
  sortBy: "name" | "path" | "mtime" | "none",
) => {
  const files = await glob(include, {
    ignore: [...DEFAULT_IGNORES, ...extraIgnore],
    absolute: true,
    onlyFiles: true,
    deep: recursive ? undefined : 1,
  });
  let filtered = [...new Set(files)].filter((f) => !isBinaryExt(f));
  if (sortBy === "name") {
    filtered.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  } else if (sortBy === "path") {
    filtered.sort();
  } else if (sortBy === "mtime") {
    filtered = await pMap(
      filtered,
      async (f) => ({ f, mtime: (await fs.stat(f)).mtimeMs }),
      { concurrency: 8 },
    ).then((arr) => arr.sort((a, b) => a.mtime - b.mtime).map((x) => x.f));
  }
  return filtered;
};

const writeResult = async (
  sections: string[],
  separator: string,
  toFile: string | undefined,
  toStdout: boolean,
  dryRun: boolean,
  backup: boolean,
) => {
  const content = `${sections.join(separator)}\n`;
  if (toStdout || !toFile) {
    process.stdout.write(content);
    return;
  }
  const dir = path.dirname(toFile);
  if (dir && dir !== ".") await fs.ensureDir(dir);
  if (backup && (await fs.pathExists(toFile))) {
    const backupPath = `${toFile}.${Date.now()}.bak`;
    await fs.copyFile(toFile, backupPath);
  }
  if (!dryRun) {
    await fs.writeFile(toFile, content, "utf8");
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
) => {
  const cwd = process.cwd();
  const fileNameCounts = new Map<string, Map<string, number>>();

  await pMap(
    files,
    async (file) => {
      const relPath = preserveStructure
        ? path.relative(cwd, file)
        : path.basename(file);

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
        await fs.copyFile(destPath, backupPath);
      }
      if (!dryRun) {
        await fs.copyFile(file, destPath);
      }
    },
    { concurrency },
  );
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
      description:
        "Recursively process all files in subdirectories (default: true)",
      default: true,
    },
    preserveStructure: {
      type: "boolean",
      description:
        "Preserve source directory structure in output (default: true)",
      default: true,
    },
    increment: {
      type: "boolean",
      description:
        "Attach an incrementing index to each output filename if set (default: false)",
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
    interactive: {
      type: "boolean",
      description: "Prompt for file selection before merging",
      default: false,
    },
  },
  async run({ args }) {
    const timer = createPerfTimer();
    const batch = Boolean(args.batch);

    let include = args.s ?? [];
    if (include.length === 0) {
      const raw = await maybePrompt(batch, undefined, () =>
        inputPrompt({
          title: "Input glob patterns (comma separated)",
          placeholder: "src/**/*.ts, !**/*.test.ts",
        }),
      );
      if (raw) include = parseCSV(raw as string);
    }
    if (include.length === 0)
      throw new Error("No input patterns supplied and prompts disabled");

    let ignore = args.ignore ?? [];
    if (ignore.length === 0) {
      const raw = await maybePrompt(batch, undefined, () =>
        inputPrompt({
          title: "Ignore patterns (comma separated, blank for none)",
          placeholder: "**/*.d.ts",
        }),
      );
      if (raw) ignore = parseCSV(raw as string);
    }

    let customComment = args.comment;
    if (customComment === undefined) {
      const want = await maybePrompt(batch, undefined, () =>
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
      ((await maybePrompt(batch, undefined, () =>
        inputPrompt({
          title:
            "Separator between files (\\n for newline, blank → blank line)",
          placeholder: DEFAULT_SEPARATOR_RAW,
        }),
      )) as string | undefined) ??
      DEFAULT_SEPARATOR_RAW;
    const separator = unescape(sepRaw);

    let stdoutFlag = args.stdout ?? false;
    let outFile = args.d;

    if (!stdoutFlag && !outFile && !batch) {
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
    const interactive = args.interactive ?? false;

    let files = await collectFiles(include, ignore, recursive, sortBy);

    if (files.length === 0) {
      throw new Error(
        "No text files matched given patterns (binary/media files are skipped)",
      );
    }

    if (interactive && !batch) {
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
      const ext = path.extname(filePath).slice(1).toLowerCase();
      return COMMENT_MAP[ext] ?? customComment ?? DEFAULT_COMMENT;
    };

    if (
      outFile &&
      (await fs.pathExists(outFile)) &&
      (await fs.stat(outFile)).isDirectory()
    ) {
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

    await writeResult(
      filteredSections,
      separator,
      outFile,
      stdoutFlag,
      dryRun,
      backup,
    );
    const elapsed = getElapsedPerfTime(timer);
    relinka("success", `Merge completed in ${prettyMilliseconds(elapsed)}`);
  },
});
