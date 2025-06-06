import type { PackageJson } from "pkg-types";

import type { Template } from "../mock-types.ts";

export const CFG_DLER_TEMPLATE: Template = {
  name: "cfg",
  description: "Template generated from 3 files",
  updatedAt: "2025-06-06T14:33:09.240Z",
  config: {
    files: {
      "cfg/jsr/bin/placeholder.ts": {
        metadata: {
          updatedAt: "2025-06-06T12:25:41.963Z",
          updatedHash: "80c30cc8ad",
        },
        content: `// this is a mock file
`,
        type: "text",
      },
      "cfg/npm/bin/cfg-mod.ts": {
        metadata: {
          updatedAt: "2025-06-06T11:37:37.159Z",
          updatedHash: "0457ea69dc",
        },
        content: `// Should be **inlined** because it points to a *different* library (cfg→sdk):
// @ts-expect-error this is a mock file
export { defineConfig } from "~/libs/sdk/sdk-impl/config/define";
`,
        type: "text",
      },
      "cfg/npm/package.json": {
        metadata: {
          updatedAt: "2025-06-06T12:25:41.963Z",
          updatedHash: "2305d8760f",
        },
        content: {
          name: "@reliverse/cfg",
          version: "1.0.0",
          private: true,
          type: "module",
          exports: {
            ".": "./bin/cfg-mod.ts",
          },
        } satisfies PackageJson,
        type: "json",
      },
    },
  },
};
