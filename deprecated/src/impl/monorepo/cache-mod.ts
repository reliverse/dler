import { createHash } from "node:crypto";
import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { globby } from "globby";
import type { Monorepo, Package } from "./monorepo-mod";

export interface CacheResult {
  packageHash: string;
  fileHashes: string;
}

/**
 * Hash a package based on its files and configuration
 */
export async function hashPackage(pkg: Package): Promise<CacheResult> {
  const files = await globby(pkg.config.include, {
    cwd: pkg.dir,
    ignore: pkg.config.exclude,
    absolute: true,
  });

  files.sort();

  const fileHashes = files
    .filter((file) => fs.statSync(file).isFile())
    .map((file) => {
      const hash = hashFile(file);
      const relativePath = path.relative(pkg.dir, file);
      return `${hash}-${relativePath}`;
    })
    .join("\n");

  const packageHash = createHash("md5").update(fileHashes).digest("hex");

  return {
    packageHash,
    fileHashes,
  };
}

/**
 * Hash a single file
 */
function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash("md5").update(content).digest("hex");
}

/**
 * Get the cache directory for a package
 */
export function getPackageCacheDir(
  monorepo: Monorepo,
  pkg: Package,
  packageHash: string,
): string {
  return path.join(monorepo.root, ".cache", pkg.name, packageHash);
}

/**
 * Check if a package cache exists and is valid
 */
export async function isPackageCached(
  monorepo: Monorepo,
  pkg: Package,
  packageHash: string,
): Promise<boolean> {
  const cacheDir = getPackageCacheDir(monorepo, pkg, packageHash);
  return await fs.pathExists(cacheDir);
}

/**
 * Restore package from cache
 */
export async function restorePackageCache(
  monorepo: Monorepo,
  pkg: Package,
  packageHash: string,
): Promise<void> {
  const cacheDir = getPackageCacheDir(monorepo, pkg, packageHash);
  const outDir = path.join(pkg.dir, pkg.config.outDir);

  if (!(await fs.pathExists(cacheDir))) {
    throw new Error(`Cache directory not found: ${cacheDir}`);
  }

  // Ensure output directory exists
  await fs.ensureDir(outDir);

  // Copy from cache to output directory
  await fs.copy(cacheDir, outDir, { overwrite: true });
}

/**
 * Cache package build output
 */
export async function cachePackageOutput(
  monorepo: Monorepo,
  pkg: Package,
  packageHash: string,
): Promise<void> {
  const cacheDir = getPackageCacheDir(monorepo, pkg, packageHash);
  const outDir = path.join(pkg.dir, pkg.config.outDir);

  if (!(await fs.pathExists(outDir))) {
    throw new Error(`Output directory not found: ${outDir}`);
  }

  // Ensure cache directory exists
  await fs.ensureDir(cacheDir);

  // Copy from output directory to cache
  await fs.copy(outDir, cacheDir, { overwrite: true });
}

/**
 * Clean the entire cache directory
 */
export async function cleanCache(monorepo: Monorepo): Promise<void> {
  const cacheDir = path.join(monorepo.root, ".cache");

  if (await fs.pathExists(cacheDir)) {
    await fs.remove(cacheDir);
    relinka("log", `Cache cleaned: ${cacheDir}`);
  } else {
    relinka("log", "No cache directory found");
  }
}
