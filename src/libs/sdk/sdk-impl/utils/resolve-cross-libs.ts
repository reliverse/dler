import { relinka } from "@reliverse/relinka";
import { promises as fs } from "node:fs";
import path from "node:path";

async function resolveCrossLibs(
  libBinDir: string,
  alias = "~",
  subFolders: ("npm" | "jsr")[] = ["npm", "jsr"],
  buildPreExtensions: string[],
  buildTemplatesDir: string,
): Promise<string[]> {
  // relinka("internal", `Starting resolveCrossLibs for ${libBinDir} with alias ${alias}`);

  // Normalize path separators for cross-platform compatibility
  const normalizedPath = libBinDir.replace(/\\/g, "/");
  // relinka("internal", "DEBUG: normalizedPath = " + normalizedPath);
  // relinka("internal", "DEBUG: startsWith dist-jsr: " + normalizedPath.startsWith("dist-jsr"));
  // relinka("internal", "DEBUG: startsWith dist-npm: " + normalizedPath.startsWith("dist-npm"));
  // relinka("internal", "DEBUG: startsWith dist-libs: " + normalizedPath.startsWith("dist-libs"));

  // Check if path starts with any of the allowed prefixes
  if (
    !normalizedPath.startsWith("dist-libs") &&
    !normalizedPath.startsWith("dist-jsr") &&
    !normalizedPath.startsWith("dist-npm")
  ) {
    throw new Error(
      `[resolve-cross-libs] libBinDir must start with "dist-libs", "dist-jsr", or "dist-npm", got: ${libBinDir}`,
    );
  }

  // For dist-libs, apply the full cross-libs resolution logic
  if (normalizedPath.startsWith("dist-libs")) {
    // Extract current library name from path: dist-libs/sdk/npm/bin -> sdk
    const pathParts = normalizedPath.replace(/\/$/, "").split("/");
    if (pathParts.length < 4) {
      throw new Error(
        `[resolve-cross-libs] Invalid libBinDir structure: ${libBinDir}, expected dist-libs/<lib>/<subfolder>/bin`,
      );
    }
    const currentLib = pathParts[1];
    // relinka("internal", `Processing library: ${currentLib}`);

    const files = await findSourceFiles(libBinDir, buildPreExtensions, buildTemplatesDir);
    const modifiedFiles: string[] = [];

    await Promise.all(
      files.map(async (filePath) => {
        const content = await fs.readFile(filePath, "utf-8");
        // @ts-expect-error @total-typescript/ts-reset <undefined is possible here>
        const processed = await processFile(content, currentLib, alias, subFolders, filePath);

        if (processed !== content) {
          relinka("log", `[resolve-cross-libs] File modified: ${filePath}`);
          await fs.writeFile(filePath, processed, "utf-8");
          modifiedFiles.push(path.resolve(filePath));
        }
      }),
    );

    // relinka("internal", `Completed processing ${modifiedFiles.length} modified files`);
    return modifiedFiles;
  }

  return [];
}

async function findSourceFiles(
  dir: string,
  buildPreExtensions: string[],
  buildTemplatesDir: string,
): Promise<string[]> {
  // relinka("internal", `Searching for source files in: ${dir}`);
  const files: string[] = [];

  const entries = await fs.readdir(dir, { withFileTypes: true });
  // relinka("internal", `Found ${entries.length} entries in directory`);

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // relinka("internal", `Recursing into directory: ${fullPath}`);
        const subFiles = await findSourceFiles(fullPath, buildPreExtensions, buildTemplatesDir);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1);
        const isDts = entry.name.endsWith(".d.ts");
        const isInTemplatesDir = fullPath.includes(`/${buildTemplatesDir}/`);

        // Skip if file is in templates directory
        if (isInTemplatesDir) {
          return;
        }

        // Always process .d.ts files if not in templates directory
        if (isDts) {
          // relinka("internal", `Found .d.ts file: ${fullPath}`);
          files.push(fullPath);
          return;
        }

        // For non-.d.ts files, skip if extension is NOT in buildPreExtensions
        if (!buildPreExtensions.includes(ext)) {
          return;
        }

        // Process files with extensions from buildPreExtensions
        if (ext === "js" || ext === "ts") {
          // relinka("internal", `Found source file: ${fullPath}`);
          files.push(fullPath);
        }
      }
    }),
  );

  return files;
}

