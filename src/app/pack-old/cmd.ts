import path from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import { createJiti } from "jiti";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";

import type {
  TemplatesFileContent,
  FileMetadata,
} from "~/libs/sdk/sdk-impl/utils/pack-unpack-old/pu-types";

import {
  WHITELABEL_DEFAULT,
  TEMPLATE_VAR,
  TPLS_DIR,
  BINARIES_DIR,
} from "~/libs/sdk/sdk-impl/utils/pack-unpack-old/pu-constants";
import {
  escapeTemplateString,
  readFileForTemplate,
  walkDir,
} from "~/libs/sdk/sdk-impl/utils/pack-unpack-old/pu-file-utils";

const jiti = createJiti(import.meta.url);

const hashFile = async (file: string): Promise<string> => {
  const buff = await fs.readFile(file);
  return createHash("sha1").update(buff).digest("hex").slice(0, 10);
};

const getFileMetadata = async (file: string): Promise<FileMetadata> => {
  const stats = await fs.stat(file);
  const hash = await hashFile(file);
  return {
    updatedAt: stats.mtime.toISOString(),
    updatedHash: hash,
  };
};

export default defineCommand({
  meta: {
    name: "pack",
    version: "1.1.0",
    description: "Packs a directory of templates into TS modules",
  },
  args: defineArgs({
    dir: { type: "positional", required: true, description: "Directory to process" },
    output: { type: "string", default: "my-templates", description: "Output dir" },
    whitelabel: { type: "string", default: WHITELABEL_DEFAULT, description: "Rename DLER" },
    cdn: {
      type: "string",
      description: "Remote CDN for binary assets upload (not yet implemented)",
    },
    force: { type: "boolean", default: false, description: "Force overwrite existing files" },
    update: {
      type: "boolean",
      default: true,
      description: "Update existing templates and add new ones if needed (default: true)",
    },
    /**
     * - Without --files: All files are checked and updated if they're newer or have different content
     * - With --files: Only specified files are checked and updated if they're newer or have different content
     */
    files: {
      type: "string",
      description: "Comma-separated list of specific files to update (relative to template dir)",
    },
    lastUpdate: {
      type: "string",
      description: "Override lastUpdate timestamp (format: 2025-06-06T14:33:09.240Z)",
    },
  }),
  async run({ args }) {
    if (args.cdn) throw new Error("Remote CDN support is not implemented yet.");

    const dirToProcess = path.resolve(args.dir);
    const outDir = path.resolve(args.output);
    const outDirName = path.basename(outDir);
    const typesFile = `${outDirName}-types.ts`;
    const modFile = `${outDirName}-mod.ts`;

    // Parse files to update if specified
    const filesToUpdate = args.files ? new Set(args.files.split(",").map((f) => f.trim())) : null;

    // Check if output directory exists and handle accordingly
    let existingTemplates: Record<string, any> = {};
    try {
      const files = await fs.readdir(outDir);
      if (files.length > 0) {
        if (!args.force && !args.update) {
          relinka("error", `Error: Output directory '${outDir}' already exists and is not empty.`);
          relinka(
            "error",
            "Use --force to overwrite all files or --update to update existing templates.",
          );
          process.exit(1);
        }

        if (args.update) {
          // Load existing templates for update mode
          try {
            const modPath = path.join(outDir, modFile);
            const mod = await jiti.import<{
              DLER_TEMPLATES?: Record<string, any>;
              default?: Record<string, any>;
            }>(modPath);
            existingTemplates = mod?.DLER_TEMPLATES || mod?.default || {};
          } catch (loadError) {
            relinka(
              "warn",
              `Warning: Could not load existing templates from ${modFile}. Will create new ones.`,
            );
            relinka("log", `Error details: ${(loadError as Error).message}`);
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      // Directory doesn't exist, which is fine
    }

    await fs.mkdir(path.join(outDir, TPLS_DIR), { recursive: true });

    const templateDirs = (await fs.readdir(dirToProcess, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    // Create types.ts file if it doesn't exist
    try {
      await fs.access(path.join(outDir, typesFile));
    } catch {
      const typesContent = `export type FileContent = string | Record<string, unknown>;

export interface FileMetadata {
  updatedAt?: string;
  updatedHash?: string;
}

export interface TemplatesFileContent {
  content: FileContent;
  type: "text" | "json" | "binary";
  hasError?: boolean;
  error?: string;
  jsonComments?: Record<number, string>;
  binaryHash?: string;
  metadata?: FileMetadata;
}

export interface TemplateConfig {
  files: Record<string, TemplatesFileContent>;
}

export interface Template {
  name: string;
  description: string;
  config: TemplateConfig;
  updatedAt?: string;
}

export interface Templates extends Record<string, Template> {}
`;
      await fs.writeFile(path.join(outDir, typesFile), typesContent);
    }

    const aggregatedImports: string[] = [];
    const aggregatedEntries: string[] = [];
    const mapEntries: string[] = [];

    for (const tplName of templateDirs) {
      const absTplDir = path.join(dirToProcess, tplName);
      const allFiles = await walkDir(absTplDir);
      const filesRecord: Record<string, TemplatesFileContent> = {};

      // Get existing template if in update mode
      const existingTemplate = args.update ? existingTemplates[tplName] : null;
      const existingFiles = existingTemplate?.config?.files || {};

      for (const absFile of allFiles) {
        const rel = path.relative(dirToProcess, absFile).replace(/\\/g, "/");

        // Skip if we're only updating specific files and this isn't one of them
        if (filesToUpdate && !filesToUpdate.has(rel)) {
          if (existingFiles[rel]) {
            filesRecord[rel] = existingFiles[rel];
          }
          continue;
        }

        const fileMetadata = await getFileMetadata(absFile);
        const existingFile = existingFiles[rel];
        const existingMetadata = existingFile?.metadata;

        // Skip if file hasn't changed (same hash) or if source file is older
        if (
          existingMetadata &&
          (existingMetadata.updatedHash === fileMetadata.updatedHash ||
            fileMetadata.updatedAt <= existingMetadata.updatedAt)
        ) {
          filesRecord[rel] = existingFile;
          continue;
        }

        const meta = await readFileForTemplate(absFile);

        if (meta.type === "binary") {
          const hash = await hashFile(absFile);
          const ext = path.extname(absFile);
          const binariesDir = path.join(outDir, TPLS_DIR, BINARIES_DIR);
          const target = path.join(binariesDir, `${hash}${ext}`);

          await fs.mkdir(binariesDir, { recursive: true });

          try {
            await fs.access(target);
          } catch {
            await fs.copyFile(absFile, target);
          }

          filesRecord[rel] = {
            type: "binary",
            content: "",
            binaryHash: hash,
            metadata: fileMetadata,
          };
          continue;
        }

        // json post-processing
        if (meta.type === "json") {
          // no side-effect additions here; we'll add type satisfaction annotation in code generation only
        }

        filesRecord[rel] = {
          ...meta,
          metadata: fileMetadata,
        };
      }

      /** ---------- emit template module ---------- */
      const varName = TEMPLATE_VAR(tplName, args.whitelabel);
      const code: string[] = [];

      // Check if we need to import PackageJson or TSConfig
      const hasPackageJson = Object.values(filesRecord).some(
        (f) =>
          f.type === "json" && f.content && typeof f.content === "object" && "name" in f.content,
      );
      const hasTSConfig = Object.values(filesRecord).some(
        (f) =>
          f.type === "json" &&
          f.content &&
          typeof f.content === "object" &&
          "compilerOptions" in f.content,
      );

      if (hasPackageJson || hasTSConfig) {
        const t: string[] = [];
        if (hasPackageJson) t.push("PackageJson");
        if (hasTSConfig) t.push("TSConfig");
        code.push(`import type { ${t.join(", ")} } from "pkg-types";`);
        code.push("", `import type { Template } from "../${typesFile}";`);
      } else {
        code.push(`import type { Template } from "../${typesFile}";`);
      }
      code.push(""); // blank line after imports
      code.push(`export const ${varName}: Template = {`);
      code.push(`  name: "${tplName}",`);
      code.push(`  description: "Template generated from ${allFiles.length} files",`);
      code.push(`  updatedAt: "${new Date().toISOString()}",`);
      code.push("  config: {");
      code.push("    files: {");

      const fileEntries = Object.entries(filesRecord);
      fileEntries.forEach(([rel, meta], index) => {
        const isLast = index === fileEntries.length - 1;
        code.push(`      "${rel}": {`);
        if (meta.jsonComments)
          code.push(`        jsonComments: ${JSON.stringify(meta.jsonComments, null, 2)},`);
        if (meta.metadata) {
          const metadataStr = JSON.stringify(meta.metadata, null, 2)
            .replace(/^/gm, "        ")
            .replace(/^ {7} {/m, " {")
            .replace(/^ {8}}/m, "        }")
            .replace(/"([a-zA-Z0-9_]+)":/g, "$1:")
            .replace(/}$/m, "},");
          code.push(`        metadata:${metadataStr}`);
        }
        if (meta.type === "binary") {
          code.push(`        content: "",`);
          code.push(`        type: "binary",`);
          code.push(`        binaryHash: "${meta.binaryHash}",`);
        } else if (meta.type === "text") {
          code.push(`        content: \`${escapeTemplateString(meta.content as string)}\`,`);
          code.push('        type: "text",');
        } else {
          let clone: Record<string, unknown>;
          let sat = "";

          try {
            // Create a deep clone to avoid readonly property issues
            clone = JSON.parse(JSON.stringify(meta.content)) as Record<string, unknown>;

            if (rel.endsWith("package.json")) {
              sat = " satisfies PackageJson";
            } else if (rel.endsWith("tsconfig.json")) {
              sat = " satisfies TSConfig";
            }
          } catch (error) {
            clone = {};
            relinka("error", `Failed to process JSON content for ${rel}: ${error}`);
          }

          const jsonStr = JSON.stringify(
            clone,
            (key, value) => {
              // If key is a single word without special characters, return it without quotes
              if (typeof key === "string" && /^[a-zA-Z0-9_]+$/.test(key)) {
                return value;
              }
              return value;
            },
            2,
          )
            .split("\n")
            .map((line, i) => {
              if (i === 0) return line;
              // Remove quotes from single-word property names and reduce indentation by 2 spaces
              return "        " + line.replace(/"([a-zA-Z0-9_]+)":/g, "$1:");
            })
            .join("\n")
            .replace(/,?\s*}(\s*)$/, "}$1") // Remove any trailing comma before closing brace, don't add one
            .replace(/,\s*,/g, ","); // Remove double commas
          code.push(`        content: ${jsonStr}${sat},`);
          code.push('        type: "json",');
        }
        if (meta.hasError) {
          code.push("        hasError: true,");
          if (meta.error) {
            code.push(`        error: "${escapeTemplateString(meta.error)}",`);
          }
        }
        code.push(`      }${isLast ? "," : ","}`);
      });

      code.push("    },");
      code.push("  },");
      code.push("};");
      code.push(""); // Add blank line at the end

      const templatePath = path.join(outDir, TPLS_DIR, `${tplName}.ts`);

      // In update mode, check if template exists and has conflicts
      if (args.update && existingTemplates[tplName]) {
        try {
          const existingContent = await fs.readFile(templatePath, "utf8");
          const newContent = code.join("\n");

          if (existingContent !== newContent) {
            if (filesToUpdate) {
              relinka("log", `Updating specific files in template: ${tplName}`);
            } else {
              relinka("log", `Updating template: ${tplName}`);
            }
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
          }
          relinka("log", `Creating new template: ${tplName}`);
        }
      } else if (!args.update) {
        relinka("log", `Creating template: ${tplName}`);
      }

      // Log files with errors
      const filesWithErrors = Object.entries(filesRecord).filter(([_, meta]) => meta.hasError);
      if (filesWithErrors.length > 0) {
        relinka("warn", `Template ${tplName} has files with errors:`);
        for (const [file, meta] of filesWithErrors) {
          relinka("warn", `  - ${file}: ${meta.error || "Unknown error"}`);
        }
      }

      await fs.writeFile(templatePath, code.join("\n"));

      /** aggregate */
      aggregatedImports.push(`import { ${varName} } from "./${TPLS_DIR}/${tplName}";`);
      aggregatedEntries.push(`  ${tplName}: ${varName},`);
      mapEntries.push(`  ${varName}: "${tplName}",`);
    }

    /** ---------- aggregator ---------- */
    const WL = args.whitelabel.toUpperCase();
    const mod = [
      ...aggregatedImports,
      "",
      `const ${WL}_TEMPLATES_OBJ = {`,
      ...aggregatedEntries,
      "};",
      "",
      `export const ${WL}_TEMPLATES = ${WL}_TEMPLATES_OBJ as const;`,
      "",
      `export interface ${WL}_TEMPLATE_NAMES extends keyof typeof ${WL}_TEMPLATES {}`,
      "",
      `export const dlerTemplatesMap: Record<string, ${WL}_TEMPLATE_NAMES> = {`,
      ...mapEntries,
      "};",
    ];
    await fs.writeFile(path.join(outDir, modFile), mod.join("\n") + "\n");

    const templatePaths = templateDirs.map((tpl) =>
      path.relative(process.cwd(), path.join(outDir, TPLS_DIR, `${tpl}.ts`)),
    );
    relinka("log", `Packed ${templateDirs.length} templates into ${modFile}:`);
    for (const p of templatePaths) {
      relinka("log", `- ${p}`);
    }
  },
});
