import type { TSConfig } from "pkg-types";

import { resolve, extname, join, basename, dirname } from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import defu from "defu";
import fsp from "node:fs/promises";
import { glob } from "tinyglobby";

import type { InputFile, MkdistOptions, OutputFile } from "~/libs/sdk/sdk-impl/sdk-types";

import type { DeclarationOutput } from "./utils/dts";

import { createLoader } from "./loader";
import { getDeclarations, normalizeCompilerOptions } from "./utils/dts";
import { copyFileWithStream } from "./utils/fs";
import { getVueDeclarations } from "./utils/vue-dts";

export async function mkdist(options: MkdistOptions /* istanbul ignore next */ = {}) {
  const startTime = Date.now();

  // Resolve srcDir and distDir relative to rootDir
  options.rootDir = resolve(process.cwd(), options.rootDir || ".");
  options.srcDir = resolve(options.rootDir, options.srcDir || "src");
  options.distDir = resolve(options.rootDir, options.distDir || "dist");

  // Setup dist
  if (options.cleanDist !== false) {
    relinka("info", "Cleaning distribution directory...");
    await fsp.unlink(options.distDir).catch(() => {});
    await fsp.rm(options.distDir, { recursive: true, force: true });
    await fsp.mkdir(options.distDir, { recursive: true });
  }

  // Scan input files
  relinka("info", "Scanning input files...");
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

  relinka("info", `Found ${files.length} files to process`);

  // Read and normalise TypeScript compiler options for emitting declarations
  options.typescript ||= {};
  if (options.typescript.compilerOptions) {
    relinka("info", "Normalizing TypeScript compiler options...");
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
  relinka("info", "Creating file loaders...");
  const { loadFile } = createLoader(options);

  // Use loaders to get output files
  relinka("info", "Processing files with loaders...");
  const outputs: OutputFile[] = [];
  let processedCount = 0;

  // Process files
  await Promise.all(
    files.map(async (file) => {
      const result = await loadFile(file);
      if (result) {
        outputs.push(...result);
      }
      processedCount++;

      // Update progress every file or every 10% of files, whichever is more frequent
      // const shouldUpdate =
      //   processedCount % Math.max(1, Math.floor(files.length / 10)) === 0 ||
      //   processedCount === files.length;
      // if (shouldUpdate) {
      //   relinka("verbose", `Processing files: ${file.path} (${processedCount}/${files.length})`);
      // }
    }),
  );

  // Normalize output extensions
  relinka("info", "Normalizing output extensions...");
  const pathConflicts: string[] = [];

  for (const output of outputs.filter((o) => o.extension)) {
    const renamed = basename(output.path, extname(output.path)) + output.extension;
    output.path = join(dirname(output.path), renamed);

    // Check for output path conflicts
    const conflictingOutput = outputs.find((o) => o !== output && o.path === output.path);
    if (conflictingOutput) {
      pathConflicts.push(output.path);
    }
  }

  // Handle path conflicts according to memory
  if (pathConflicts.length > 0) {
    const errorMessage = `Output path conflict detected for paths: ${pathConflicts.join(", ")}. Multiple files would write to the same output path.`;
    relinka("error", errorMessage);
    throw new Error(errorMessage);
  }

  // Generate declarations
  const dtsOutputs = outputs.filter((o) => o.declaration && !o.skip);
  if (dtsOutputs.length > 0) {
    relinka("info", `Generating TypeScript declarations for ${dtsOutputs.length} files...`);
    const vfs = new Map(dtsOutputs.map((o) => [o.srcPath, o.contents || ""]));
    const declarations: DeclarationOutput = Object.create(null);

    for (const loader of [getVueDeclarations, getDeclarations]) {
      // @ts-expect-error TODO: fix ts
      Object.assign(declarations, await loader(vfs, options));
    }

    let dtsProcessed = 0;
    for (const output of dtsOutputs) {
      // @ts-expect-error TODO: fix ts
      const result = declarations[output.srcPath];
      output.contents = result?.contents || "";
      if (result.errors) {
        output.errors = result.errors;
      }

      dtsProcessed++;
      // if (dtsProcessed % Math.max(1, Math.floor(dtsOutputs.length / 5)) === 0) {
      //   relinka("verbose", `Generated declarations for ${dtsProcessed}/${dtsOutputs.length} files`);
      // }
    }
  }

  // Resolve relative imports
  relinka("info", "Resolving relative imports...");
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
  const esmOutputs = outputs.filter((o) => o.extension === ".mjs" || o.extension === ".js");

  for (const output of esmOutputs) {
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
  const cjsOutputs = outputs.filter((o) => o.extension === ".cjs");

  for (const output of cjsOutputs) {
    // Resolve require statements
    // @ts-expect-error TODO: fix ts
    output.contents = output.contents.replace(
      /require\((["'])(.*)(["'])\)/g,
      (_, head, id, tail) =>
        "require(" + head + resolveId(output.path, id, cjsResolveExtensions) + tail + ")",
    );
  }

  // Write outputs
  const outputsToWrite = outputs.filter((o) => !o.skip);
  relinka("info", `Writing ${outputsToWrite.length} output files...`);

  const writtenFiles: string[] = [];
  const errors: { filename: string; errors: TypeError[] }[] = [];
  let writtenCount = 0;

  // Write files with progress tracking
  await Promise.all(
    outputsToWrite.map(async (output) => {
      try {
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
      } catch (error) {
        const errorMessage = `Failed to write file ${output.path}: ${error instanceof Error ? error.message : "Unknown error"}`;
        errors.push({
          filename: output.path,
          errors: [new TypeError(errorMessage)],
        });
      }

      writtenCount++;

      // Update progress every 10 files or every 10% of files, whichever is more frequent
      // const progressUpdateInterval = Math.max(10, Math.floor(outputsToWrite.length / 10));
      // if (writtenCount % progressUpdateInterval === 0 || writtenCount === outputsToWrite.length) {
      //   relinka("verbose", `Written ${writtenCount}/${outputsToWrite.length} files`);
      // }
    }),
  );

  const duration = Date.now() - startTime;

  // Final status
  if (errors.length > 0) {
    relinka("warn", `Build completed with ${errors.length} errors`);
    // Log error details for debugging
    for (const error of errors.slice(0, 5)) {
      // Show first 5 errors
      relinka(
        "error",
        `Error in ${error.filename}: ${error.errors[0]?.message || "Unknown error"}`,
      );
    }
    if (errors.length > 5) {
      relinka("error", `... and ${errors.length - 5} more errors`);
    }
  } else {
    relinka("success", "Build completed successfully!");
  }

  return {
    result: {
      errors,
      writtenFiles,
    },
    duration,
  };
}
