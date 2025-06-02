import type { TSConfig } from "pkg-types";
import type { CompilerHost, EmitResult, FormatDiagnosticsHost } from "typescript";

import { relinka } from "@reliverse/relinka";
import { findStaticImports, findDynamicImports, findExports, findTypeExports } from "mlly";
import { statSync } from "node:fs";
import { resolve } from "pathe";

import type { MkdistOptions } from "~/libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl/make";

// Step 1: Normalize TypeScript compiler options
export async function normalizeCompilerOptions(_options: TSConfig["compilerOptions"]) {
  relinka("info", "Step 1: Normalizing TypeScript compiler options");
  const ts = await import("typescript").then((r) => r.default || r);
  return ts.convertCompilerOptionsFromJson(_options, process.cwd()).options;
}

export type DeclarationOutput = Record<string, { contents: string; errors?: Error[] }>;

// Step 2: Generate TypeScript declarations
export async function getDeclarations(
  vfs: Map<string, string>,
  opts?: MkdistOptions,
): Promise<DeclarationOutput> {
  relinka("info", "Step 2: Generating TypeScript declarations");

  if (!opts?.typescript?.compilerOptions) {
    throw new Error("TypeScript compiler options are required");
  }
  const ts = await import("typescript").then((r) => r.default || r);

  const inputFiles = [...vfs.keys()];
  relinka("verbose", `Processing ${inputFiles.length} files for declarations`);

  // Step 3: Create TypeScript compiler host
  relinka("verbose", "Creating TypeScript compiler host");

  // Parse compiler options properly
  const formatHost: FormatDiagnosticsHost = {
    getCanonicalFileName: (fileName: string) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => ts.sys.newLine,
  };

  // Create a virtual tsconfig.json content
  const configContent = JSON.stringify({
    compilerOptions: opts.typescript.compilerOptions,
    include: inputFiles,
  });

  const configFile = ts.parseJsonText("tsconfig.json", configContent);
  const parsedOptions = ts.parseJsonSourceFileConfigFileContent(
    configFile,
    ts.sys,
    process.cwd(),
    undefined,
    "tsconfig.json",
  );

  if (parsedOptions.errors?.length) {
    const errors = ts.formatDiagnostics(parsedOptions.errors, formatHost);
    relinka("error", `TypeScript config errors:\n${errors}`);
    throw new Error(`Failed to parse TypeScript compiler options: ${errors}`);
  }

  const tsHost = ts.createCompilerHost(parsedOptions.options);

  tsHost.writeFile = (fileName: string, declaration: string) => {
    vfs.set(fileName, declaration);
  };
  const _readFile = tsHost.readFile;
  tsHost.readFile = (filename) => {
    if (vfs.has(filename)) {
      return vfs.get(filename);
    }
    return _readFile(filename);
  };

  // Step 4: Create and run TypeScript program
  relinka("verbose", "Creating TypeScript program");
  const program = ts.createProgram(inputFiles, parsedOptions.options, tsHost);
  const result = program.emit();

  // Step 5: Extract declarations
  relinka("verbose", "Extracting declarations");
  const output = extractDeclarations(vfs, inputFiles, opts);

  // Step 6: Add diagnostics
  relinka("verbose", "Adding diagnostics");
  augmentWithDiagnostics(result, output, tsHost, ts);

  relinka("info", "Step 6: TypeScript declarations generated");
  return output;
}

const JS_EXT_RE = /\.(m|c)?(ts|js)$/;
const JSX_EXT_RE = /\.(m|c)?(ts|js)x?$/;
const RELATIVE_RE = /^\.{1,2}[/\\]/;

// Step 7: Extract declarations from virtual file system
export function extractDeclarations(
  vfs: Map<string, string>,
  inputFiles: string[],
  opts?: MkdistOptions,
): DeclarationOutput {
  relinka("info", "Step 7: Extracting declarations from virtual file system");
  const output: DeclarationOutput = {};

  for (const filename of inputFiles) {
    // relinka("verbose", `Processing file: ${filename}`);
    const dtsFilename = filename.replace(JSX_EXT_RE, ".d.$1ts");
    let contents = vfs.get(dtsFilename) || "";

    if (opts?.addRelativeDeclarationExtensions) {
      relinka("verbose", "Adding relative declaration extensions");
      const ext = filename.match(JS_EXT_RE)?.[0].replace(/ts$/, "js") || ".js";
      const imports = findStaticImports(contents);
      const exports = findExports(contents);
      const typeExports = findTypeExports(contents);
      const dynamicImports = findDynamicImports(contents).map((dynamicImport) => {
        let specifier: string | undefined;
        try {
          const value = JSON.parse(dynamicImport.expression);
          if (typeof value === "string") {
            specifier = value;
          }
        } catch {
          // ignore the error
        }
        return {
          code: dynamicImport.code,
          specifier,
        };
      });

      // Step 8: Process relative imports
      relinka("verbose", "Processing relative imports");
      for (const spec of [...exports, ...typeExports, ...imports, ...dynamicImports]) {
        if (!spec.specifier || !RELATIVE_RE.test(spec.specifier)) {
          continue;
        }
        const srcPath = resolve(filename, "..", spec.specifier);
        const srcDtsPath = srcPath + ext.replace(JS_EXT_RE, ".d.$1ts");
        let specifier = spec.specifier;
        try {
          if (!vfs.get(srcDtsPath)) {
            const stat = statSync(srcPath);
            if (stat.isDirectory()) {
              specifier += "/index";
            }
          }
        } catch {
          // src file does not exists
        }
        contents = contents.replace(spec.code, spec.code.replace(spec.specifier, specifier + ext));
      }
    }
    output[filename] = { contents };
    vfs.delete(filename);
  }

  relinka("info", "Step 8: Declaration extraction completed");
  return output;
}

// Step 9: Add diagnostics to output
export function augmentWithDiagnostics(
  result: EmitResult,
  output: DeclarationOutput,
  tsHost: CompilerHost,
  ts: typeof import("typescript"),
) {
  relinka("info", "Step 9: Adding diagnostics to output");

  if (result.diagnostics?.length) {
    relinka("warn", `Found ${result.diagnostics.length} TypeScript diagnostics`);
    for (const diagnostic of result.diagnostics) {
      const filename = diagnostic.file?.fileName;
      if (!filename || !(filename in output)) {
        continue;
      }
      const fileOutput = output[filename as keyof typeof output];
      if (!fileOutput) {
        continue;
      }
      fileOutput.errors = fileOutput.errors || [];
      fileOutput.errors.push(
        new TypeError(ts.formatDiagnostics([diagnostic], tsHost), {
          cause: diagnostic,
        }),
      );
    }
    console.error(ts.formatDiagnostics(result.diagnostics, tsHost));
  }

  relinka("info", "Step 9: Diagnostics processing completed");
}
