import fsp from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";

import { logger } from "@reliverse/dler-logger";
import defu from "defu";
import type { TSConfig } from "pkg-types";
import { glob } from "tinyglobby";

import type { InputFile, MkdistOptions, OutputFile } from "../../types";
import { createLoader } from "./loader";
import type { DeclarationOutput } from "./utils/dts";
import { getDeclarations, normalizeCompilerOptions } from "./utils/dts";
import { copyFileWithStream } from "./utils/fs";

export async function mkdist(options: MkdistOptions) {
  const startTime = Date.now();

  // Resolve srcDir and distDir relative to rootDir
  options.rootDir = resolve(process.cwd(), options.rootDir || ".");
  options.srcDir = resolve(options.rootDir, options.srcDir || "src");
  options.distDir = resolve(options.rootDir, options.distDir || "dist");

  // Setup dist
  if (options.cleanDist !== false) {
    if (options.verbose) {
      logger.debug("Cleaning distribution directory...");
    }
    await fsp.unlink(options.distDir).catch(() => {});
    await fsp.rm(options.distDir, { recursive: true, force: true });
    await fsp.mkdir(options.distDir, { recursive: true });
  }

  // Scan input files
  if (options.verbose) {
    logger.debug("Scanning input files...");
  }
  const filePaths = await glob(options.pattern || "**", {
    absolute: false,
    ignore: ["**/node_modules", "**/coverage", "**/.git"],
    cwd: options.srcDir,
    dot: true,
    ...options.globOptions,
  });

  const files: InputFile[] = filePaths.map((path) => {
    const sourcePath = resolve(options.srcDir, path);
    return {
      path,
      srcPath: sourcePath,
      extension: extname(path),
      getContents: () => fsp.readFile(sourcePath, { encoding: "utf8" }),
    };
  });

  if (options.verbose) {
    logger.debug(`Found ${files.length} files to process`);
  }

  // Read and normalise TypeScript compiler options for emitting declarations
  options.typescript ||= {};
  if (options.typescript.compilerOptions) {
    if (options.verbose) {
      logger.debug("Normalizing TypeScript compiler options...");
    }
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
  if (options.verbose) {
    logger.debug("Creating file loaders...");
  }
  const { loadFile } = createLoader(options);

  // Use loaders to get output files
  if (options.verbose) {
    logger.debug("Processing files with loaders...");
  }
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
    }),
  );

  // Normalize output extensions
  if (options.verbose) {
    logger.debug("Normalizing output extensions...");
  }
  const pathConflicts: string[] = [];

  for (const output of outputs.filter((o) => o.extension)) {
    const renamed =
      basename(output.path, extname(output.path)) + output.extension;
    output.path = join(dirname(output.path), renamed);

    // Check for output path conflicts
    const conflictingOutput = outputs.find(
      (o) => o !== output && o.path === output.path,
    );
    if (conflictingOutput) {
      pathConflicts.push(output.path);
    }
  }

  // Handle path conflicts according to memory
  if (pathConflicts.length > 0) {
    const errorMessage = `Output path conflict detected for paths: ${pathConflicts.join(", ")}. Multiple files would write to the same output path.`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Generate declarations
  const dtsOutputs = outputs.filter((o) => o.declaration && !o.skip);
  if (dtsOutputs.length > 0) {
    if (options.verbose) {
      logger.debug(
        `Generating TypeScript declarations for ${dtsOutputs.length} files...`,
      );
    }

    // Initialize VFS with original TypeScript source files, not transformed JS
    const vfs = new Map<string, string>();
    for (const output of dtsOutputs) {
      // Read the original source file content from the filesystem
      const originalContent = await fsp.readFile(output.srcPath, {
        encoding: "utf8",
      });
      // Normalize path separators - TypeScript will use forward slashes on Windows
      const normalizedPath = output.srcPath.replace(/\\/g, "/");
      vfs.set(normalizedPath, originalContent);
    }

    const declarations: DeclarationOutput = Object.create(null);

    const getDeclarationsResult = await getDeclarations(vfs, options);
    Object.assign(declarations, getDeclarationsResult);

    let dtsProcessed = 0;
    for (const output of dtsOutputs) {
      // Look up using normalized path (forward slashes)
      const normalizedPath = output.srcPath.replace(/\\/g, "/");
      const result = declarations[normalizedPath];
      output.contents = result?.contents || "";
      if (result?.errors) {
        output.errors = result.errors;
      }

      dtsProcessed++;
    }
  }

  // Resolve relative imports
  if (options.verbose) {
    logger.debug("Resolving relative imports...");
  }
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

  const esmResolveExtensions = [
    "",
    "/index.mjs",
    "/index.js",
    ".mjs",
    ".ts",
    ".js",
  ];
  const esmOutputs = outputs.filter(
    (o) => o.extension === ".mjs" || o.extension === ".js",
  );

  for (const output of esmOutputs) {
    // Resolve import statements
    if (output.contents) {
      output.contents = output.contents
        .replace(
          /(import|export)(\s+(?:.+|{[\s\w,]+})\s+from\s+["'])(.*)(["'])/g,
          (_, type, head, id, tail) =>
            type +
            head +
            resolveId(output.path, id, esmResolveExtensions) +
            tail,
        )
        // Resolve dynamic import
        .replace(
          /import\((["'])(.*)(["'])\)/g,
          (_, head, id, tail) =>
            "import(" +
            head +
            resolveId(output.path, id, esmResolveExtensions) +
            tail +
            ")",
        );
    }
  }

  const cjsResolveExtensions = ["", "/index.cjs", ".cjs"];
  const cjsOutputs = outputs.filter((o) => o.extension === ".cjs");

  for (const output of cjsOutputs) {
    // Resolve require statements
    if (output.contents) {
      output.contents = output.contents.replace(
        /require\((["'])(.*)(["'])\)/g,
        (_, head, id, tail) =>
          "require(" +
          head +
          resolveId(output.path, id, cjsResolveExtensions) +
          tail +
          ")",
      );
    }
  }

  // Write outputs
  const outputsToWrite = outputs.filter((o) => !o.skip);
  if (options.verbose) {
    logger.debug(`Writing ${outputsToWrite.length} output files...`);
  }

  const writtenFiles: string[] = [];
  const errors: { filename: string; errors: TypeError[] }[] = [];
  let writtenCount = 0;

  // Write files with progress tracking
  await Promise.all(
    outputsToWrite.map(async (output) => {
      try {
        const outFile = join(options.distDir, output.path);
        await fsp.mkdir(dirname(outFile), { recursive: true });
        await (output.raw
          ? copyFileWithStream(output.srcPath, outFile)
          : fsp.writeFile(outFile, output.contents || "", "utf8"));
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
    }),
  );

  const duration = Date.now() - startTime;

  // Final status
  if (errors.length > 0) {
    logger.warn(`Build completed with ${errors.length} errors`);
    // Log error details for debugging
    for (const error of errors.slice(0, 5)) {
      // Show first 5 errors
      logger.error(
        `Error in ${error.filename}: ${error.errors[0]?.message || "Unknown error"}`,
      );
    }
    if (errors.length > 5) {
      logger.error(`... and ${errors.length - 5} more errors`);
    }
  } else {
    if (options.verbose) {
      logger.debug("Build completed successfully!");
    }
  }

  return {
    result: {
      errors,
      writtenFiles,
    },
    duration,
  };
}
