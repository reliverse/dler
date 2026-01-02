// packages/build/src/impl/utils/go-build-handler.ts

import { relinka } from "@reliverse/relinka";
import { buildGo } from "../go-build";
import type { BuildOptions, PackageInfo } from "../types";

/**
 * Handle Go build for a package if applicable
 */
export async function handleGoBuild(
  pkg: PackageInfo,
  options: BuildOptions,
  verbose: boolean,
): Promise<void> {
  // Skip if tsOnly is set
  if (options.tsOnly) {
    if (verbose) {
      await relinka.info(
        `⏭️  ${pkg.name}: Skipping Go build (--ts-only flag set)`,
      );
    }
    return;
  }

  // Skip if no Go files detected
  if (!pkg.hasGoFiles) {
    if (verbose) {
      await relinka.debug(`⏭️  ${pkg.name}: No Go files detected`);
    }
    return;
  }

  const goConfig = options.go ?? pkg.buildConfig?.go;

  // Enable by default if Go files are detected and config doesn't explicitly disable it
  if (goConfig?.enable === false) {
    if (verbose) {
      await relinka.info(`⏭️  ${pkg.name}: Go build disabled in config`);
    }
    return;
  }

  try {
    await relinka.info(`🔨 ${pkg.name}: Building Go binaries...`);
    const goResult = await buildGo(
      pkg.path,
      pkg.name,
      goConfig ?? { enable: true },
    );

    if (!goResult.success) {
      await relinka.warn(
        `⚠️  ${pkg.name}: Go build failed: ${goResult.errors.join(", ")}`,
      );
    } else {
      await relinka.success(`✅ ${pkg.name}: Go binaries built successfully`);
    }
  } catch (error) {
    await relinka.warn(
      `⚠️  ${pkg.name}: Go build error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Handle Go-only build mode
 */
export async function handleGoOnlyBuild(
  pkg: PackageInfo,
  options: BuildOptions,
): Promise<{ success: boolean; errors: string[] }> {
  if (!pkg.hasGoFiles) {
    return {
      success: true,
      errors: [],
    };
  }

  const goConfig = options.go ?? pkg.buildConfig?.go;

  if (goConfig?.enable === false) {
    return {
      success: true,
      errors: [],
    };
  }

  try {
    await relinka.info(`🔨 ${pkg.name}: Building Go binaries...`);
    const goResult = await buildGo(
      pkg.path,
      pkg.name,
      goConfig ?? { enable: true },
    );

    if (!goResult.success) {
      return {
        success: false,
        errors: goResult.errors,
      };
    }

    await relinka.success(`✅ ${pkg.name}: Go binaries built successfully`);
    return {
      success: true,
      errors: [],
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
