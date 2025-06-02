import type { TSConfig } from "pkg-types";

import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import defu from "defu";
import { resolve, extname, join, basename, dirname } from "pathe";
import { glob, type GlobOptions } from "tinyglobby";

import type { InputFile, LoaderOptions, OutputFile, Loader } from "./loader";
import type { LoaderName } from "./loaders/loaders-mod";
import type { DeclarationOutput } from "./utils/dts";

import { createLoader } from "./loader";
import { getDeclarations, normalizeCompilerOptions } from "./utils/dts";
import { copyFileWithStream } from "./utils/fs";
import { getVueDeclarations } from "./utils/vue-dts";

const STOP_AFTER_STEP = 0; // 0 runs all steps, specific step number stops right after that step

function shouldStopAtStep(stepNumber: number): void {
  if (STOP_AFTER_STEP > 0 && stepNumber >= STOP_AFTER_STEP) {
    relinka("success", `Stopping build at step ${stepNumber}`);
    process.exit(0);
  }
}

export type MkdistOptions = {
  rootDir?: string;
  srcDir?: string;
  pattern?: string | string[];
  globOptions?: GlobOptions;
  distDir?: string;
  cleanDist?: boolean;
  loaders?: (LoaderName | Loader)[];
  addRelativeDeclarationExtensions?: boolean;
  exclude?: string[];
  typescript?: {
    compilerOptions?: TSConfig["compilerOptions"];
  };
} & LoaderOptions;

