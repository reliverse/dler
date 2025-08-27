import type { PackageJson } from "pkg-types";

import type { Template } from "../mock-types.ts";

export const CFG_DLER_TEMPLATE: Template = {
  name: "cfg",
  description: "Template generated from 3 files",
  updatedAt: "2025-06-06T14:43:33.630Z",
  config: {
    files: {
      "cfg/jsr/bin/placeholder.ts": {
        metadata: {
          updatedAt: "2025-06-06T14:37:51.322Z",
          updatedHash: "19b36eae5e",
        },
        content: `// this is a test mock file
`,
        type: "text",
      },
      "cfg/npm/bin/cfg-mod.ts": {
        metadata: {
          updatedAt: "2025-06-06T14:37:29.493Z",
          updatedHash: "1641293ff0",
        },
        content: `// Should be **inlined** because it points to a *different* library (cfg→sdk):
// @ts-expect-error this is a test mock file (💡 "Unused '@ts-expect-error' directive" is an expected error here after "bun libs:example")
export { defineConfig } from "~/impl/schema/mod";
`,
        type: "text",
      },
      "cfg/npm/package.json": {
        metadata: {
          updatedAt: "2025-06-06T12:25:41.963Z",
          updatedHash: "2305d8760f",
        },
        content: {
          name: "~/app/types/mod",
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
