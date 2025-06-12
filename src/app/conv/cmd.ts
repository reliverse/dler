import * as path from "@reliverse/pathkit";
import { convertImportsAliasToRelative } from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import { promises as fs } from "node:fs";

interface TSConfig {
  compilerOptions?: {
    paths?: Record<string, string[]>;
  };
}

/**
 * Validates that the alias is properly configured in tsconfig.json
 * @throws Error if alias is not configured in tsconfig.json
 */
async function validateAliasConfig(alias: string): Promise<void> {
  try {
    const tsconfigPath = path.resolve("tsconfig.json");
    const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, "utf8")) as TSConfig;

    const paths = tsconfig?.compilerOptions?.paths;
    if (!paths) {
      throw new Error("tsconfig.json is missing compilerOptions.paths configuration");
    }

    const aliasPattern = `${alias}/*`;
    if (!paths[aliasPattern]) {
      throw new Error(
        `Alias "${alias}" is not configured in tsconfig.json. ` +
          `Add "${aliasPattern}": ["./src/*"] to compilerOptions.paths`,
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to validate alias configuration: ${error.message}`);
    }
    throw new Error("Failed to validate alias configuration: Unknown error");
  }
}

/**
 * Recursively inlines (or rewrites) aliased import / re-export statements for all libraries.
 *
 * @param alias     Prefix used in module specifiers (default: "~")
 * @param subFolders Ordered sub-folder candidates to look for when chasing other libs
 * @returns Absolute paths of files that were modified
 */
export async function resolveCrossLibs(
  alias = "~",
  subFolders: ("npm" | "jsr")[] = ["npm", "jsr"],
): Promise<string[]> {
  // Validate alias configuration first
  await validateAliasConfig(alias);

  const distLibsPath = path.resolve("dist-libs");
  const allModified: string[] = [];

  try {
    const libs = await fs.readdir(distLibsPath);

    for (const lib of libs) {
      for (const subFolder of subFolders) {
        const libBinDir = path.join("dist-libs", lib, subFolder, "bin");

        try {
          // Check if the directory exists
          await fs.access(libBinDir);

          // Process the library
          const modified = await resolveCrossLibsInternal(libBinDir, alias, subFolders);
          allModified.push(...modified);
        } catch {
          // Skip if directory doesn't exist
          relinka("internal", `[inline] skipping non-existent path: ${libBinDir}`);
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to process dist-libs directory: ${error}`);
  }

  return allModified;
}

/**
 * Recursively inlines (or rewrites) aliased import / re-export statements.
 *
 * @param libBinDir Folder that must start with "dist-libs/<lib>/<subFolder>/bin"
 * @param alias     Prefix used in module specifiers (default: "~")
 * @param subFolders Ordered sub-folder candidates to look for when chasing other libs
 * @returns Absolute paths of files that were modified
 */
async function resolveCrossLibsInternal(
  libBinDir: string,
  alias = "~",
  subFolders: ("npm" | "jsr")[] = ["npm", "jsr"],
): Promise<string[]> {
  relinka(
    "verbose",
    `[resolveCrossLibs] dir=${libBinDir}, alias=${alias}, subs=${subFolders.join("/")}`,
  );

  if (!libBinDir.startsWith("dist-libs")) {
    throw new Error(`libBinDir must start with "dist-libs": ${libBinDir}`);
  }

  const absBinDir = path.resolve(libBinDir);
  const [currentLib] = path.relative("dist-libs", libBinDir).split(path.sep);
  relinka("internal", `[inline] processing library: ${currentLib}`);

  // Convert self-imports to relative paths using pathkit
  await convertImportsAliasToRelative({
    targetDir: absBinDir,
    aliasToReplace: alias,
    pathExtFilter: "js-ts-none",
  });

  /** Recursively gather .ts / .js (skip .d.ts) */
  async function collect(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? collect(path.join(dir, e.name))
          : e.name.endsWith(".d.ts") || !(e.name.endsWith(".ts") || e.name.endsWith(".js"))
            ? []
            : [path.join(dir, e.name)],
      ),
    );
    return files.flat();
  }

  const allFiles = await collect(absBinDir);
  const modified: string[] = [];

  await Promise.all(
    allFiles.map(async (filePath) => {
      const original = await fs.readFile(filePath, "utf8");
      if (!original) {
        throw new Error(`Failed to read file: ${filePath}`);
      }
      if (!currentLib) throw new Error("Current library is undefined");
      const updated = await transformFile(original, filePath, currentLib, alias, subFolders);

      if (updated !== original) {
        await fs.writeFile(filePath, updated, "utf8");
        modified.push(filePath);
        relinka("verbose", `[inline]   ↳ modified ${path.relative(process.cwd(), filePath)}`);
      }
    }),
  );

  relinka("internal", `[inline] done – ${modified.length} file(s) changed`);
  return modified;
}

