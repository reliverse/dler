import path from "@reliverse/pathkit";
import { defineCommand } from "@reliverse/rempts";
import { createJiti } from "jiti";
import { promises as fs } from "node:fs";

import type { TemplatesFileContent } from "~/libs/sdk/sdk-impl/utils/pack-unpack/pu-types";

import { TPLS_DIR, BINARIES_DIR } from "~/libs/sdk/sdk-impl/utils/pack-unpack/pu-constants";

const jiti = createJiti(import.meta.url);

async function removeEmptyDirs(dirPath: string): Promise<void> {
  if (
    !(await fs
      .access(dirPath)
      .then(() => true)
      .catch(() => false))
  )
    return;

  const entries = await fs.readdir(dirPath);
  if (entries.length === 0) {
    await fs.rmdir(dirPath);
    // Process parent directory
    const parentDir = path.dirname(dirPath);
    if (parentDir !== dirPath) {
      // Prevent infinite recursion at root
      await removeEmptyDirs(parentDir);
    }
  }
}

async function cleanupTemplateFiles(
  templatesDir: string,
  templatesDirName: string,
  dryRun: boolean,
): Promise<void> {
  const modFile = `${templatesDirName}-mod.ts`;
  const typesFile = `${templatesDirName}-types.ts`;
  const implDir = path.join(templatesDir, TPLS_DIR);
  const binariesDir = path.join(implDir, BINARIES_DIR);

  const filesToRemove = [path.join(templatesDir, modFile), path.join(templatesDir, typesFile)];

  // Get all template files
  try {
    const templateFiles = await fs.readdir(implDir);
    for (const file of templateFiles) {
      if (file.endsWith(".ts")) {
        filesToRemove.push(path.join(implDir, file));
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  // Remove files
  for (const file of filesToRemove) {
    if (dryRun) {
      console.log(`[DRY RUN] Would remove: ${file}`);
      continue;
    }

    try {
      await fs.unlink(file);
      console.log(`Removed: ${file}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`Failed to remove ${file}: ${(error as Error).message}`);
      }
    }
  }

  // Remove binaries directory if it exists
  try {
    if (
      await fs
        .access(binariesDir)
        .then(() => true)
        .catch(() => false)
    ) {
      if (dryRun) {
        console.log(`[DRY RUN] Would remove directory: ${binariesDir}`);
      } else {
        await fs.rm(binariesDir, { recursive: true });
        console.log(`Removed directory: ${binariesDir}`);
      }
    }
  } catch (error) {
    console.warn(`Failed to remove binaries directory: ${(error as Error).message}`);
  }

  // Remove implementation directory if empty
  await removeEmptyDirs(implDir);

  // Remove templates directory if empty
  await removeEmptyDirs(templatesDir);
}

export default defineCommand({
  meta: {
    name: "unpack",
    version: "1.1.0",
    description: "Creates file structure from packed templates",
  },
  args: {
    templatesDir: { type: "positional", required: true, description: "Dir containing mod.ts" },
    output: { type: "string", default: "unpacked", description: "Where to write files" },
    cdn: {
      type: "string",
      description: "Remote CDN base for binary assets download (not yet implemented)",
    },
    cleanup: {
      type: "boolean",
      description: "Clean up template files before unpacking",
      default: false,
    },
    "dry-run": {
      type: "boolean",
      description: "Preview changes without applying them",
      default: false,
    },
  },
  async run({ args }) {
    if (args.cdn) throw new Error("Remote CDN support is not implemented yet.");

    const templatesDir = path.resolve(args.templatesDir);
    const templatesDirName = path.basename(templatesDir);
    const modFile = `${templatesDirName}-mod.ts`;
    const modPath = path.join(templatesDir, modFile);

    // Cleanup if requested
    if (args.cleanup) {
      await cleanupTemplateFiles(templatesDir, templatesDirName, args["dry-run"]);
      if (args["dry-run"]) {
        console.log("[DRY RUN] Cleanup completed");
        return;
      }
    }

    const mod = await jiti.import<{
      DLER_TEMPLATES?: Record<string, any>;
      default?: Record<string, any>;
    }>(modPath);

    const templatesObj =
      mod?.DLER_TEMPLATES ||
      mod?.default ||
      (() => {
        throw new Error(`Invalid ${modFile}`);
      })();

    for (const tpl of Object.values(templatesObj) as any) {
      await restoreTemplate(tpl, templatesDir, args.output);
    }

    const relativeOutput = path.relative(process.cwd(), args.output);
    console.log(
      `Unpacked ${Object.keys(templatesObj).length} templates from ${modFile} into ${relativeOutput}`,
    );
  },
});

const restoreTemplate = async (
  tpl: {
    name: string;
    config: { files: Record<string, TemplatesFileContent> };
  },
  templatesRoot: string,
  outRoot: string,
) => {
  for (const [rel, meta] of Object.entries(tpl.config.files)) {
    const destAbs = path.join(outRoot, rel);
    await fs.mkdir(path.dirname(destAbs), { recursive: true });

    switch (meta.type) {
      case "binary": {
        if (!meta.binaryHash) {
          await fs.writeFile(destAbs, "");
          break;
        }
        const ext = path.extname(rel);
        const binPath = path.join(
          templatesRoot,
          TPLS_DIR,
          BINARIES_DIR,
          `${meta.binaryHash}${ext}`,
        );
        await fs.copyFile(binPath, destAbs);
        break;
      }

      case "text": {
        await fs.writeFile(destAbs, meta.content as string, "utf8");
        break;
      }

      case "json": {
        const txt = JSON.stringify(meta.content, null, 2);
        const withComments = meta.jsonComments ? injectComments(txt, meta.jsonComments) : txt;
        await fs.writeFile(destAbs, withComments, "utf8");
        break;
      }
    }
  }
};

const injectComments = (json: string, comments: Record<number, string>) => {
  const lines = json.split("\n");
  const entries = Object.entries(comments)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => a[0] - b[0]);

  let offset = 0;
  for (const [ln, comment] of entries) {
    const idx = ln - 1 + offset;
    const indent = lines[idx]?.match(/^\s*/)?.[0] ?? "";
    const block = comment.split("\n").map((l) => indent + l);
    lines.splice(idx, 0, ...block);
    offset += block.length;
  }
  return lines.join("\n") + "\n";
};
