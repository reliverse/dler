import { existsSync } from "node:fs";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";

type MigrationResult = {
  file: string;
  success: boolean;
  message: string;
  changes?: string[];
};

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

async function getAllTsFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);

      if (
        stats.isDirectory() &&
        !entry.startsWith(".") &&
        entry !== "node_modules"
      ) {
        const subFiles = await getAllTsFiles(fullPath);
        files.push(...subFiles);
      } else if (stats.isFile()) {
        const ext = extname(entry);
        if ([".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte"].includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // skip directories we can't read
  }

  return files;
}

export async function migratePatheToPathkit(
  dryRun = false,
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  const files = await getAllTsFiles(".");

  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      let modified = content;
      const changes: string[] = [];

      // replace pathe imports with pathkit
      const patheImportRegex = /from\s+["']pathe["']/g;
      if (patheImportRegex.test(content)) {
        modified = modified.replace(
          patheImportRegex,
          'from "@reliverse/pathkit"',
        );
        changes.push("Updated pathe imports to @reliverse/pathkit");
      }

      // replace pathe/utils imports with pathkit (utils are in main package)
      const patheUtilsRegex = /from\s+["']pathe\/utils["']/g;
      if (patheUtilsRegex.test(content)) {
        modified = modified.replace(
          patheUtilsRegex,
          'from "@reliverse/pathkit"',
        );
        changes.push("Updated pathe/utils imports to @reliverse/pathkit");
      }

      // replace require statements
      const patheRequireRegex = /require\s*\(\s*["']pathe["']\s*\)/g;
      if (patheRequireRegex.test(content)) {
        modified = modified.replace(
          patheRequireRegex,
          'require("@reliverse/pathkit")',
        );
        changes.push("Updated pathe require to @reliverse/pathkit");
      }

      const patheUtilsRequireRegex =
        /require\s*\(\s*["']pathe\/utils["']\s*\)/g;
      if (patheUtilsRequireRegex.test(content)) {
        modified = modified.replace(
          patheUtilsRequireRegex,
          'require("@reliverse/pathkit")',
        );
        changes.push("Updated pathe/utils require to @reliverse/pathkit");
      }

      if (changes.length > 0) {
        if (!dryRun) {
          await writeFile(file, modified, "utf-8");
        }

        results.push({
          file,
          success: true,
          message: `${changes.length} change(s) made`,
          changes,
        });
      }
    } catch (error) {
      results.push({
        file,
        success: false,
        message: `Failed to process: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  // handle package.json
  await updatePackageJson(results, dryRun, {
    remove: ["pathe"],
    add: { "@reliverse/pathkit": "^latest" },
  });

  return results;
}

export async function migratePathkitToPathe(
  dryRun = false,
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  const files = await getAllTsFiles(".");

  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      let modified = content;
      const changes: string[] = [];

      // replace pathkit imports with pathe
      const pathkitImportRegex = /from\s+["']@reliverse\/pathkit["']/g;
      if (pathkitImportRegex.test(content)) {
        // check if file uses advanced pathkit features
        const advancedFeatures = [
          "getFileImportsExports",
          "convertImportPaths",
          "convertImportExtensionsJsToTs",
          "normalizeAliases",
          "resolveAlias",
          "reverseResolveAlias",
          "normalizeQuotes",
        ];

        const usesAdvancedFeatures = advancedFeatures.some((feature) =>
          content.includes(feature),
        );

        if (usesAdvancedFeatures) {
          changes.push(
            "⚠️  File uses advanced pathkit features - manual review needed",
          );
          results.push({
            file,
            success: false,
            message:
              "Contains advanced pathkit features not available in pathe",
            changes,
          });
          continue;
        }

        // check for utils imports that need to be split
        const utilsPattern =
          /import\s*\{([^}]+)\}\s*from\s*["']@reliverse\/pathkit["']/g;
        const utilsMatch = utilsPattern.exec(content);

        if (utilsMatch?.[1]) {
          const imports = utilsMatch[1].split(",").map((s) => s.trim());
          const coreImports = imports.filter(
            (imp) =>
              ![
                "filename",
                "normalizeAliases",
                "resolveAlias",
                "reverseResolveAlias",
              ].includes(imp.replace(/\s+as\s+\w+/, "")),
          );
          const utilImports = imports.filter((imp) =>
            [
              "filename",
              "normalizeAliases",
              "resolveAlias",
              "reverseResolveAlias",
            ].includes(imp.replace(/\s+as\s+\w+/, "")),
          );

          if (coreImports.length > 0 && utilImports.length > 0) {
            // split into two imports
            const coreImportStatement = `import { ${coreImports.join(", ")} } from "pathe";`;
            const utilImportStatement = `import { ${utilImports.join(", ")} } from "pathe/utils";`;

            modified = modified.replace(
              utilsMatch[0],
              `${coreImportStatement}\n${utilImportStatement}`,
            );
            changes.push(
              "Split pathkit imports into pathe core and pathe/utils",
            );
          } else if (utilImports.length > 0) {
            // only utils imports
            modified = modified.replace(
              pathkitImportRegex,
              'from "pathe/utils"',
            );
            changes.push("Updated pathkit utils imports to pathe/utils");
          } else {
            // only core imports
            modified = modified.replace(pathkitImportRegex, 'from "pathe"');
            changes.push("Updated pathkit imports to pathe");
          }
        } else {
          // simple replacement for non-destructured imports
          modified = modified.replace(pathkitImportRegex, 'from "pathe"');
          changes.push("Updated pathkit imports to pathe");
        }
      }

      // replace require statements
      const pathkitRequireRegex =
        /require\s*\(\s*["']@reliverse\/pathkit["']\s*\)/g;
      if (pathkitRequireRegex.test(content)) {
        modified = modified.replace(pathkitRequireRegex, 'require("pathe")');
        changes.push("Updated pathkit require to pathe");
      }

      if (changes.length > 0) {
        if (!dryRun) {
          await writeFile(file, modified, "utf-8");
        }

        results.push({
          file,
          success: true,
          message: `${changes.length} change(s) made`,
          changes,
        });
      }
    } catch (error) {
      results.push({
        file,
        success: false,
        message: `Failed to process: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  // handle package.json
  await updatePackageJson(results, dryRun, {
    remove: ["@reliverse/pathkit"],
    add: { pathe: "^latest" },
  });

  return results;
}

async function updatePackageJson(
  results: MigrationResult[],
  dryRun: boolean,
  config: { remove: string[]; add: Record<string, string> },
): Promise<void> {
  try {
    const packageJsonPath = "./package.json";
    if (existsSync(packageJsonPath)) {
      const packageContent = await readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageContent) as PackageJson;
      let packageChanged = false;
      const packageChanges: string[] = [];

      // remove packages
      for (const pkg of config.remove) {
        if (packageJson.dependencies?.[pkg]) {
          packageJson.dependencies = Object.fromEntries(
            Object.entries(packageJson.dependencies).filter(
              ([key]) => key !== pkg,
            ),
          );
          packageChanged = true;
          packageChanges.push(`Removed ${pkg} from dependencies`);
        }

        if (packageJson.devDependencies?.[pkg]) {
          packageJson.devDependencies = Object.fromEntries(
            Object.entries(packageJson.devDependencies).filter(
              ([key]) => key !== pkg,
            ),
          );
          packageChanged = true;
          packageChanges.push(`Removed ${pkg} from devDependencies`);
        }
      }

      // add packages
      for (const [pkg, version] of Object.entries(config.add)) {
        if (packageChanged && !packageJson.dependencies?.[pkg]) {
          if (!packageJson.dependencies) packageJson.dependencies = {};
          packageJson.dependencies[pkg] = version;
          packageChanges.push(`Added ${pkg} to dependencies`);
        }
      }

      if (packageChanged) {
        if (!dryRun) {
          await writeFile(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2) + "\n",
            "utf-8",
          );
        }

        results.push({
          file: packageJsonPath,
          success: true,
          message: `${packageChanges.length} change(s) made`,
          changes: packageChanges,
        });
      }
    }
  } catch (error) {
    results.push({
      file: "./package.json",
      success: false,
      message: `Failed to update package.json: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
