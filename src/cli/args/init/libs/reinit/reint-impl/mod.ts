import fs from "fs-extra";
import path from "pathe";
import pMap from "p-map";
import { loadConfig } from "c12";
import { relinka, selectPrompt } from "@reliverse/prompts";
import type {
  DestFileExistsBehaviour,
  FileType,
  InitBehaviour,
  InitFileRequest,
  InitFileResult,
  ReinitUserConfig,
} from "./types.js";
import { FILE_TYPES } from "./const.js";
import { escapeMarkdownCodeBlocks } from "./utils.js";
import { licenseTemplate } from "./templates/t-license.js";
import { readmeTemplate } from "./templates/t-readme.js";
import { gitignoreTemplate } from "./templates/t-gitignore.js";

/**
 * Creates a file from scratch, including parent directories,
 * basing the file content on the fileType.
 */
export async function createFileFromScratch(
  destPath: string,
  fileType: FileType, // e.g. "cfg:eslint", "md:LICENSE", "md:README", ...
  contentCreateMode?: string,
) {
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
    relinka("info-verbose", `Using custom content for file ${destPath}`);
  }

  await fs.outputFile(destPath, content, { encoding: "utf-8" });
}

/**
 * Loads user config from `reinit.config.(ts|js|json...)` using c12
 * and merges with fallback defaults.
 */
async function loadReinitConfig(): Promise<ReinitUserConfig> {
  const { config } = await loadConfig<ReinitUserConfig>({
    name: "reinit",
    defaults: {},
    overrides: {},
    dotenv: false,
    packageJson: false,
  });

  const merged: ReinitUserConfig = {
    defaultInitBehaviour: config.defaultInitBehaviour ?? "create",
    defaultDestFileExistsBehaviour:
      config.defaultDestFileExistsBehaviour ?? "prompt",
    parallelByDefault: config.parallelByDefault ?? false,
    parallelConcurrency: config.parallelConcurrency ?? 4,
    onFileStart: config.onFileStart,
    onFileComplete: config.onFileComplete,
  };
  return merged;
}

/**
 * Single-file initialization using the merged config.
 */
export async function initFile(
  req: InitFileRequest,
  userCfg?: ReinitUserConfig,
): Promise<InitFileResult> {
  const config = userCfg ?? (await loadReinitConfig());
  const initBehaviour = req.initBehaviour ?? config.defaultInitBehaviour!;
  const existsBehaviour =
    req.destFileExistsBehaviour ?? config.defaultDestFileExistsBehaviour!;

  config.onFileStart?.(req);

  let result: InitFileResult;
  try {
    result = await doInitFile(req, initBehaviour, existsBehaviour);
  } catch (error) {
    result = {
      requested: req,
      status: "error",
      error,
    };
  }

  config.onFileComplete?.(result);
  return result;
}

/**
 * Multi-file version. By default, uses the "parallelByDefault" from config.
 * If parallel is true, uses p-map with concurrency from "parallelConcurrency".
 */
export async function initFiles(
  items: InitFileRequest[],
  options?: { parallel?: boolean; concurrency?: number },
  userCfg?: ReinitUserConfig,
): Promise<InitFileResult[]> {
  const config = userCfg ?? (await loadReinitConfig());

  const parallel =
    typeof options?.parallel === "boolean"
      ? options.parallel
      : config.parallelByDefault;

  const concurrency = options?.concurrency ?? config.parallelConcurrency ?? 4;

  if (parallel) {
    return pMap(items, (item) => initFile(item, config), { concurrency });
  } else {
    const results: InitFileResult[] = [];
    for (const item of items) {
      results.push(await initFile(item, config));
    }
    return results;
  }
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
  const { destFileName, srcCopyMode, fallbackSource } = options ?? {};

  // Look up known variations for the fileType
  const knownType = FILE_TYPES.find(
    (f) => f.type.toLowerCase() === fileType.toLowerCase(),
  );
  const variations = knownType ? knownType.variations : [fileType];

  // Possibly prompt if multiple variations exist
  let chosenVariation: string;
  if (variations.length === 1) {
    chosenVariation = variations[0];
  } else {
    chosenVariation = await selectPrompt({
      title: `Select variation for ${fileType}`,
      options: variations.map((v) => ({ label: v, value: v })),
    });
  }

  const finalName = destFileName ?? chosenVariation;

  // Convert destDir to absolute path
  const absoluteDestDir = path.resolve(process.cwd(), destDir || "");
  const resolvedDestPath = path.join(absoluteDestDir, finalName);

  relinka(
    "info-verbose",
    `Preparing to init file:
  - File Type: ${fileType}
  - Variation: ${chosenVariation}
  - Destination Dir: ${absoluteDestDir}
  - Final Path: ${resolvedDestPath}
  `,
  );

  // If file already exists
  const alreadyExists = await fs.pathExists(resolvedDestPath);
  if (alreadyExists) {
    const maybeNewDest = await handleExistingFile(
      resolvedDestPath,
      destFileExistsBehaviour,
    );
    if (!maybeNewDest) {
      return {
        requested: req,
        status: "skipped",
      };
    }
    if (maybeNewDest !== resolvedDestPath) {
      // e.g., attach-index was chosen
      relinka("info", `attach-index or rename => ${maybeNewDest}`);
      return await finalizeInit(
        req,
        initBehaviour,
        chosenVariation,
        maybeNewDest,
      );
    }
  }

  return await finalizeInit(
    req,
    initBehaviour,
    chosenVariation,
    resolvedDestPath,
  );
}