/** Per-file transformation – now multi-line aware & idempotent */
async function transformFile(
  source: string | undefined,
  _filePath: string,
  currentLib: string,
  alias: string,
  subFolders: ("npm" | "jsr")[],
): Promise<string> {
  if (!source) {
    throw new Error("Source content is undefined");
  }
  const ALIAS_RE = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /* dotAll ("s") lets `.` span newlines – crucial for pretty-formatted imports */
  const importRe = new RegExp(
    String.raw`^\s*` + // leading space
      String.raw`(` +
      String.raw`export\s+\{[\s\S]*?\}\s+from\s+` + // export {...} from
      "|" +
      String.raw`import\s+[\s\S]*?\s+from\s+` + // import ... from
      String.raw`)` +
      String.raw`(['"])` + //   opening quote (group 2)
      ALIAS_RE +
      String.raw`/libs/` +
      String.raw`([^/]+)` + //   libName   (group 3)
      String.raw`/` +
      String.raw`([^'"]+)` + //   rest path (group 4)
      String.raw`\2` + //   same quote
      String.raw`\s*;?` + //   optional semicolon
      String.raw`(?:\s*(?://.*|/\*[\s\S]*?\*/))?` + //   optional trailing comment
      String.raw`\s*$`,
    "s", // dotAll
  );

  /* We scan line-by-line, but if we see a "~ /libs/" token we keep appending
     lines until we bump into ";" – that's our full statement candidate. */
  const output: string[] = [];
  const lines = source.split(/\r?\n/);

  let inInlineBlock = false;
  let buffer: string[] = []; // collecting a multi-line statement

  const flushBuffer = async () => {
    if (buffer.length === 0) return;

    const stmt = buffer.join("\n");
    relinka("verbose", `  [scan] candidate:\n--------\n${stmt}\n--------`);

    if (!importRe.test(stmt) || inInlineBlock) {
      output.push(...buffer);
      buffer = [];
      return;
    }

    const match = importRe.exec(stmt);
    if (!match) {
      output.push(...buffer);
      buffer = [];
      return;
    }

    const [, _prefix, _quote, libName, restRaw] = match;
    if (!restRaw || !libName) {
      throw new Error(`Invalid import statement: ${stmt}`);
    }
    const indentMatch = stmt.match(/^\s*/);
    if (!indentMatch) {
      throw new Error(`Invalid statement format: ${stmt}`);
    }
    const indent = indentMatch[0];
    const rest = restRaw.replace(/^\/+/, ""); // trim leading "/"

    /* ─── self-import → already handled by convertImportsAliasToRelative ─── */
    if (libName === currentLib) {
      // Self-imports are now handled by convertImportsAliasToRelative
      // so we just output the original statement
      output.push(stmt);
      relinka("verbose", `  [skip]      ${libName} (self-import handled by pathkit)`);
      buffer = [];
      return;
    }

    /* ─── external library → inline file contents ─────────────────────── */
    const targetFile = await resolveTargetFile(libName, rest, subFolders);
    const embedded = await fs.readFile(targetFile, "utf8");
    relinka("verbose", `  [inline]    ${libName} ↦ ${targetFile}`);

    const inlinedBlock =
      `${indent}/* inlined-start ${alias}/libs/${libName}/${rest} */\n` +
      embedded
        .split(/\r?\n/)
        .map((l) => indent + l)
        .join("\n") +
      `\n${indent}/* inlined-end */`;

    output.push(inlinedBlock);
    buffer = [];
  };

  for (const line of lines) {
    /* Track existing inlined blocks for idempotency */
    if (line.includes("/* inlined-start")) inInlineBlock = true;
    if (line.includes("/* inlined-end")) inInlineBlock = false;

    /* If we're already collecting a statement, keep adding lines
       until we hit ";". */
    if (buffer.length) {
      buffer.push(line);
      if (line.trimEnd().endsWith(";")) await flushBuffer();
      continue;
    }

    /* New statement begins if the line contains the alias marker */
    if (line.includes(`${alias}/libs/`) && /(export|import)\s/.test(line)) {
      buffer.push(line);
      if (line.trimEnd().endsWith(";")) await flushBuffer();
      continue;
    }

    /* Ordinary line */
    output.push(line);
  }

  /* Left-over buffer without trailing ";" (rare but handle it) */
  await flushBuffer();

  return output.join("\n");
}

/** Resolve: dist-libs/<lib>/<sub>/bin/<rest>.ts  (pref)  or .js */
async function resolveTargetFile(
  lib: string,
  rest: string,
  subFolders: ("npm" | "jsr")[],
): Promise<string> {
  const cleaned = rest.replace(/^\/+/, "");
  for (const sub of subFolders) {
    const base = path.join("dist-libs", lib, sub, "bin", cleaned);
    const tsPath = `${base}.ts`;
    try {
      await fs.access(tsPath);
      return tsPath;
    } catch {
      /* empty */
    }
    const jsPath = `${base}.js`;
    try {
      await fs.access(jsPath);
      return jsPath;
    } catch {
      /* empty */
    }
  }
  throw new Error(`Cannot inline ~/libs/${lib}/${rest}: tried [${subFolders.join(", ")}]`);
}
