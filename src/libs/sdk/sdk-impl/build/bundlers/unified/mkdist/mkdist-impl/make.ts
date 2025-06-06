import type { TSConfig } from "pkg-types";

import { resolve, extname, join, basename, dirname } from "@reliverse/pathkit";
import defu from "defu";
import fsp from "node:fs/promises";
import { glob } from "tinyglobby";

import type { InputFile, MkdistOptions, OutputFile } from "~/libs/sdk/sdk-types";

import type { DeclarationOutput } from "./utils/dts";

import { createLoader } from "./loader";
import { getDeclarations, normalizeCompilerOptions } from "./utils/dts";
import { copyFileWithStream } from "./utils/fs";
import { getVueDeclarations } from "./utils/vue-dts";

export async function mkdist(options: MkdistOptions /* istanbul ignore next */ = {}) {
  // Resolve srcDir and distDir relative to rootDir
  options.rootDir = resolve(process.cwd(), options.rootDir || ".");
  options.srcDir = resolve(options.rootDir, options.srcDir || "src");
  options.distDir = resolve(options.rootDir, options.distDir || "dist");

  // Setup dist
  if (options.cleanDist !== false) {
    await fsp.unlink(options.distDir).catch(() => {});
    await fsp.rm(options.distDir, { recursive: true, force: true });
    await fsp.mkdir(options.distDir, { recursive: true });
  }

  // Scan input files
  const filePaths = await glob(options.pattern || "**", {
    absolute: false,
    ignore: ["**/node_modules", "**/coverage", "**/.git"],
    cwd: options.srcDir,
    dot: true,
    ...options.globOptions,
  });

  const files: InputFile[] = filePaths.map((path) => {
    // @ts-expect-error TODO: fix ts
    const sourcePath = resolve(options.srcDir, path);
    return {
      path,
      srcPath: sourcePath,
      extension: extname(path),
      getContents: () => fsp.readFile(sourcePath, { encoding: "utf8" }),
    };
  });

  // Read and normalise TypeScript compiler options for emitting declarations
  options.typescript ||= {};
  if (options.typescript.compilerOptions) {
    options.typescript.compilerOptions = await normalizeCompilerOptions(
      options.typescript.compilerOptions,
    );
  }
  options.typescript.compilerOptions = defu(
    { noEmit: false } satisfies TSConfig["compilerOptions"],
    options.typescript.compilerOptions,
    {
      allowJs: true,
      declaration: true,
      skipLibCheck: true,
      strictNullChecks: true,
      emitDeclarationOnly: true,
      allowImportingTsExtensions: true,
      allowNonTsExtensions: true,
    } satisfies TSConfig["compilerOptions"],
  );

  // Create loader
  const { loadFile } = createLoader(options);

  // Use loaders to get output files
  const outputs: OutputFile[] = [];
  for (const file of files) {
    outputs.push(...((await loadFile(file)) || []));
  }

  // Normalize output extensions
  for (const output of outputs.filter((o) => o.extension)) {
    const renamed = basename(output.path, extname(output.path)) + output.extension;
    output.path = join(dirname(output.path), renamed);
    // Avoid overriding files with original extension
    if (outputs.some((o) => o !== output && o.path === output.path)) {
      output.skip = true;
    }
  }

  // Generate declarations
  const dtsOutputs = outputs.filter((o) => o.declaration && !o.skip);
  if (dtsOutputs.length > 0) {
    const vfs = new Map(dtsOutputs.map((o) => [o.srcPath, o.contents || ""]));
    const declarations: DeclarationOutput = Object.create(null);
    for (const loader of [getVueDeclarations, getDeclarations]) {
      // @ts-expect-error TODO: fix ts
      Object.assign(declarations, await loader(vfs, options));
    }
    for (const output of dtsOutputs) {
      // @ts-expect-error TODO: fix ts
      const result = declarations[output.srcPath];
      output.contents = result?.contents || "";
      if (result.errors) {
        output.errors = result.errors;
      }
    }
  }

  // Resolve relative imports
  const outPaths = new Set(outputs.map((o) => o.path));
  const resolveId = (from: string, id = "", resolveExtensions: string[]) => {
    if (!id.startsWith(".")) {
      return id;
    }
    for (const extension of resolveExtensions) {
      if (outPaths.has(join(dirname(from), id + extension))) {
        return id + extension;
      }
    }
    return id;
  };
  const esmResolveExtensions = ["", "/index.mjs", "/index.js", ".mjs", ".ts", ".js"];
  for (const output of outputs.filter((o) => o.extension === ".mjs" || o.extension === ".js")) {
    // Resolve import statements
    // @ts-expect-error TODO: fix ts
    output.contents = output.contents
      .replace(
        /(import|export)(\s+(?:.+|{[\s\w,]+})\s+from\s+["'])(.*)(["'])/g,
        (_, type, head, id, tail) =>
          type + head + resolveId(output.path, id, esmResolveExtensions) + tail,
      )
      // Resolve dynamic import
      .replace(
        /import\((["'])(.*)(["'])\)/g,
        (_, head, id, tail) =>
          "import(" + head + resolveId(output.path, id, esmResolveExtensions) + tail + ")",
      );
  }
  const cjsResolveExtensions = ["", "/index.cjs", ".cjs"];
  for (const output of outputs.filter((o) => o.extension === ".cjs")) {
    // Resolve require statements
    // @ts-expect-error TODO: fix ts
    output.contents = output.contents.replace(
      /require\((["'])(.*)(["'])\)/g,
      (_, head, id, tail) =>
        "require(" + head + resolveId(output.path, id, cjsResolveExtensions) + tail + ")",
    );
  }

  // Write outputs
  const writtenFiles: string[] = [];
  const errors: { filename: string; errors: TypeError[] }[] = [];
  await Promise.all(
    outputs
      .filter((o) => !o.skip)
      .map(async (output) => {
        // @ts-expect-error TODO: fix ts
        const outFile = join(options.distDir, output.path);
        await fsp.mkdir(dirname(outFile), { recursive: true });
        await (output.raw
          ? // @ts-expect-error TODO: fix ts
            copyFileWithStream(output.srcPath, outFile)
          : // @ts-expect-error TODO: fix ts
            fsp.writeFile(outFile, output.contents, "utf8"));
        writtenFiles.push(outFile);

        if (output.errors) {
          errors.push({ filename: outFile, errors: output.errors });
        }
      }),
  );

  return {
    errors,
    writtenFiles,
  };
}
