import { defineCommand } from "@reliverse/rempts";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { TemplatesFileContent } from "~/libs/sdk/sdk-impl/utils/pack-unpack/pu-types";

import {
  WHITELABEL_DEFAULT,
  TEMPLATE_VAR,
  IMPL_DIR,
  BINARIES_DIR,
  TYPES_FILE,
  AGGREGATOR_FILE,
} from "~/libs/sdk/sdk-impl/utils/pack-unpack/pu-constants";
import {
  escapeTemplateString,
  readFileForTemplate,
  walkDir,
} from "~/libs/sdk/sdk-impl/utils/pack-unpack/pu-file-utils";

const hashFile = async (file: string): Promise<string> => {
  const buff = await fs.readFile(file);
  return createHash("sha1").update(buff).digest("hex").slice(0, 10);
};

export default defineCommand({
  meta: {
    name: "pack",
    version: "1.1.0",
    description: "Packs a directory of templates into TS modules",
  },
  args: {
    dir: { type: "positional", required: true, description: "Directory to process" },
    output: { type: "string", default: "my-templates", description: "Output dir" },
    whitelabel: { type: "string", default: WHITELABEL_DEFAULT, description: "Rename DLER" },
    cdn: {
      type: "string",
      description: "Remote CDN for binary assets upload (not yet implemented)",
    },
  },
  async run({ args }) {
    if (args.cdn) throw new Error("Remote CDN support is not implemented yet.");

    const dirToProcess = path.resolve(args.dir);
    const outDir = path.resolve(args.output);
    await fs.mkdir(path.join(outDir, IMPL_DIR, BINARIES_DIR), { recursive: true });

    const templateDirs = (await fs.readdir(dirToProcess, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    // copy shared types.ts once
    await fs.copyFile(path.join(__dirname, "../utils/types.ts"), path.join(outDir, TYPES_FILE));

    const aggregatedImports: string[] = [];
    const aggregatedEntries: string[] = [];
    const mapEntries: string[] = [];

    for (const tplName of templateDirs) {
      const absTplDir = path.join(dirToProcess, tplName);
      const allFiles = await walkDir(absTplDir);
      const filesRecord: Record<string, TemplatesFileContent> = {};
      let pkgTypeImported = false;
      let tsConfigImported = false;

      for (const absFile of allFiles) {
        const rel = path.relative(dirToProcess, absFile).replace(/\\/g, "/");
        const meta = await readFileForTemplate(absFile);

        if (meta.type === "binary") {
          const hash = await hashFile(absFile);
          const ext = path.extname(absFile);
          const target = path.join(outDir, IMPL_DIR, BINARIES_DIR, `${hash}${ext}`);
          try {
            await fs.access(target);
          } catch {
            await fs.copyFile(absFile, target);
          }

          filesRecord[rel] = { type: "binary", content: "", binaryHash: hash };
          continue;
        }

        // json post-processing
        if (meta.type === "json") {
          if (rel.endsWith("package.json")) {
            (meta.content as any).__satisfies = "PackageJson";
            pkgTypeImported = true;
          }
          if (rel.endsWith("tsconfig.json")) {
            (meta.content as any).__satisfies = "TSConfig";
            tsConfigImported = true;
          }
        }

        filesRecord[rel] = meta;
      }

      /** ---------- emit template module ---------- */
      const varName = TEMPLATE_VAR(tplName, args.whitelabel);
      const code: string[] = [];

      if (pkgTypeImported || tsConfigImported) {
        const t: string[] = [];
        if (pkgTypeImported) t.push("PackageJson");
        if (tsConfigImported) t.push("TSConfig");
        code.push(`import type { ${t.join(", ")} } from "pkg-types";`);
      }
      code.push('import type { Template } from "../types";', "");
      code.push(`export const ${varName}: Template = {`);
      code.push(`  name: "${tplName}",`);
      code.push(`  description: "Template generated from ${allFiles.length} files",`);
      code.push("  config: {");
      code.push("    files: {");

      for (const [rel, meta] of Object.entries(filesRecord)) {
        code.push(`      "${rel}": {`);
        if (meta.jsonComments)
          code.push(`        jsonComments: ${JSON.stringify(meta.jsonComments, null, 2)},`);
        if (meta.type === "binary") {
          code.push(`        content: "",`);
          code.push(`        type: "binary",`);
          code.push(`        binaryHash: "${meta.binaryHash}",`);
        } else if (meta.type === "text") {
          code.push(`        content: \`${escapeTemplateString(meta.content as string)}\`,`);
          code.push('        type: "text",');
        } else {
          const clone = { ...(meta.content as Record<string, unknown>) };
          let sat = "";
          if ((clone as any).__satisfies) {
            sat = ` satisfies ${(clone as any).__satisfies}`;
            // biome-ignore lint/performance/noDelete: <explanation>
            delete (clone as any).__satisfies;
          }
          code.push(`        content: ${JSON.stringify(clone, null, 2)}${sat},`);
          code.push('        type: "json",');
        }
        if (meta.hasError) code.push("        hasError: true,");
        code.push("      },");
      }

      code.push("    },");
      code.push("  },");
      code.push("};");

      await fs.writeFile(path.join(outDir, IMPL_DIR, `${tplName}.ts`), code.join("\n"));

      /** aggregate */
      aggregatedImports.push(`import { ${varName} } from "./${IMPL_DIR}/${tplName}";`);
      aggregatedEntries.push(`  ${tplName}: ${varName},`);
      mapEntries.push(`  ${varName}: "${tplName}",`);
    }

    /** ---------- aggregator ---------- */
    const WL = args.whitelabel.toUpperCase();
    const mod = [
      ...aggregatedImports,
      "",
      `export const ${WL}_TEMPLATES = {`,
      ...aggregatedEntries,
      "} as const;",
      "",
      `export type ${WL}_TEMPLATE_NAMES = keyof typeof ${WL}_TEMPLATES;`,
      "",
      `export const dlerTemplatesMap: Record<string, ${WL}_TEMPLATE_NAMES> = {`,
      ...mapEntries,
      "};",
    ];
    await fs.writeFile(path.join(outDir, AGGREGATOR_FILE), mod.join("\n"));

    console.log(`Packed ${templateDirs.length} templates into ${outDir}`);
  },
});
