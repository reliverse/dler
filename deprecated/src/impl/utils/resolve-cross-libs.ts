import { promises as fs } from "node:fs";
import path from "node:path";
import { relinka } from "@reliverse/relinka";
import { createJiti } from "jiti";

async function resolveCrossLibsViaInline(
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

    if (!currentLib) {
      throw new Error(
        `[resolve-cross-libs] Invalid libBinDir structure: ${libBinDir}, could not extract library name`,
      );
    }

    const files = await findSourceFiles(
      libBinDir,
      buildPreExtensions,
      buildTemplatesDir,
    );
    const modifiedFiles: string[] = [];

    await Promise.all(
      files.map(async (filePath) => {
        const content = await fs.readFile(filePath, "utf-8");
        const processed = await processFileViaInline(
          content,
          currentLib,
          alias,
          subFolders,
          filePath,
        );

        if (processed !== content) {
          relinka("verbose", `[resolve-cross-libs] File modified: ${filePath}`);
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
        const subFiles = await findSourceFiles(
          fullPath,
          buildPreExtensions,
          buildTemplatesDir,
        );
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

async function processFileViaInline(
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
      relinka(
        "verbose",
        `[resolve-cross-libs] Entering inlined block: ${line.trim()}`,
      );
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
      const [, indentation, fullStatement, quote, libName, rest, comment] =
        match;
      relinka(
        "verbose",
        `[resolve-cross-libs] Processing import/export: ${libName}/${rest}`,
      );

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
          fullStatement?.replace(
            `${quote}${alias}/libs/${libName}/`,
            `${quote}./`,
          ) ?? "";
        result.push(`${indentation}${newStatement}${comment || ""}`);
      } else {
        // Different library - inline contents
        try {
          if (!libName || !rest) {
            throw new Error("Library name or path is undefined");
          }
          relinka(
            "verbose",
            `[resolve-cross-libs] Attempting to inline: ${libName}/${rest}`,
          );
          const targetPath = await resolveTargetFile(
            libName,
            rest,
            subFolders,
            currentFilePath,
          );
          // relinka("internal", `Found target file: ${targetPath}`);
          const targetContent = await fs.readFile(targetPath, "utf-8");

          result.push(
            `${indentation}/* inlined-start ${alias}/libs/${libName}/${rest} */`,
          );

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
          const errorMessage =
            error instanceof Error ? error.message : String(error);
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
  relinka(
    "verbose",
    `[resolve-cross-libs] Resolving target file for ${libName}/${rest}`,
  );

  // Determine extension priority based on current file type
  const isCurrentFileDts = currentFilePath.endsWith(".d.ts");
  const extensions = isCurrentFileDts
    ? [".d.ts", ".ts", ".js"]
    : [".ts", ".js", ".d.ts"];
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
        relinka(
          "internal",
          `[resolve-cross-libs] Found target file: ${fullPath}`,
        );
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
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

// Wrapper function to process all libraries in dist-libs
async function resolveAllCrossLibsViaInline(
  alias = "~",
  subFolders: ("npm" | "jsr")[] = ["npm", "jsr"],
  buildPreExtensions: string[],
  buildTemplatesDir: string,
): Promise<string[]> {
  // relinka("internal", `Starting resolveAllCrossLibsViaInline with alias ${alias}`);
  const distLibsDir = "dist-libs";

  const allModifiedFiles: string[] = [];

  // Process dist-libs first
  const distLibsExists = await directoryExists(distLibsDir);
  if (distLibsExists) {
    const entries = await fs.readdir(distLibsDir, { withFileTypes: true });
    const libDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
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
              const modifiedFiles = await resolveCrossLibsViaInline(
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
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              relinka(
                "error",
                `[resolveAllCrossLibsViaInline] Error processing ${binDir}: ${errorMessage}`,
              );
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
    relinka(
      "info",
      "[resolveAllCrossLibsViaInline] Cross libraries replacements done in:",
    );
    relinka(
      "verbose",
      "[resolveAllCrossLibsViaInline] " + allModifiedFiles.join(", "),
    );
  }

  // relinka(
  //   "internal",
  //   `Completed processing all libraries. Total modified files: ${allModifiedFiles.length}`,
  // );
  return allModifiedFiles;
}

async function resolveCrossLibsViaCopy(
  libBinDir: string,
  alias = "~",
  subFolders: ("npm" | "jsr")[] = ["npm", "jsr"],
  buildPreExtensions: string[],
  buildTemplatesDir: string,
): Promise<string[]> {
  // relinka("internal", `Starting resolveCrossLibsViaCopy for ${libBinDir} with alias ${alias}`);

  // Normalize path separators for cross-platform compatibility
  const normalizedPath = libBinDir.replace(/\\/g, "/");

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

  // For dist-libs, apply the copy-based cross-libs resolution logic
  if (normalizedPath.startsWith("dist-libs")) {
    // Extract current library name from path: dist-libs/sdk/npm/bin -> sdk
    const pathParts = normalizedPath.replace(/\/$/, "").split("/");
    if (pathParts.length < 4) {
      throw new Error(
        `[resolve-cross-libs] Invalid libBinDir structure: ${libBinDir}, expected dist-libs/<lib>/<subfolder>/bin`,
      );
    }
    const currentLib = pathParts[1];
    const currentSubFolder = pathParts[2];
    // relinka("internal", `Processing library: ${currentLib} in subfolder: ${currentSubFolder}`);

    if (!currentLib || !currentSubFolder) {
      throw new Error(
        `[resolve-cross-libs] Invalid libBinDir structure: ${libBinDir}, could not extract library name or subfolder`,
      );
    }

    const files = await findSourceFiles(
      libBinDir,
      buildPreExtensions,
      buildTemplatesDir,
    );
    const modifiedFiles: string[] = [];
    const copiedLibs = new Set<string>();

    await Promise.all(
      files.map(async (filePath) => {
        const content = await fs.readFile(filePath, "utf-8");
        const { processed, copiedLibraries } = await processFileViaCopy(
          content,
          currentLib,
          currentSubFolder,
          alias,
          subFolders,
          filePath,
        );

        if (processed !== content) {
          relinka(
            "verbose",
            `[resolveCrossLibsViaCopy] File modified: ${filePath}`,
          );
          await fs.writeFile(filePath, processed, "utf-8");
          modifiedFiles.push(path.resolve(filePath));
        }

        // Track copied libraries
        copiedLibraries.forEach((lib) => copiedLibs.add(lib));
      }),
    );

    // Copy the actual library directories
    for (const libName of copiedLibs) {
      await copyLibraryDirectory(libName, currentSubFolder, subFolders);
    }

    // relinka("internal", `Completed processing ${modifiedFiles.length} modified files and copied ${copiedLibs.size} libraries`);
    return modifiedFiles;
  }

  return [];
}

async function processFileViaCopy(
  content: string,
  currentLib: string,
  _currentSubFolder: string,
  alias: string,
  _subFolders: ("npm" | "jsr")[],
  _currentFilePath: string,
): Promise<{ processed: string; copiedLibraries: Set<string> }> {
  // relinka("internal", `Processing file for library ${currentLib} with ${content.split("\n").length} lines`);
  const lines = content.split("\n");
  const result: string[] = [];
  const copiedLibraries = new Set<string>();

  for (const line of lines) {
    // Match import/export lines with alias pattern
    const pattern = new RegExp(
      `^(\\s*)((?:export\\s+.*?\\s+from|import\\s+.*?\\s+from)\\s+(['"])${escapeRegex(alias)}/libs/([^/]+)/([^'"]*?)\\3[^;]*;?)(\\s*//.*)?\\s*$`,
    );

    const match = line.match(pattern);

    if (match) {
      const [, indentation, fullStatement, quote, libName, rest, comment] =
        match;
      relinka(
        "verbose",
        `[resolveCrossLibsViaCopy] Processing import/export: ${libName}/${rest}`,
      );

      // Skip if already converted to relative path (idempotent)
      if (fullStatement?.includes(`${quote}./`)) {
        // relinka(
        //   "internal",
        //   `[resolveCrossLibsViaCopy] Skipping already converted import: ${libName}/${rest}`,
        // );
        result.push(line);
        continue;
      }

      if (libName === currentLib) {
        // Same library - rewrite to relative path
        // relinka("internal", `[resolveCrossLibsViaCopy] Converting to relative path: ${libName}/${rest}`);
        const newStatement =
          fullStatement?.replace(
            `${quote}${alias}/libs/${libName}/`,
            `${quote}./`,
          ) ?? "";
        result.push(`${indentation}${newStatement}${comment || ""}`);
      } else {
        // Different library - rewrite to copied directory path
        try {
          if (!libName || !rest) {
            throw new Error("Library name or path is undefined");
          }
          relinka(
            "verbose",
            `[resolveCrossLibsViaCopy] Rewriting to copied path: ${libName}/${rest}`,
          );

          // Mark this library for copying
          copiedLibraries.add(libName);

          // Rewrite the import/export to use the copied directory
          const newStatement =
            fullStatement?.replace(
              `${quote}${alias}/libs/${libName}/`,
              `${quote}../#${libName}/`,
            ) ?? "";
          result.push(`${indentation}${newStatement}${comment || ""}`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          relinka(
            "error",
            `[resolveCrossLibsViaCopy] Failed to rewrite ${alias}/libs/${libName}/${rest}: ${errorMessage}`,
          );
          throw error;
        }
      }
    } else {
      result.push(line);
    }
  }

  return { processed: result.join("\n"), copiedLibraries };
}

async function copyLibraryDirectory(
  libName: string,
  _currentSubFolder: string,
  _subFolders: ("npm" | "jsr")[],
): Promise<void> {
  const sourceDir = path.join("dist-libs", libName);
  const targetDir = path.join("dist-libs", `#${libName}`);

  // Check if already copied
  try {
    await fs.access(targetDir);
    relinka(
      "verbose",
      `[resolveCrossLibsViaCopy] Library ${libName} already copied to ${targetDir}`,
    );
    return;
  } catch {
    // Directory doesn't exist, proceed with copying
  }

  try {
    relinka(
      "log",
      `[resolveCrossLibsViaCopy] Copying library ${libName} from ${sourceDir} to ${targetDir}`,
    );

    // Copy the entire library directory
    await copyDirectoryRecursive(sourceDir, targetDir);

    relinka(
      "verbose",
      `[resolveCrossLibsViaCopy] Successfully copied library ${libName}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `[resolveCrossLibsViaCopy] Failed to copy library ${libName}: ${errorMessage}`,
    );
    throw error;
  }
}

async function copyDirectoryRecursive(
  source: string,
  target: string,
): Promise<void> {
  // Create target directory if it doesn't exist
  await fs.mkdir(target, { recursive: true });

  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

// Wrapper function to process all libraries in dist-libs using copy approach
async function resolveAllCrossLibsViaCopy(
  alias = "~",
  subFolders: ("npm" | "jsr")[] = ["npm", "jsr"],
  buildPreExtensions: string[],
  buildTemplatesDir: string,
): Promise<string[]> {
  // relinka("internal", `Starting resolveAllCrossLibsViaCopy with alias ${alias}`);
  const distLibsDir = "dist-libs";

  const allModifiedFiles: string[] = [];

  // Process dist-libs first
  const distLibsExists = await directoryExists(distLibsDir);
  if (distLibsExists) {
    const entries = await fs.readdir(distLibsDir, { withFileTypes: true });
    const libDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
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
              const modifiedFiles = await resolveCrossLibsViaCopy(
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
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              relinka(
                "error",
                `[resolveAllCrossLibsViaCopy] Error processing ${binDir}: ${errorMessage}`,
              );
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
    relinka(
      "info",
      "[resolveAllCrossLibsViaCopy] Cross libraries copy replacements done in:",
    );
    relinka(
      "verbose",
      "[resolveAllCrossLibsViaCopy] " + allModifiedFiles.join(", "),
    );
  }

  // relinka(
  //   "internal",
  //   `Completed processing all libraries. Total modified files: ${allModifiedFiles.length}`,
  // );
  return allModifiedFiles;
}

// Unified wrapper function that supports all cross-libs resolution strategies
export async function resolveAllCrossLibs(
  strategy: "inline" | "copy" | "package" = "inline",
  alias = "~",
  subFolders: ("npm" | "jsr")[] = ["npm", "jsr"],
  buildPreExtensions: string[],
  buildTemplatesDir: string,
): Promise<string[]> {
  // relinka("internal", `Starting resolveAllCrossLibs with strategy: ${strategy}`);

  switch (strategy) {
    case "inline":
      return await resolveAllCrossLibsViaInline(
        alias,
        subFolders,
        buildPreExtensions,
        buildTemplatesDir,
      );
    case "copy":
      return await resolveAllCrossLibsViaCopy(
        alias,
        subFolders,
        buildPreExtensions,
        buildTemplatesDir,
      );
    case "package":
      return await resolveAllCrossLibsViaPackage(
        alias,
        subFolders,
        buildPreExtensions,
        buildTemplatesDir,
      );
    default:
      throw new Error(
        `[resolveAllCrossLibs] Unknown strategy: ${strategy}. Supported strategies: inline, copy, package`,
      );
  }
}

// Load dler config to get libsList mapping
async function loadReliverseConfig(): Promise<{
  libsList: Record<string, any>;
}> {
  try {
    const jiti = createJiti(import.meta.url);
    const config = (await jiti.import("reliverse.ts", {
      default: true,
    })) as any;
    return { libsList: config?.libsList || {} };
  } catch (error) {
    relinka(
      "error",
      `[resolveCrossLibsViaPackage] Failed to load dler config: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { libsList: {} };
  }
}

// Create reverse mapping from libDirName to package name
function createLibDirToPackageMap(
  libsList: Record<string, any>,
): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const [packageName, libConfig] of Object.entries(libsList)) {
    if (libConfig?.libDirName) {
      mapping[libConfig.libDirName] = packageName;
    }
  }

  return mapping;
}

// Add dependency to package.json
async function addDependencyToPackageJson(
  packageJsonPath: string,
  packageName: string,
  dependencyType: "dependencies" | "devDependencies" = "dependencies",
): Promise<void> {
  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent) as Record<string, any>;

    // Initialize dependency section if it doesn't exist
    if (!packageJson[dependencyType]) {
      packageJson[dependencyType] = {};
    }

    // Add dependency if not already present
    if (!packageJson[dependencyType][packageName]) {
      packageJson[dependencyType][packageName] = "*";
      relinka(
        "log",
        `[resolveCrossLibsViaPackage] Added ${packageName} to ${dependencyType} in ${packageJsonPath}`,
      );

      // Write back to file
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8",
      );
    } else {
      relinka(
        "log",
        `[resolveCrossLibsViaPackage] ${packageName} already exists in ${dependencyType} in ${packageJsonPath}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `[resolveCrossLibsViaPackage] Failed to add dependency ${packageName} to ${packageJsonPath}: ${errorMessage}`,
    );
    throw error;
  }
}

async function resolveCrossLibsViaPackage(
  libBinDir: string,
  alias = "~",
  buildPreExtensions: string[],
  buildTemplatesDir: string,
): Promise<string[]> {
  // relinka("internal", `Starting resolveCrossLibsViaPackage for ${libBinDir} with alias ${alias}`);

  // Normalize path separators for cross-platform compatibility
  const normalizedPath = libBinDir.replace(/\\/g, "/");

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

  // For dist-libs, apply the package-based cross-libs resolution logic
  if (normalizedPath.startsWith("dist-libs")) {
    // Extract current library name from path: dist-libs/sdk/npm/bin -> sdk
    const pathParts = normalizedPath.replace(/\/$/, "").split("/");
    if (pathParts.length < 4) {
      throw new Error(
        `[resolve-cross-libs] Invalid libBinDir structure: ${libBinDir}, expected dist-libs/<lib>/<subfolder>/bin`,
      );
    }
    const currentLib = pathParts[1];
    const currentSubFolder = pathParts[2];
    // relinka("internal", `Processing library: ${currentLib} in subfolder: ${currentSubFolder}`);

    if (!currentLib || !currentSubFolder) {
      throw new Error(
        `[resolve-cross-libs] Invalid libBinDir structure: ${libBinDir}, could not extract library name or subfolder`,
      );
    }

    // Load dler config to get libsList mapping
    const { libsList } = await loadReliverseConfig();
    const libDirToPackageMap = createLibDirToPackageMap(libsList);

    const files = await findSourceFiles(
      libBinDir,
      buildPreExtensions,
      buildTemplatesDir,
    );
    const modifiedFiles: string[] = [];
    const addedDependencies = new Set<string>();

    await Promise.all(
      files.map(async (filePath) => {
        const content = await fs.readFile(filePath, "utf-8");
        const { processed, dependencies } = await processFileViaPackage(
          content,
          currentLib,
          alias,
          libDirToPackageMap,
        );

        if (processed !== content) {
          relinka(
            "verbose",
            `[resolveCrossLibsViaPackage] File modified: ${filePath}`,
          );
          await fs.writeFile(filePath, processed, "utf-8");
          modifiedFiles.push(path.resolve(filePath));
        }

        // Track dependencies to add
        dependencies.forEach((dep) => addedDependencies.add(dep));
      }),
    );

    // Add dependencies to package.json
    const packageJsonPath = path.join(path.dirname(libBinDir), "package.json");
    for (const packageName of addedDependencies) {
      await addDependencyToPackageJson(packageJsonPath, packageName);
    }

    // relinka("internal", `Completed processing ${modifiedFiles.length} modified files and added ${addedDependencies.size} dependencies`);
    return modifiedFiles;
  }

  return [];
}

async function processFileViaPackage(
  content: string,
  currentLib: string,
  alias: string,
  libDirToPackageMap: Record<string, string>,
): Promise<{ processed: string; dependencies: Set<string> }> {
  // relinka("internal", `Processing file for library ${currentLib} with ${content.split("\n").length} lines`);
  const lines = content.split("\n");
  const result: string[] = [];
  const dependencies = new Set<string>();

  for (const line of lines) {
    // Match import/export lines with alias pattern
    const pattern = new RegExp(
      `^(\\s*)((?:export\\s+.*?\\s+from|import\\s+.*?\\s+from)\\s+(['"])${escapeRegex(alias)}/libs/([^/]+)/([^'"]*?)\\3[^;]*;?)(\\s*//.*)?\\s*$`,
    );

    const match = line.match(pattern);

    if (match) {
      const [, indentation, fullStatement, quote, libName, rest, comment] =
        match;
      relinka(
        "verbose",
        `[resolveCrossLibsViaPackage] Processing import/export: ${libName}/${rest}`,
      );

      // Skip if already converted to relative path (idempotent)
      if (fullStatement?.includes(`${quote}./`)) {
        // relinka(
        //   "internal",
        //   `[resolveCrossLibsViaPackage] Skipping already converted import: ${libName}/${rest}`,
        // );
        result.push(line);
        continue;
      }

      if (libName === currentLib) {
        // Same library - rewrite to relative path
        // relinka("internal", `[resolveCrossLibsViaPackage] Converting to relative path: ${libName}/${rest}`);
        const newStatement =
          fullStatement?.replace(
            `${quote}${alias}/libs/${libName}/`,
            `${quote}./`,
          ) ?? "";
        result.push(`${indentation}${newStatement}${comment || ""}`);
      } else {
        // Different library - rewrite to package name
        try {
          if (!libName || !rest) {
            throw new Error("Library name or path is undefined");
          }

          const packageName = libDirToPackageMap[libName];
          if (!packageName) {
            relinka(
              "warn",
              `[resolveCrossLibsViaPackage] No package name found for libDirName: ${libName}`,
            );
            result.push(line);
            continue;
          }

          relinka(
            "log",
            `[resolveCrossLibsViaPackage] Rewriting to package name: ${libName}/${rest} -> ${packageName}`,
          );

          // Mark this package for dependency addition
          dependencies.add(packageName);

          // Rewrite the import/export to use the package name
          const newStatement =
            fullStatement?.replace(
              `${quote}${alias}/libs/${libName}/`,
              `${quote}${packageName}/`,
            ) ?? "";
          result.push(`${indentation}${newStatement}${comment || ""}`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          relinka(
            "error",
            `[resolveCrossLibsViaPackage] Failed to rewrite ${alias}/libs/${libName}/${rest}: ${errorMessage}`,
          );
          throw error;
        }
      }
    } else {
      result.push(line);
    }
  }

  return { processed: result.join("\n"), dependencies };
}

// Wrapper function to process all libraries in dist-libs using package approach
async function resolveAllCrossLibsViaPackage(
  alias = "~",
  subFolders: ("npm" | "jsr")[] = ["npm", "jsr"],
  buildPreExtensions: string[],
  buildTemplatesDir: string,
): Promise<string[]> {
  // relinka("internal", `Starting resolveAllCrossLibsViaPackage with alias ${alias}`);
  const distLibsDir = "dist-libs";

  const allModifiedFiles: string[] = [];

  // Process dist-libs first
  const distLibsExists = await directoryExists(distLibsDir);
  if (distLibsExists) {
    const entries = await fs.readdir(distLibsDir, { withFileTypes: true });
    const libDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
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
              const modifiedFiles = await resolveCrossLibsViaPackage(
                binDir,
                alias,
                buildPreExtensions,
                buildTemplatesDir,
              );
              allModifiedFiles.push(...modifiedFiles);
              // relinka(
              //   "internal",
              //   `Successfully processed ${modifiedFiles.length} files in ${binDir}`,
              // );
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              relinka(
                "error",
                `[resolveAllCrossLibsViaPackage] Error processing ${binDir}: ${errorMessage}`,
              );
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
    relinka(
      "info",
      "[resolveAllCrossLibsViaPackage] Cross libraries package replacements done in:",
    );
    relinka(
      "verbose",
      "[resolveAllCrossLibsViaPackage] " + allModifiedFiles.join(", "),
    );
  }

  // relinka(
  //   "internal",
  //   `Completed processing all libraries. Total modified files: ${allModifiedFiles.length}`,
  // );
  return allModifiedFiles;
}
