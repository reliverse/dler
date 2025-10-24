// packages/build/src/impl/plugins/typescript-declarations.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { logger } from "@reliverse/dler-logger";
import type { BuildResult, DlerPlugin, PackageInfo } from "../types";

export const TypeScriptDeclarationsPlugin: DlerPlugin = {
  name: "typescript-declarations",
  setup: () => {
    // This plugin will be applied after build
    logger.debug("TypeScript declarations plugin registered");
  },
  onBuildEnd: async (result: BuildResult) => {
    if (!result.success || result.skipped) {
      return;
    }

    const pkg = result.package;
    
    // Only generate declarations for libraries (not frontend apps)
    if (pkg.isFrontendApp) {
      return;
    }

    try {
      await generateTypeDeclarations(pkg);
    } catch (error) {
      logger.warn(`Failed to generate TypeScript declarations for ${pkg.name}: ${error}`);
    }
  },
};

async function generateTypeDeclarations(pkg: PackageInfo): Promise<void> {
  const tsconfigPath = join(pkg.path, "tsconfig.json");
  
  if (!existsSync(tsconfigPath)) {
    logger.debug(`No tsconfig.json found for ${pkg.name}, skipping declaration generation`);
    return;
  }

  // Read tsconfig.json
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
  
  // Check if declaration generation is enabled
  if (!tsconfig.compilerOptions?.declaration) {
    logger.debug(`Declaration generation not enabled for ${pkg.name}`);
    return;
  }

  // Find TypeScript source files
  const sourceFiles = pkg.entryPoints.filter(ep => 
    ep.endsWith('.ts') && !ep.endsWith('.d.ts')
  );

  if (sourceFiles.length === 0) {
    logger.debug(`No TypeScript source files found for ${pkg.name}`);
    return;
  }

  // Generate basic declaration files
  for (const sourceFile of sourceFiles) {
    const relativePath = sourceFile.replace(pkg.path, '').replace(/^\//, '');
    const outputFile = join(pkg.outputDir, relativePath.replace('.ts', '.d.ts'));
    
    // Ensure output directory exists
    const outputDir = dirname(outputFile);
    if (!existsSync(outputDir)) {
      await import('node:fs').then(fs => fs.mkdirSync(outputDir, { recursive: true }));
    }

    // Generate basic declaration content
    const declarationContent = generateBasicDeclaration(sourceFile, pkg);
    writeFileSync(outputFile, declarationContent, 'utf-8');
    
    logger.info(`📝 Generated declaration: ${basename(outputFile)}`);
  }
}

function generateBasicDeclaration(sourceFile: string, pkg: PackageInfo): string {
  const fileName = basename(sourceFile, '.ts');
  const moduleName = pkg.name;
  
  return `// Auto-generated declaration file for ${fileName}
// Source: ${sourceFile}

declare module "${moduleName}" {
  // TODO: Add proper type declarations
  // This is a placeholder - consider using tsc --declaration for accurate types
  export * from "./${fileName}";
}

declare module "${moduleName}/${fileName}" {
  // TODO: Add specific exports for ${fileName}
}
`;
}
