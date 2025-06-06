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

export async function migratePathToPathkit(dryRun = false): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  const files = await getAllTsFiles(".");

  for (const file of files) {
    try {
      const content = await readFile(file, "utf8");
      let modified = content;
      const changes: string[] = [];

      // replace pathe imports with pathkit
      const patheImportRegex = /from\s+["']pathe["']/g;
      if (patheImportRegex.test(content)) {
        modified = modified.replace(patheImportRegex, 'from "@reliverse/pathkit"');
        changes.push("Updated pathe imports to @reliverse/pathkit");
      }

      // replace pathe/utils imports with pathkit (utils are in main package)
      const patheUtilsRegex = /from\s+["']pathe\/utils["']/g;
      if (patheUtilsRegex.test(content)) {
        modified = modified.replace(patheUtilsRegex, 'from "@reliverse/pathkit"');
        changes.push("Updated pathe/utils imports to @reliverse/pathkit");
      }

      // replace node:path imports with pathkit (handles both default and named exports)
      const nodePathImportRegex = /import\s+(?:(\{[^}]*\})|(\w+))\s+from\s+["']node:path["']/g;
      if (nodePathImportRegex.test(content)) {
        modified = modified.replace(nodePathImportRegex, (_match, namedExports, defaultExport) => {
          if (namedExports) {
            return `import ${namedExports} from "@reliverse/pathkit"`;
          }
          return `import ${defaultExport} from "@reliverse/pathkit"`;
        });
        changes.push("Updated node:path imports to @reliverse/pathkit");
      }

      // replace require statements
      const patheRequireRegex = /require\s*\(\s*["']pathe["']\s*\)/g;
      if (patheRequireRegex.test(content)) {
        modified = modified.replace(patheRequireRegex, 'require("@reliverse/pathkit")');
        changes.push("Updated pathe require to @reliverse/pathkit");
      }

      const patheUtilsRequireRegex = /require\s*\(\s*["']pathe\/utils["']\s*\)/g;
      if (patheUtilsRequireRegex.test(content)) {
        modified = modified.replace(patheUtilsRequireRegex, 'require("@reliverse/pathkit")');
        changes.push("Updated pathe/utils require to @reliverse/pathkit");
      }

      const nodePathRequireRegex = /require\s*\(\s*["']node:path["']\s*\)/g;
      if (nodePathRequireRegex.test(content)) {
        modified = modified.replace(nodePathRequireRegex, 'require("@reliverse/pathkit")');
        changes.push("Updated node:path require to @reliverse/pathkit");
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
    remove: ["pathe"],
    add: { "@reliverse/pathkit": "^latest" },
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
