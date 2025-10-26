// packages/build/src/impl/plugins/typescript-declarations.ts

import { logger } from "@reliverse/dler-logger";
import type { BuildResult, DlerPlugin, PackageInfo, BuildOptions } from "../types";
import { generateDeclarations } from "../dts-generator";
import type { DtsOptions } from "@reliverse/dler-config/impl/build";

export const TypeScriptDeclarationsPlugin: DlerPlugin = {
  name: "typescript-declarations",
  setup: () => {
    // This plugin will be applied after build
    logger.debug("TypeScript declarations plugin registered");
  },
  onBuildEnd: async (result: BuildResult, buildOptions?: BuildOptions) => {
    if (!result.success || result.skipped) {
      return;
    }

    const pkg = result.package;
    
    // Only generate declarations for libraries (not frontend apps)
    if (pkg.isFrontendApp) {
      return;
    }

    try {
      await generateTypeDeclarations(pkg, buildOptions);
    } catch (error) {
      logger.warn(`⚠️  Declaration generation failed for ${pkg.name}: ${error}`);
    }
  },
};

async function generateTypeDeclarations(pkg: PackageInfo, buildOptions?: BuildOptions): Promise<void> {
  // Extract dts config from pkg.buildConfig
  const configDts = pkg.buildConfig?.dts;
  
  // Convert boolean to object if needed
  const dtsConfig = typeof configDts === 'boolean' 
    ? { enable: configDts } 
    : (configDts || {});
  
  // Merge with CLI options (CLI takes precedence)
  const dtsOptions: DtsOptions = {
    enable: true, // Already checked by plugin activation
    ...dtsConfig, // Config from dler.ts
    // CLI overrides
    ...(buildOptions?.dtsProvider && { provider: buildOptions.dtsProvider }),
  };
  
  const result = await generateDeclarations({
    package: pkg,
    dtsOptions,
    format: pkg.buildConfig?.format || "esm",
    outputDir: pkg.outputDir,
  });

  if (!result.success) {
    logger.warn(`⚠️  Declaration generation failed for ${pkg.name}:`);
    logger.warn(result.error || "Unknown error occurred during declaration generation");
  }
}
