import { defineCommand } from "@reliverse/rempts";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { TemplatesFileContent } from "~/libs/sdk/sdk-impl/utils/pack-unpack/pu-types";

import {
  IMPL_DIR,
  BINARIES_DIR,
  AGGREGATOR_FILE,
} from "~/libs/sdk/sdk-impl/utils/pack-unpack/pu-constants";

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
  },
  async run({ args }) {
    if (args.cdn) throw new Error("Remote CDN support is not implemented yet.");

    const templatesDir = path.resolve(args.templatesDir);
    const modPath = path.join(templatesDir, AGGREGATOR_FILE);
    const mod = await import(`file://${modPath}`);

    const templatesObj =
      mod?.DLER_TEMPLATES ||
      mod?.default ||
      (() => {
        throw new Error("Invalid mod.ts");
      })();

    for (const tpl of Object.values(templatesObj) as any) {
      await restoreTemplate(tpl, templatesDir, args.output);
    }

    console.log(`Unpacked ${Object.keys(templatesObj).length} templates into ${args.output}`);
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
          IMPL_DIR,
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