/** Reusable helper to finalize creation or copy after we pick a path. */
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
      // If user or config explicitly sets "create-if-copy-failed" or something else
      case "create-if-copy-failed":
      default:
        try {
          return await runCopy(req, chosenVariation, resolvedDestPath);
        } catch (err) {
          relinka(
            "warn",
            `Copy failed for ${chosenVariation}, fallback to create...`,
          );
          return await runCreate(req, resolvedDestPath);
        }
    }
  } catch (error) {
    throw error;
  }
}

async function runCopy(
  req: InitFileRequest,
  chosenVariation: string,
  resolvedDestPath: string,
): Promise<InitFileResult> {
  const { srcCopyMode, fallbackSource } = req.options ?? {};
  const resolvedSrcDir = path.resolve(process.cwd(), srcCopyMode || "");
  const sourcePath = path.join(resolvedSrcDir, chosenVariation);

  if (sourcePath === resolvedDestPath) {
    relinka(
      "warn",
      `Source path equals destination => doing a no-op: ${sourcePath}`,
    );
    return {
      requested: req,
      finalPath: resolvedDestPath,
      status: "copied",
    };
  }

  relinka(
    "info",
    `Attempting copy:
  - Source Dir: ${resolvedSrcDir}
  - Source Path: ${sourcePath}
  - Destination Path: ${resolvedDestPath}
  `,
  );

  try {
    await fs.ensureDir(path.dirname(resolvedDestPath));

    if (!(await fs.pathExists(sourcePath))) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }
    await fs.copy(sourcePath, resolvedDestPath, { overwrite: true });
    relinka("info", `Copied file: ${chosenVariation} -> ${resolvedDestPath}`);
    return {
      requested: req,
      finalPath: resolvedDestPath,
      status: "copied",
    };
  } catch (primaryErr) {
    if (fallbackSource) {
      relinka(
        "warn",
        `Primary copy failed, trying fallback: ${fallbackSource}`,
      );
      const fallbackFullPath = path.join(resolvedSrcDir, fallbackSource);
      try {
        await fs.ensureDir(path.dirname(resolvedDestPath));
        if (!(await fs.pathExists(fallbackFullPath))) {
          throw new Error(
            `Fallback source file not found: ${fallbackFullPath}`,
          );
        }
        await fs.copy(fallbackFullPath, resolvedDestPath, { overwrite: true });
        relinka(
          "info",
          `Fallback copy: ${fallbackSource} -> ${resolvedDestPath}`,
        );
        return {
          requested: req,
          finalPath: resolvedDestPath,
          status: "copied",
        };
      } catch (fallbackErr) {
        throw new Error(
          `Primary copy error: ${String(primaryErr)}\nFallback copy error: ${String(
            fallbackErr,
          )}`,
        );
      }
    }
    throw primaryErr;
  }
}

async function runCreate(
  req: InitFileRequest,
  resolvedDestPath: string,
): Promise<InitFileResult> {
  relinka("info-verbose", `Creating file from scratch at: ${resolvedDestPath}`);

  // The "fileType" is used to decide how to create content inside `createFileFromScratch`
  const { fileType } = req;

  await createFileFromScratch(resolvedDestPath, fileType);
  relinka("info-verbose", `Created file from scratch: ${resolvedDestPath}`);
  return {
    requested: req,
    finalPath: resolvedDestPath,
    status: "created",
  };
}

/** If file exists, handle rewrite, skip, attach-index, or prompt. */
async function handleExistingFile(
  destPath: string,
  behaviour: DestFileExistsBehaviour,
): Promise<string | null> {
  switch (behaviour) {
    case "rewrite":
      relinka("warn", `File exists, rewriting in-place: ${destPath}`);
      return destPath;

    case "skip":
      relinka("warn", `File exists, skipping: ${destPath}`);
      return null;

    case "attach-index":
      return attachIndex(destPath);

    case "prompt":
      const choice = await selectPrompt({
        title: `File exists: ${path.basename(destPath)}. How to handle?`,
        options: [
          { label: "Overwrite", value: "overwrite" },
          { label: "Skip", value: "skip" },
          { label: "Attach Index", value: "attachIndex" },
        ],
      });
      if (choice === "skip") return null;
      if (choice === "attachIndex") {
        return attachIndex(destPath);
      }
      relinka("warn", `Overwriting in-place: ${destPath}`);
      return destPath;
  }
}

/** For attach-index, do file.1.ext, file.2.ext, etc. */
async function attachIndex(originalPath: string) {
  const ext = path.extname(originalPath);
  const base = path.basename(originalPath, ext);
  const dir = path.dirname(originalPath);

  let counter = 1;
  let newPath = originalPath;
  while (await fs.pathExists(newPath)) {
    newPath = path.join(dir, `${base}.${counter}${ext}`);
    counter++;
  }
  relinka("info", `Attaching index => ${newPath}`);
  return newPath;
}
