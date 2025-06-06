import { join, extname } from "@reliverse/pathkit";
import { existsSync } from "node:fs";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";

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

      if (stats.isDirectory() && !entry.startsWith(".") && entry !== "node_modules") {
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

export async function migrateFsToRelifso(dryRun = false): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  const files = await getAllTsFiles(".");

  for (const file of files) {
    try {
      const content = await readFile(file, "utf8");
      let modified = content;
      const changes: string[] = [];

      // replace node:fs imports with relifso (handles both default and named exports)
      const nodeFsImportRegex = /import\s+(?:(\{[^}]*\})|(\w+))\s+from\s+["']node:fs["']/g;
      if (nodeFsImportRegex.test(content)) {
        modified = modified.replace(nodeFsImportRegex, (_match, namedExports, defaultExport) => {
          if (namedExports) {
            return `import ${namedExports} from "@reliverse/relifso"`;
          }
          return `import ${defaultExport} from "@reliverse/relifso"`;
        });
        changes.push("Updated node:fs imports to @reliverse/relifso");
      }

      // replace node:fs/promises imports with relifso
      const nodeFsPromisesImportRegex =
        /import\s+(?:(\{[^}]*\})|(\w+))\s+from\s+["']node:fs\/promises["']/g;
      if (nodeFsPromisesImportRegex.test(content)) {
        modified = modified.replace(
          nodeFsPromisesImportRegex,
          (_match, namedExports, defaultExport) => {
            if (namedExports) {
              return `import ${namedExports} from "@reliverse/relifso"`;
            }
            return `import ${defaultExport} from "@reliverse/relifso"`;
          },
        );
        changes.push("Updated node:fs/promises imports to @reliverse/relifso");
      }

      // replace fs-extra imports with relifso
      const fsExtraImportRegex = /import\s+(?:(\{[^}]*\})|(\w+))\s+from\s+["']fs-extra["']/g;
      if (fsExtraImportRegex.test(content)) {
        modified = modified.replace(fsExtraImportRegex, (_match, namedExports, defaultExport) => {
          if (namedExports) {
            return `import ${namedExports} from "@reliverse/relifso"`;
          }
          return `import ${defaultExport} from "@reliverse/relifso"`;
        });
        changes.push("Updated fs-extra imports to @reliverse/relifso");
      }

      // replace require statements
      const nodeFsRequireRegex = /require\s*\(\s*["']node:fs["']\s*\)/g;
      if (nodeFsRequireRegex.test(content)) {
        modified = modified.replace(nodeFsRequireRegex, 'require("@reliverse/relifso")');
        changes.push("Updated node:fs require to @reliverse/relifso");
      }

      const nodeFsPromisesRequireRegex = /require\s*\(\s*["']node:fs\/promises["']\s*\)/g;
      if (nodeFsPromisesRequireRegex.test(content)) {
        modified = modified.replace(nodeFsPromisesRequireRegex, 'require("@reliverse/relifso")');
        changes.push("Updated node:fs/promises require to @reliverse/relifso");
      }

      const fsExtraRequireRegex = /require\s*\(\s*["']fs-extra["']\s*\)/g;
      if (fsExtraRequireRegex.test(content)) {
        modified = modified.replace(fsExtraRequireRegex, 'require("@reliverse/relifso")');
        changes.push("Updated fs-extra require to @reliverse/relifso");
      }

      if (changes.length > 0) {
        if (!dryRun) {
          await writeFile(file, modified, "utf8");
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
    remove: ["fs-extra"],
    add: { "@reliverse/relifso": "^latest" },
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
      const packageContent = await readFile(packageJsonPath, "utf8");
      const packageJson = JSON.parse(packageContent) as PackageJson;
      let packageChanged = false;
      const packageChanges: string[] = [];

      // remove packages
      for (const pkg of config.remove) {
        if (packageJson.dependencies?.[pkg]) {
          packageJson.dependencies = Object.fromEntries(
            Object.entries(packageJson.dependencies).filter(([key]) => key !== pkg),
          );
          packageChanged = true;
          packageChanges.push(`Removed ${pkg} from dependencies`);
        }

        if (packageJson.devDependencies?.[pkg]) {
          packageJson.devDependencies = Object.fromEntries(
            Object.entries(packageJson.devDependencies).filter(([key]) => key !== pkg),
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
          await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n", "utf8");
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
