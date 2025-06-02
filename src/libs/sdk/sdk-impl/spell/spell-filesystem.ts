import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const readFile = async (filePath: string): Promise<string> => {
  return await fs.readFile(filePath, "utf-8");
};

export const writeFile = async (filePath: string, content: string): Promise<void> => {
  const dir = path.dirname(filePath);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
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
  // TODO: use glob or similar for pattern matching instead
  const results: string[] = [];

  const scanDir = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (matchesAnyPattern(fullPath, patterns)) {
        results.push(fullPath);
      }
    }
  };

  await scanDir(cwd);
  return results;
};

const matchesAnyPattern = (filePath: string, patterns: string[]): boolean => {
  // TODO: use minimatch or similar instead
  if (patterns.length === 0) return true;

  return patterns.some((pattern) => {
    if (pattern === "*") return true;
    return filePath.includes(pattern);
  });
};