function escapeRegex(str: string | undefined | null): string {
  if (!str || typeof str !== "string") {
    return "";
  }
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function processFile(
  content: string,
  currentLib: string,
  alias: string,
  subFolders: ("npm" | "jsr")[],
  currentFilePath: string,
): Promise<string> {
  // relinka("internal", `Processing file for library ${currentLib} with ${content.split("\n").length} lines`);
  const lines = content.split("\n");
  const result: string[] = [];

  let insideInlined = false;
  // const processedImports = 0;

  for (const line of lines) {
    // Track inlined block boundaries
    if (line.includes("/* inlined-start ")) {
      insideInlined = true;
      relinka("log", `[resolve-cross-libs] Entering inlined block: ${line.trim()}`);
      result.push(line);
      continue;
    }

    if (line.includes("/* inlined-end */")) {
      insideInlined = false;
      // relinka("internal", "Exiting inlined block");
      result.push(line);
      continue;
    }

    // Skip processing if inside inlined block
    if (insideInlined) {
      result.push(line);
      continue;
    }

    // Match import/export lines with alias pattern
    const pattern = new RegExp(
      `^(\\s*)((?:export\\s+.*?\\s+from|import\\s+.*?\\s+from)\\s+(['"])${escapeRegex(alias)}/libs/([^/]+)/([^'"]*?)\\3[^;]*;?)(\\s*//.*)?\\s*$`,
    );

    const match = line.match(pattern);

    if (match) {
      // processedImports++;
      const [, indentation, fullStatement, quote, libName, rest, comment] = match;
      relinka("log", `[resolve-cross-libs] Processing import/export: ${libName}/${rest}`);

      // Skip if already converted to relative path (idempotent)
      if (fullStatement?.includes(`${quote}./`)) {
        // relinka(
        //   "internal",
        //   `[resolve-cross-libs] Skipping already converted import: ${libName}/${rest}`,
        // );
        result.push(line);
        continue;
      }

      if (libName === currentLib) {
        // Same library - rewrite to relative path
        // relinka("internal", `[resolve-cross-libs] Converting to relative path: ${libName}/${rest}`);
        const newStatement =
          fullStatement?.replace(`${quote}${alias}/libs/${libName}/`, `${quote}./`) ?? "";
        result.push(`${indentation}${newStatement}${comment || ""}`);
      } else {
        // Different library - inline contents
        try {
          if (!libName || !rest) {
            throw new Error("Library name or path is undefined");
          }
          relinka("log", `[resolve-cross-libs] Attempting to inline: ${libName}/${rest}`);
          const targetPath = await resolveTargetFile(libName, rest, subFolders, currentFilePath);
          // relinka("internal", `Found target file: ${targetPath}`);
          const targetContent = await fs.readFile(targetPath, "utf-8");

          result.push(`${indentation}/* inlined-start ${alias}/libs/${libName}/${rest} */`);

          // Add target content with preserved indentation
          const targetLines = targetContent.split("\n");
          relinka(
            "log",
            `[resolve-cross-libs] Inlining ${targetLines.length} lines from ${targetPath}`,
          );
          for (const targetLine of targetLines) {
            result.push(`${indentation}${targetLine}`);
          }

          result.push(`${indentation}/* inlined-end */`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          relinka(
            "error",
            `[resolve-cross-libs] Failed to inline ${alias}/libs/${libName}/${rest}: ${errorMessage}`,
          );
          throw error;
        }
      }
    } else {
      result.push(line);
    }
  }

  // relinka("internal", `Processed ${processedImports} imports/exports in file`);
  return result.join("\n");
}

async function resolveTargetFile(
  libName: string,
  rest: string,
  subFolders: ("npm" | "jsr")[],
  currentFilePath: string,
): Promise<string> {
  relinka("log", `[resolve-cross-libs] Resolving target file for ${libName}/${rest}`);

  // Determine extension priority based on current file type
  const isCurrentFileDts = currentFilePath.endsWith(".d.ts");
  const extensions = isCurrentFileDts ? [".d.ts", ".ts", ".js"] : [".ts", ".js", ".d.ts"];
  // relinka(
  //   "internal",
  //   `[resolve-cross-libs] Current file is .d.ts: ${isCurrentFileDts}, using extension priority: ${extensions.join(", ")}`,
  // );

  for (const subFolder of subFolders) {
    const basePath = path.join("dist-libs", libName, subFolder, "bin", rest);
    // relinka("internal", `[resolve-cross-libs] Trying subfolder: ${subFolder}`);

    // Try extensions in priority order
    for (const ext of extensions) {
      const fullPath = `${basePath}${ext}`;
      try {
        await fs.access(fullPath);
        relinka("internal", `[resolve-cross-libs] Found target file: ${fullPath}`);
        return fullPath;
      } catch {
        relinka("internal", `[resolve-cross-libs] File not found: ${fullPath}`);
        // File doesn't exist, continue trying
      }
    }
  }

  throw new Error(
    `Could not resolve target file for libs/${libName}/${rest} in any subfolder: ${subFolders.join(", ")}`,
  );
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

// Wrapper function to process all libraries in dist-libs
async function resolveAllCrossLibs(
  alias = "~",
  subFolders: ("npm" | "jsr")[] = ["npm", "jsr"],
  buildPreExtensions: string[],
  buildTemplatesDir: string,
): Promise<string[]> {
  // relinka("internal", `Starting resolveAllCrossLibs with alias ${alias}`);
  const distLibsDir = "dist-libs";

  const allModifiedFiles: string[] = [];

  // Process dist-libs first
  const distLibsExists = await directoryExists(distLibsDir);
  if (distLibsExists) {
    const entries = await fs.readdir(distLibsDir, { withFileTypes: true });
    const libDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    // relinka("internal", `Found ${libDirs.length} libraries to process: ${libDirs.join(", ")}`);

    await Promise.all(
      libDirs.map(async (libName) => {
        // relinka("internal", `Processing library: ${libName}`);
        for (const subFolder of subFolders) {
          const binDir = path.join(distLibsDir, libName, subFolder, "bin");
          // relinka("internal", `Checking bin directory: ${binDir}`);

          const binDirExists = await directoryExists(binDir);
          if (binDirExists) {
            // relinka("internal", `Processing bin directory: ${binDir}`);
            try {
              const modifiedFiles = await resolveCrossLibs(
                binDir,
                alias,
                subFolders,
                buildPreExtensions,
                buildTemplatesDir,
              );
              allModifiedFiles.push(...modifiedFiles);
              // relinka(
              //   "internal",
              //   `Successfully processed ${modifiedFiles.length} files in ${binDir}`,
              // );
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              relinka("error", `[resolveAllCrossLibs] Error processing ${binDir}: ${errorMessage}`);
              throw error;
            }
          } else {
            // bin directory does not exist, skip
          }
        }
      }),
    );
  }

  if (allModifiedFiles.length > 0) {
    relinka("info", "[resolveAllCrossLibs] Cross libraries replacements done in:");
    relinka("log", "[resolveAllCrossLibs] " + allModifiedFiles.join(", "));
  }

  // relinka(
  //   "internal",
  //   `Completed processing all libraries. Total modified files: ${allModifiedFiles.length}`,
  // );
  return allModifiedFiles;
}

export { resolveCrossLibs, resolveAllCrossLibs };
