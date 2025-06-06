import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { minimatch } from "minimatch";

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const readFile = async (filePath: string): Promise<string> => {
  return await fs.readFile(filePath, "utf8");
};

export const writeFile = async (filePath: string, content: string): Promise<void> => {
  const dir = path.dirname(filePath);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error}`);
  }
};

export const removeFile = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    throw new Error(`Failed to remove file ${filePath}: ${error}`);
  }
};

export const renameFile = async (oldPath: string, newPath: string): Promise<void> => {
  try {
    const dir = path.dirname(newPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.rename(oldPath, newPath);
  } catch (error) {
    throw new Error(`Failed to rename file ${oldPath} to ${newPath}: ${error}`);
  }
};

export const copyFile = async (
  sourcePath: string,
  targetPath: string,
  overwrite = true,
): Promise<void> => {
  try {
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });

    // Check if target file exists
    const exists = await fileExists(targetPath);
    if (exists && !overwrite) {
      throw new Error(`Destination ${targetPath} already exists and overwrite is false.`);
    }

    await fs.copyFile(sourcePath, targetPath);
  } catch (error) {
    throw new Error(`Failed to copy file ${sourcePath} to ${targetPath}: ${error}`);
  }
};

export const findFiles = async (
  patterns: string[],
  cwd: string = process.cwd(),
): Promise<string[]> => {
  const results: string[] = [];
  const defaultPatterns = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.json"];
  const effectivePatterns = patterns.length > 0 ? patterns : defaultPatterns;

  const scanDir = async (dir: string) => {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common directories that shouldn't be scanned
          if (
            entry.name === "node_modules" ||
            entry.name === "dist" ||
            entry.name === ".git" ||
            entry.name === ".svn" ||
            entry.name === ".hg" ||
            entry.name === ".turbo" ||
            entry.name === ".next" ||
            entry.name === ".nuxt"
          ) {
            continue;
          }
          await scanDir(fullPath);
        } else if (matchesAnyPattern(fullPath, effectivePatterns)) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dir}: ${error}`);
    }
  };

  await scanDir(cwd);
  return results;
};

const matchesAnyPattern = (filePath: string, patterns: string[]): boolean => {
  if (patterns.length === 0) return true;

  const relativePath = path.relative(process.cwd(), filePath);
  return patterns.some((pattern) => minimatch(relativePath, pattern));
};
