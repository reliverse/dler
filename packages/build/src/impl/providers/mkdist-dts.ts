// packages/build/src/impl/providers/mkdist-dts.ts

import { readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import type { PackageInfo } from "../types";
import type { DtsOptions } from "@reliverse/dler-config/impl/build";

export interface MkdistDtsOptions {
  addRelativeDeclarationExtensions?: boolean;
  pattern?: string;
  globOptions?: object;
}

export interface DeclarationOutput {
  [filename: string]: {
    contents: string;
    errors?: Error[];
  };
}

/**
 * Normalize TypeScript compiler options for declaration generation
 */
export async function normalizeCompilerOptions(
  options: any,
): Promise<any> {
  const ts = await import("typescript").then((r) => r.default || r);
  return ts.convertCompilerOptionsFromJson(options, process.cwd()).options;
}

/**
 * Generate TypeScript declarations using mkdist's VFS approach
 */
export async function getDeclarations(
  vfs: Map<string, string>,
  _pkg: PackageInfo,
  _dtsOptions: DtsOptions,
  outputDir: string,
  mkdistOptions?: MkdistDtsOptions,
): Promise<DeclarationOutput> {
  const ts = await import("typescript").then((r) => r.default || r);

  const inputFiles = [...vfs.keys()];

  // Create compiler host with VFS
  const tsHost = ts.createCompilerHost({});

  // Override writeFile to store in VFS
  tsHost.writeFile = (fileName: string, declaration: string) => {
    vfs.set(fileName, declaration);
  };

  // Override readFile to use VFS first, then fallback to file system
  const _readFile = tsHost.readFile;
  tsHost.readFile = (filename) => {
    if (vfs.has(filename)) {
      return vfs.get(filename);
    }
    return _readFile(filename);
  };

  // Create program with VFS and proper compiler options 
  const program = ts.createProgram(
    inputFiles,
    {
      declaration: true,
      emitDeclarationOnly: true,
      noEmit: false,
      outDir: outputDir, // Use the actual output directory
    },
    tsHost,
  );

  // Emit declarations
  const result = program.emit();
  
  // Extract declarations from VFS
  const output = extractDeclarations(vfs, inputFiles, mkdistOptions);
  
  // Add diagnostics to output
  augmentWithDiagnostics(result, output, tsHost, ts);

  return output;
}

/**
 * Extract declarations from VFS and resolve relative imports
 */
export function extractDeclarations(
  vfs: Map<string, string>,
  inputFiles: string[],
  mkdistOptions?: MkdistDtsOptions,
): DeclarationOutput {
  const output: DeclarationOutput = {};

  // Regex patterns for file extensions and relative imports
  const JS_EXT_RE = /\.(m|c)?(ts|js)$/;
  const JSX_EXT_RE = /\.(m|c)?(ts|js)x?$/;
  const RELATIVE_RE = /^\.{1,2}[/\\]/;

  for (const filename of inputFiles) {
    // The filename is the source file path, but we need to look for the declaration file
    // in the VFS which has the dist path structure
    const dtsFilename = filename.replace(JSX_EXT_RE, ".d.$1ts");
    
    // Try to find the declaration file in the VFS
    // The VFS contains files with dist paths, so we need to look for the dist version
    const distPath = filename.replace(/\/src\//, '/dist/').replace(/\\src\\/, '\\dist\\');
    const distDtsFilename = distPath.replace(JSX_EXT_RE, ".d.$1ts");
    
    // Normalize paths to handle both forward and backward slashes
    const normalizedDistDtsFilename = distDtsFilename.replace(/\\/g, '/');
    const normalizedDtsFilename = dtsFilename.replace(/\\/g, '/');
    
    let contents = vfs.get(normalizedDistDtsFilename) || vfs.get(normalizedDtsFilename) || "";
    

    // Add relative declaration extensions if enabled
    if (mkdistOptions?.addRelativeDeclarationExtensions !== false) {
      const ext = filename.match(JS_EXT_RE)?.[0].replace(/ts$/, "js") || ".js";
      
      // Simple import/export detection (replacing mlly dependency)
      const imports = findStaticImports(contents);
      const exports = findExports(contents);
      const typeExports = findTypeExports(contents);
      const dynamicImports = findDynamicImports(contents);

      for (const spec of [
        ...exports,
        ...typeExports,
        ...imports,
        ...dynamicImports,
      ]) {
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
          // src file does not exist
        }

        // Add file extension for relative paths
        contents = contents.replace(
          spec.code,
          spec.code.replace(spec.specifier, specifier + ext),
        );
      }
    }

    // Store the declaration content using the dist filename for consistency
    const outputFilename = distDtsFilename || dtsFilename;
    output[outputFilename] = { contents };
    vfs.delete(filename);
  }

  return output;
}

/**
 * Add TypeScript diagnostics to declaration output
 */
export function augmentWithDiagnostics(
  result: any,
  output: DeclarationOutput,
  tsHost: any,
  ts: typeof import("typescript"),
) {
  if (result.diagnostics?.length) {
    for (const diagnostic of result.diagnostics) {
      const filename = diagnostic.file?.fileName;
      if (filename && output[filename]) {
        output[filename].errors = output[filename].errors || [];
        output[filename].errors!.push(
          new TypeError(ts.formatDiagnostics([diagnostic], tsHost), {
            cause: diagnostic,
          }),
        );
      }
    }
    console.error(ts.formatDiagnostics(result.diagnostics, tsHost));
  }
}

/**
 * Simple static import detection (replacing mlly)
 */
function findStaticImports(content: string): Array<{ code: string; specifier: string }> {
  const imports: Array<{ code: string; specifier: string }> = [];
  const importRegex = /import\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const specifier = match[1];
    if (specifier) {
      imports.push({
        code: match[0],
        specifier,
      });
    }
  }

  return imports;
}

/**
 * Simple export detection (replacing mlly)
 */
function findExports(content: string): Array<{ code: string; specifier: string }> {
  const exports: Array<{ code: string; specifier: string }> = [];
  const exportRegex = /export\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/g;
  let match;

  while ((match = exportRegex.exec(content)) !== null) {
    const specifier = match[1];
    if (specifier) {
      exports.push({
        code: match[0],
        specifier,
      });
    }
  }

  return exports;
}

/**
 * Simple type export detection (replacing mlly)
 */
function findTypeExports(content: string): Array<{ code: string; specifier: string }> {
  const typeExports: Array<{ code: string; specifier: string }> = [];
  const typeExportRegex = /export\s+type\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/g;
  let match;

  while ((match = typeExportRegex.exec(content)) !== null) {
    const specifier = match[1];
    if (specifier) {
      typeExports.push({
        code: match[0],
        specifier,
      });
    }
  }

  return typeExports;
}

/**
 * Simple dynamic import detection (replacing mlly)
 */
function findDynamicImports(content: string): Array<{ code: string; specifier: string }> {
  const dynamicImports: Array<{ code: string; specifier: string }> = [];
  const dynamicImportRegex = /import\(["']([^"']+)["']\)/g;
  let match;

  while ((match = dynamicImportRegex.exec(content)) !== null) {
    const specifier = match[1];
    if (specifier) {
      dynamicImports.push({
        code: match[0],
        specifier,
      });
    }
  }

  return dynamicImports;
}

/**
 * Get list of generated declaration files
 */
export function getGeneratedDeclarationFiles(outputDir: string): string[] {
  const files: string[] = [];
  
  function scanDirectory(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.name.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }

  scanDirectory(outputDir);
  return files;
}
