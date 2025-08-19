import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import pMap from "p-map";
import { CONCURRENCY_DEFAULT, PROJECT_ROOT } from "~/impl/config/constants";
import type { LibConfig } from "~/impl/types/mod";

/**
 * Recursively removes any existing distribution folders.
 */
export async function removeDistFolders(
  distNpmDirName: string,
  distJsrDirName: string,
  libsDirDist: string,
  libsList: Record<string, LibConfig>,
  distTmpDirName = "",
): Promise<boolean> {
  // Determine folders to remove based on config or use defaults
  const foldersToRemove: string[] = [];
  foldersToRemove.push(distNpmDirName);
  foldersToRemove.push(distJsrDirName);
  if (distTmpDirName !== "") {
    foldersToRemove.push(distTmpDirName);
  }

  // Add libs dist dir if defined and at least one lib is configured
  if (libsList && Object.keys(libsList).length > 0) {
    foldersToRemove.push(libsDirDist);
  }

  const existingFolders: string[] = [];
  for (const folder of foldersToRemove) {
    const folderPath = path.resolve(PROJECT_ROOT, folder);
    if (await fs.pathExists(folderPath)) {
      existingFolders.push(folder);
    }
  }

  if (existingFolders.length > 0) {
    await pMap(
      existingFolders,
      async (folder) => {
        const folderPath = path.resolve(PROJECT_ROOT, folder);
        if (await fs.pathExists(folderPath)) {
          await fs.remove(folderPath);
          relinka("verbose", `Removed: ${folderPath}`);
        }
      },
      { concurrency: CONCURRENCY_DEFAULT },
    );
    relinka("verbose", "Distribution folders removed successfully");
  }

  return true;
}

/**
 * Removes logInternal and relinka "internal" calls from TypeScript/JavaScript files
 * @param targetDir Directory to process recursively
 * @returns Promise<boolean> True if successful
 */
export async function removeLogInternalCalls(targetDir: string): Promise<boolean> {
  const files = await fs.readdir(targetDir, { recursive: true });
  const tsJsFiles = files.filter(
    (file) =>
      file.endsWith(".ts") ||
      file.endsWith(".js") ||
      file.endsWith(".tsx") ||
      file.endsWith(".jsx"),
  );

  await pMap(
    tsJsFiles,
    async (file) => {
      const filePath = path.join(targetDir, file);
      const content = await fs.readFile(filePath, "utf8");

      // Remove logInternal calls
      let newContent = content.replace(
        /logInternal\s*\(\s*(?:`[^`]*`|'[^']*'|"[^"]*"|(?:[^;]*?,\s*)*[^;]*?)\s*\)\s*;?/g,
        "",
      );

      // Remove relinka("internal", ...) calls
      newContent = newContent.replace(
        /relinka\s*\(\s*["']internal["']\s*,\s*(?:`[^`]*`|'[^']*'|"[^"]*"|(?:[^;]*?,\s*)*[^;]*?)\s*\)\s*;?/g,
        "",
      );

      // Remove relinka.internal(...) method chaining calls
      newContent = newContent.replace(
        /relinka\.internal\s*\(\s*(?:`[^`]*`|'[^']*'|"[^"]*"|(?:[^;]*?,\s*)*[^;]*?)\s*\)\s*;?/g,
        "",
      );

      // Clean up any resulting empty lines
      newContent = newContent
        .replace(/\n\s*\n\s*\n/g, "\n\n") // Replace 3+ empty lines with 2
        .replace(/^\s*\n/gm, "") // Remove empty lines at start of file
        .replace(/\n\s*$/g, "\n"); // Ensure single newline at end

      if (newContent !== content) {
        await fs.writeFile(filePath, newContent);
        // relinka("verbose", `Processed: ${filePath}`);
      }
    },
    { concurrency: CONCURRENCY_DEFAULT },
  );

  relinka("verbose", "Successfully removed logInternal and relinka internal calls from files");
  return true;
}
