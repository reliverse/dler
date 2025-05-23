import path from "@reliverse/pathkit";
import { glob } from "@reliverse/reglob";
import fs from "@reliverse/relifso";
import { defineCommand, inputPrompt, confirmPrompt } from "@reliverse/rempts";

// ---------- constants ----------

// always-ignored directories
const DEFAULT_IGNORES = ["**/.git/**", "**/node_modules/**"] as const;

// binary / media extensions (stored in a Set for O(1) lookups)
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

// known comment prefixes per extension
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
const DEFAULT_SEPARATOR_RAW = "\\n\\n"; // two newlines (escaped form)

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

// prompt wrappers that honour batch mode
const maybePrompt = async <T>(
  batch: boolean,
  value: T | undefined,
  promptFn: () => Promise<T>,
): Promise<T | undefined> => {
  if (batch || value !== undefined) return value;
  return promptFn();
};

// collect and pre-filter files (dedup + binary skip early)
const collectFiles = async (include: string[], extraIgnore: string[]) => {
  const files = await glob(include, {
    ignore: [...DEFAULT_IGNORES, ...extraIgnore],
    absolute: true,
  });
  return [...new Set(files)].filter((f) => !isBinaryExt(f)).sort();
};

const readSections = async (
  files: string[],
  injectPath: boolean,
  getPrefix: (f: string) => string,
) => {
  const cwd = process.cwd();
  const reads = files.map(async (f) => {
    const raw = (await fs.readFile(f, "utf8")) as string;
    if (!injectPath) return raw;
    const rel = path.relative(cwd, f);
    return `${ensureTrailingNL(raw)}${getPrefix(f)}${rel}`;
  });
  return Promise.all(reads);
};

const writeResult = async (
  sections: string[],
  separator: string,
  toFile: string | undefined,
  toStdout: boolean,
) => {
  const content = `${sections.join(separator)}\n`;
  if (toStdout || !toFile) {
    process.stdout.write(content);
    return;
  }
  const dir = path.dirname(toFile);
  if (dir && dir !== ".") await fs.ensureDir(dir);
  await fs.writeFile(toFile, content, "utf8");
};

// ---------- command ----------

export default defineCommand({
  meta: {
    name: "remege",
    version: "1.0.0",
    description:
      "Merge text files with optional commented path footer, skips binaries/media, built for CI & interactive use.",
  },
  args: {
    in: { type: "array", description: "Input glob patterns" },
    ignore: { type: "array", description: "Extra ignore patterns" },
    out: { type: "string", description: "Output file path" },
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
  },
  async run({ args }) {
    const batch = Boolean(args.batch);

    // ----- include patterns -----
    let include = args.in ?? [];
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

    // ----- ignore patterns -----
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

    // ----- comment settings -----
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

    // ----- path footer toggle -----
    const injectPath = !args.noPath;

    // ----- separator -----
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

    // ----- output location / stdout -----
    let stdoutFlag = args.stdout ?? false;
    let outFile = args.out;

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

    // ----- gather files -----
    const files = await collectFiles(include, ignore);
    if (files.length === 0) {
      throw new Error(
        "No text files matched given patterns (binary/media files are skipped)",
      );
    }

    // ----- comment prefix resolver -----
    const getPrefix = (filePath: string): string => {
      if (forceComment && customComment) return customComment;
      const ext = path.extname(filePath).slice(1).toLowerCase();
      return COMMENT_MAP[ext] ?? customComment ?? DEFAULT_COMMENT;
    };

    // ----- read, merge, write -----
    const sections = await readSections(files, injectPath, getPrefix);
    await writeResult(sections, separator, outFile, stdoutFlag);
  },
});
