import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { selectPrompt } from "@reliverse/rempts";
import pMap from "p-map";

import type {
  DestFileExistsBehaviour,
  FileType,
  InitBehaviour,
  InitFileRequest,
  InitFileResult,
  ReinitUserConfig,
} from "./init-types";

import { FILE_TYPES } from "./init-const";
import { gitignoreTemplate } from "./templates/t-gitignore";
import { licenseTemplate } from "./templates/t-license";
import { readmeTemplate } from "./templates/t-readme";

// Default configuration
const DEFAULT_CONFIG: ReinitUserConfig = {
  defaultInitBehaviour: "create",
  defaultDestFileExistsBehaviour: "prompt",
  parallelByDefault: false,
  parallelConcurrency: 4,
};

/**
 * Cache for file existence checks to reduce filesystem operations
 */
const fileExistsCache = new Map<string, boolean>();

/**
 * Creates a file from scratch, including parent directories,
 * basing the file content on the fileType.
 */
export async function createFileFromScratch(
  destPath: string,
  fileType: FileType,
  contentCreateMode?: string,
): Promise<void> {
  try {
    // Ensure parent directory
    await fs.ensureDir(path.dirname(destPath));

    let content = "";
    switch (fileType) {
      case "md:LICENSE":
        content = licenseTemplate;
        break;
      case "md:README":
        content = escapeMarkdownCodeBlocks(readmeTemplate);
        break;
      case "git:gitignore":
        content = gitignoreTemplate;
        break;
      default:
        content = `// Auto-generated file for type: ${fileType}`;
        break;
    }

    if (contentCreateMode) {
      content = contentCreateMode;
      relinka("verbose", `Using custom content for file ${destPath}`);
    }

    await fs.outputFile(destPath, content, { encoding: "utf-8" });
  } catch (error) {
    relinka("error", `Failed to create file ${destPath}: ${error}`);
    throw error;
  }
}

/**
 * Single-file initialization using the merged config.
 */
