import { promises as fsp } from "node:fs";

import { resolve } from "@reliverse/pathkit";
import type { Plugin } from "rollup";

const SHEBANG_RE = /^#![^\n]*/;

export function getShebang(code: string, append = "\n"): string {
  const m = SHEBANG_RE.exec(code);
  return m ? m[0] + append : "";
}

export async function makeExecutable(filePath: string): Promise<void> {
  await fsp.chmod(filePath, 0o755 /* rwx r-x r-x */).catch(() => {
    /* it is okay if chmod fails */
  });
}

export function removeShebangPlugin(): Plugin {
  return {
    name: "dler-remove-shebang",
    renderChunk(code): string {
      return code.replace(SHEBANG_RE, "");
    },
  };
}

export function shebangPlugin(): Plugin {
  return {
    name: "dler-shebang",
    async writeBundle(options, bundle): Promise<void> {
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type !== "chunk") {
          continue;
        }
        if (SHEBANG_RE.exec(output.code)) {
          if (!options.dir) {
            throw new Error("options.dir is required for shebang plugin");
          }
          const outFile = resolve(options.dir, fileName);
          await makeExecutable(outFile);
        }
      }
    },
  };
}
