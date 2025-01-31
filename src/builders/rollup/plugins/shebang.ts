import type { Plugin } from "rollup";

import { promises as fsp } from "node:fs";
import { resolve } from "pathe";

const SHEBANG_RE = /^#![^\n]*/;

export function shebangPlugin(): Plugin {
  return {
    name: "relidler-shebang",
    async writeBundle(options, bundle): Promise<void> {
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type !== "chunk") {
          continue;
        }
        if (SHEBANG_RE.exec(output.code)) {
          // @ts-expect-error TODO: fix ts
          const outFile = resolve(options.dir, fileName);
          await makeExecutable(outFile);
        }
      }
    },
  };
}

export function removeShebangPlugin(): Plugin {
  return {
    name: "relidler-remove-shebang",
    renderChunk(code): string {
      return code.replace(SHEBANG_RE, "");
    },
  };
}

export async function makeExecutable(filePath: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  await fsp.chmod(filePath, 0o755 /* rwx r-x r-x */).catch(() => {});
}

export function getShebang(code: string, append = "\n"): string {
  const m = SHEBANG_RE.exec(code);
  return m ? m[0] + append : "";
}