export async function mkdist(options: MkdistOptions /* istanbul ignore next */ = {}) {
  relinka("info", "Step 1: Starting mkdist implementation");
  shouldStopAtStep(1);
  relinka("verbose", "Resolving source and destination directories");

  // Step 2: Resolve directories
  shouldStopAtStep(2);
  options.rootDir = resolve(process.cwd(), options.rootDir || ".");
  options.srcDir = resolve(options.rootDir, options.srcDir || "src");
  options.distDir = resolve(options.rootDir, options.distDir || "dist");
  relinka("verbose", `Source directory: ${options.srcDir}`);
  relinka("verbose", `Destination directory: ${options.distDir}`);

  // Step 3: Setup distribution directory
  shouldStopAtStep(3);
  if (options.cleanDist !== false) {
    relinka("verbose", "Cleaning distribution directory");
    await fs.unlink(options.distDir).catch(() => {});
    await fs.rm(options.distDir, { recursive: true, force: true });
    await fs.mkdir(options.distDir, { recursive: true });
  }

  // Step 4: Scan input files
  shouldStopAtStep(4);
  relinka("verbose", "Scanning input files");
  const filePaths = await glob(options.pattern || "**", {
    absolute: false,
    ignore: ["**/node_modules", "**/coverage", "**/.git", ...(options.exclude || [])],
    cwd: options.srcDir,
    dot: true,
    ...options.globOptions,
  });
  relinka("verbose", `Found ${filePaths.length} files to process`);

  // Step 5: Prepare input files
  shouldStopAtStep(5);
  const files: InputFile[] = filePaths.map((path) => {
    if (!options.srcDir) {
      throw new Error("srcDir is required");
    }
    const sourcePath = resolve(options.srcDir, path);
    return {
      path,
      srcPath: sourcePath,
      extension: extname(path),
      getContents: () => fs.readFile(sourcePath, { encoding: "utf8" }),
    };
  });

  // Step 6: Configure TypeScript options
  shouldStopAtStep(6);
  relinka("verbose", "Configuring TypeScript options");
  options.typescript ||= {};
  if (options.typescript.compilerOptions) {
    options.typescript.compilerOptions = await normalizeCompilerOptions(
      options.typescript.compilerOptions,
    );
  }

  const baseOptions = {
    allowJs: true,
    declaration: true,
    skipLibCheck: true,
    strictNullChecks: true,
    emitDeclarationOnly: false,
    allowImportingTsExtensions: true,
    outDir: options.distDir,
    rootDir: options.srcDir,
    module: "ESNext",
    target: "ESNext",
    moduleResolution: "node",
    esModuleInterop: true,
    resolveJsonModule: true,
    isolatedModules: true,
    noEmit: false,
  } satisfies TSConfig["compilerOptions"];

  options.typescript.compilerOptions = defu(
    { noEmit: false } satisfies TSConfig["compilerOptions"],
    options.typescript.compilerOptions,
    baseOptions,
  );

  relinka("info", "TypeScript compiler options configured:");
  relinka("verbose", JSON.stringify(options.typescript.compilerOptions, null, 2));

  // Step 7: Create and use loader
  shouldStopAtStep(7);
  relinka("verbose", "Creating file loader");
  const { loadFile } = createLoader(options);

  // Log input files before processing
  // relinka("info", "=== Input Files to be Processed ===");
  // for (const file of files) {
  //   relinka("info", `File: ${file.path}`);
  //   relinka("verbose", `  - Full path: ${file.srcPath}`);
  //   relinka("verbose", `  - Extension: ${file.extension}`);
  // }
  // relinka("info", `=== Total files to process: ${files.length} ===`);

  // Step 8: Process files
  shouldStopAtStep(8);
  relinka("verbose", "Processing files with loaders");
  const outputs: OutputFile[] = [];
  for (const file of files) {
    outputs.push(...((await loadFile(file)) || []));
  }
  relinka("verbose", `Generated ${outputs.length} output files`);

  // Step 9: Normalize output extensions
  shouldStopAtStep(9);
  relinka("verbose", "Normalizing output file extensions");
  for (const output of outputs.filter((o) => o.extension)) {
    const renamed = basename(output.path, extname(output.path)) + output.extension;
    output.path = join(dirname(output.path), renamed);
    // Throw error if there's a conflict with the same extension
    const conflictingOutput = outputs.find(
      (o) => o !== output && o.path === output.path && o.extension === output.extension,
    );
    if (conflictingOutput) {
      throw new Error(
        "Output path conflict detected:\n" +
          "- File 1: " +
          output.srcPath +
          " -> " +
          output.path +
          "\n" +
          "- File 2: " +
          conflictingOutput.srcPath +
          " -> " +
          conflictingOutput.path +
          "\n" +
          "Both files would be written to the same path: " +
          output.path,
      );
    }
  }

  // Step 10: Generate declarations and JavaScript files
  shouldStopAtStep(10);
  relinka("verbose", "Generating TypeScript declarations and JavaScript files");
  const dtsOutputs = outputs.filter((o) => o.declaration && !o.skip);
  if (dtsOutputs.length > 0) {
    relinka(
      "verbose",
      `Processing ${dtsOutputs.length} files for declarations and JavaScript output`,
    );
    const vfs = new Map(dtsOutputs.map((o) => [o.srcPath || "", o.contents || ""]));
    const declarations: DeclarationOutput = Object.create(null);
    for (const loader of [getVueDeclarations, getDeclarations]) {
      Object.assign(declarations, await loader(vfs, options));
    }
    for (const output of dtsOutputs) {
      if (!output.srcPath) continue;
      const result = declarations[output.srcPath];
      output.contents = result?.contents || "";
      if (result?.errors) {
        output.errors = result.errors;
        relinka("warn", `Errors found in file ${output.srcPath}: ${result.errors.join(", ")}`);
      } else {
        // relinka("verbose", `Successfully processed ${output.srcPath}`);
      }
    }
  }

  // Step 11: Resolve relative imports
  shouldStopAtStep(11);
  relinka("verbose", "Resolving relative imports");
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

  // Step 12: Process ESM imports
  shouldStopAtStep(12);
  relinka("verbose", "Processing ESM imports");
  const esmResolveExtensions = ["", "/index.mjs", "/index.js", ".mjs", ".ts", ".js"];
  for (const output of outputs.filter((o) => o.extension === ".mjs" || o.extension === ".js")) {
    if (!output.contents) continue;
    output.contents = output.contents
      .replace(
        /(import|export)(\s+(?:.+|{[\s\w,]+})\s+from\s+["'])(.*)(["'])/g,
        (_, type, head, id, tail) =>
          type + head + resolveId(output.path, id, esmResolveExtensions) + tail,
      )
      .replace(
        /import\((["'])(.*)(["'])\)/g,
        (_, head, id, tail) =>
          "import(" + head + resolveId(output.path, id, esmResolveExtensions) + tail + ")",
      );
  }

  // Step 13: Process CommonJS imports
  shouldStopAtStep(13);
  relinka("verbose", "Processing CommonJS imports");
  const cjsResolveExtensions = ["", "/index.cjs", ".cjs"];
  for (const output of outputs.filter((o) => o.extension === ".cjs")) {
    if (!output.contents) continue;
    output.contents = output.contents.replace(
      /require\((["'])(.*)(["'])\)/g,
      (_, head, id, tail) =>
        "require(" + head + resolveId(output.path, id, cjsResolveExtensions) + tail + ")",
    );
  }

  // Step 14: Write outputs
  shouldStopAtStep(14);
  relinka("verbose", "Writing output files");
  const writtenFiles: string[] = [];
  const errors: { filename: string; errors: TypeError[] }[] = [];
  await Promise.all(
    outputs
      .filter((o) => !o.skip)
      .map(async (output) => {
        if (!options.distDir || !output.path || !output.srcPath) return;
        const outFile = join(options.distDir, output.path);
        await fs.mkdir(dirname(outFile), { recursive: true });
        await (output.raw
          ? copyFileWithStream(output.srcPath, outFile)
          : fs.writeFile(outFile, output.contents || "", "utf8"));
        writtenFiles.push(outFile);

        if (output.errors) {
          errors.push({ filename: outFile, errors: output.errors });
        }
      }),
  );
  relinka("verbose", `Written ${writtenFiles.length} files`);
  if (errors.length > 0) {
    relinka("warn", `Found ${errors.length} errors during file writing`);
  }

  relinka("info", "Step 14: mkdist implementation completed");
  return {
    errors,
    writtenFiles,
  };
}
