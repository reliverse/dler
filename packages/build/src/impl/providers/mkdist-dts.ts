// packages/build/src/impl/providers/mkdist-dts.ts

import type { PackageInfo } from "../types";
import type { DtsOptions } from "@reliverse/dler-config/impl/build";
import { getDeclarations as getMkdistDeclarations } from "./mkdist/utils/dts";

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
 * Generate TypeScript declarations using mkdist's VFS approach
 * This function bridges the dts-generator.ts expectations with mkdist's internal implementation
 */
export async function getDeclarations(
  vfs: Map<string, string>,
  _pkg: PackageInfo,
  _dtsOptions: DtsOptions,
  _outputDir: string,
  mkdistOptions?: MkdistDtsOptions,
): Promise<DeclarationOutput> {
  // Call the mkdist declaration generator (accepts partial options)
  return await getMkdistDeclarations(vfs, mkdistOptions);
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