export async function initFile(
  req: InitFileRequest,
  userCfg?: Partial<ReinitUserConfig>,
): Promise<InitFileResult> {
  const config = { ...DEFAULT_CONFIG, ...userCfg };
  const initBehaviour = req.initBehaviour ?? config.defaultInitBehaviour;
  const existsBehaviour =
    req.destFileExistsBehaviour ?? config.defaultDestFileExistsBehaviour;

  config.onFileStart?.(req);

  let result: InitFileResult;
  try {
    result = await doInitFile(
      req,
      initBehaviour as InitBehaviour,
      existsBehaviour as DestFileExistsBehaviour,
    );
  } catch (err) {
    result = {
      requested: req,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  config.onFileComplete?.(result);
  return result;
}

/**
 * Multi-file version with parallel processing support.
 */
export async function initFiles(
  items: InitFileRequest[],
  options?: { parallel?: boolean; concurrency?: number },
  userCfg?: Partial<ReinitUserConfig>,
): Promise<InitFileResult[]> {
  const config = { ...DEFAULT_CONFIG, ...userCfg };
  const parallel = options?.parallel ?? config.parallelByDefault;
  const concurrency = options?.concurrency ?? config.parallelConcurrency;

  if (parallel) {
    return pMap(items, (item) => initFile(item, config), { concurrency });
  }

  return Promise.all(items.map((item) => initFile(item, config)));
}

/**
 * Checks if a file exists with caching
 */
async function checkFileExists(filePath: string): Promise<boolean> {
  const cached = fileExistsCache.get(filePath);
  if (cached !== undefined) {
    return cached;
  }

  const exists = await fs.pathExists(filePath);
  fileExistsCache.set(filePath, exists);
  return exists;
}

/**
 * The main logic for creating or copying a file.
 */
async function doInitFile(
  req: InitFileRequest,
  initBehaviour: InitBehaviour,
  destFileExistsBehaviour: DestFileExistsBehaviour,
): Promise<InitFileResult> {
  const { fileType, destDir, options } = req;
  const { destFileName } = options ?? {};

  // Look up known variations for the fileType
  const knownType = FILE_TYPES.find(
    (f) => f.type.toLowerCase() === fileType.toLowerCase(),
  );

  if (!knownType) {
    throw new Error(`Unknown file type: ${fileType}`);
  }

  const variations = knownType.variations;

  // Possibly prompt if multiple variations exist
  const chosenVariation =
    variations.length === 1
      ? variations[0]
      : await selectPrompt({
          title: `Select variation for ${fileType}`,
          options: variations.map((v) => ({ label: v, value: v })),
        });

  const finalName = destFileName ?? chosenVariation;

  // Convert destDir to absolute path
  const absoluteDestDir = path.resolve(process.cwd(), destDir || "");
  const resolvedDestPath = path.join(absoluteDestDir, finalName);

  relinka(
    "verbose",
    `Preparing to init file:
  - File Type: ${fileType}
  - Variation: ${chosenVariation}
  - Destination Dir: ${absoluteDestDir}
  - Final Path: ${resolvedDestPath}
  `,
  );

  // Check if file exists (with caching)
  const alreadyExists = await checkFileExists(resolvedDestPath);
  if (alreadyExists) {
    const maybeNewDest = await handleExistingFile(
      resolvedDestPath,
      destFileExistsBehaviour,
    );

    if (!maybeNewDest) {
      return { requested: req, status: "skipped" };
    }

    if (maybeNewDest !== resolvedDestPath) {
      relinka("log", `Using new path: ${maybeNewDest}`);
      return finalizeInit(req, initBehaviour, chosenVariation, maybeNewDest);
    }
  }

  return finalizeInit(req, initBehaviour, chosenVariation, resolvedDestPath);
}

/**
 * Handles file initialization after path resolution
 */
async function finalizeInit(
  req: InitFileRequest,
  initBehaviour: InitBehaviour,
  chosenVariation: string,
  resolvedDestPath: string,
): Promise<InitFileResult> {
  try {
    switch (initBehaviour) {
      case "copy":
        return await runCopy(req, chosenVariation, resolvedDestPath);
      case "create":
        return await runCreate(req, resolvedDestPath);
      default:
        try {
          return await runCopy(req, chosenVariation, resolvedDestPath);
        } catch {
          relinka(
            "warn",
            `Copy failed for ${chosenVariation}, falling back to create...`,
          );
          return await runCreate(req, resolvedDestPath);
        }
    }
  } catch (err) {
    return {
      requested: req,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runCopy(
  req: InitFileRequest,
  chosenVariation: string,
  resolvedDestPath: string,
): Promise<InitFileResult> {
  const { srcCopyMode, fallbackSource } = req.options ?? {};
  const resolvedSrcDir = path.resolve(process.cwd(), srcCopyMode || "");

  try {
    const srcPath = path.join(resolvedSrcDir, chosenVariation);
    if (await checkFileExists(srcPath)) {
      await fs.copy(srcPath, resolvedDestPath);
      return {
        requested: req,
        finalPath: resolvedDestPath,
        status: "copied",
      };
    }

    if (fallbackSource) {
      const fallbackPath = path.join(
        path.resolve(process.cwd(), fallbackSource),
        chosenVariation,
      );
      if (await checkFileExists(fallbackPath)) {
        await fs.copy(fallbackPath, resolvedDestPath);
        return {
          requested: req,
          finalPath: resolvedDestPath,
          status: "copied",
        };
      }
    }

    throw new Error(`Source file not found: ${chosenVariation}`);
  } catch (error) {
    throw new Error(
      `Copy failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function runCreate(
  req: InitFileRequest,
  resolvedDestPath: string,
): Promise<InitFileResult> {
  try {
    const { contentCreateMode } = req.options ?? {};
    await createFileFromScratch(
      resolvedDestPath,
      req.fileType,
      contentCreateMode,
    );
    return {
      requested: req,
      finalPath: resolvedDestPath,
      status: "created",
    };
  } catch (error) {
    throw new Error(
      `Create failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleExistingFile(
  destPath: string,
  behaviour: DestFileExistsBehaviour,
): Promise<string | null> {
  switch (behaviour) {
    case "rewrite":
      return destPath;
    case "skip":
      return null;
    case "attach-index":
      return attachIndex(destPath);
    case "prompt": {
      const action = await selectPrompt({
        title: `File ${destPath} already exists`,
        options: [
          { label: "Skip", value: "skip" },
          { label: "Rewrite", value: "rewrite" },
          { label: "Attach Index", value: "attach-index" },
        ],
      });
      switch (action) {
        case "skip":
          return null;
        case "rewrite":
          return destPath;
        case "attach-index":
          return attachIndex(destPath);
        default:
          return null;
      }
    }
  }
}

async function attachIndex(originalPath: string): Promise<string> {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const base = path.basename(originalPath, ext);
  let index = 1;
  let newPath: string;

  do {
    newPath = path.join(dir, `${base}-${index}${ext}`);
    index++;
  } while (await checkFileExists(newPath));

  return newPath;
}

/**
 * Escapes custom markdown code blocks (''' → ```).
 * Useful for safely embedding markdown in template literals.
 */
export function escapeMarkdownCodeBlocks(input: string): string {
  return input.replace(/'''/g, "```");
}
