import type { PackageJson } from "pkg-types";

import type { Template } from "../mock-types.ts";

export const CFG_DLER_TEMPLATE: Template = {
  name: "cfg",
  description: "Template generated from 3 files",
  config: {
    files: {
      "cfg/jsr/bin/placeholder.ts": {
        content: `// this is a mock file
`,
        type: "text",
      },
      "cfg/npm/bin/cfg-mod.ts": {
        content: `// Should be **inlined** because it points to a *different* library (cfg→sdk):
// @ts-expect-error this is a mock file
export { defineConfig } from "~/libs/sdk/sdk-impl/config/define";
`,
        type: "text",
      },
      "cfg/npm/package.json": {
        content: {
          name: "@reliverse/cfg",
          version: "1.0.0",
          private: true,
          type: "module",
          exports: {
            ".": "./bin/cfg-mod.ts"
          }
        } satisfies PackageJson,
        type: "json",
      },
    },
  },
};
