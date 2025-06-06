import type { PackageJson } from "pkg-types";

import type { Template } from "../mock-types.ts";

export const SDK_DLER_TEMPLATE: Template = {
  name: "sdk",
  description: "Template generated from 5 files",
  updatedAt: "2025-06-06T14:33:09.245Z",
  config: {
    files: {
      "sdk/jsr/bin/placeholder.ts": {
        metadata: {
          updatedAt: "2025-06-06T12:25:41.963Z",
          updatedHash: "80c30cc8ad"
        },
        content: `// this is a mock file
`,
        type: "text",
      },
      "sdk/npm/bin/sdk-impl/config/define.ts": {
        metadata: {
          updatedAt: "2025-06-06T11:37:54.284Z",
          updatedHash: "da66fcd9f0"
        },
        content: `/**
 * A helper exported by the SDK library.
 * This is a mock file.
 */
export function defineConfig(name: string) {
  return { name };
}
`,
        type: "text",
      },
      "sdk/npm/bin/sdk-mod.ts": {
        metadata: {
          updatedAt: "2025-06-06T11:37:31.498Z",
          updatedHash: "19029da4ea"
        },
        content: `// Should be rewritten to a local (“./…”) import because this file
// belongs to the SDK library itself (sdk→sdk):
// @ts-expect-error this is a mock file
export { defineConfig } from "~/libs/sdk/sdk-impl/config/define";
`,
        type: "text",
      },
      "sdk/npm/bin/unused.d.ts": {
        metadata: {
          updatedAt: "2025-06-06T11:37:23.149Z",
          updatedHash: "80c30cc8ad"
        },
        content: `// this is a mock file
`,
        type: "text",
      },
      "sdk/npm/package.json": {
        metadata: {
          updatedAt: "2025-06-06T12:25:41.963Z",
          updatedHash: "d3299f6cfa"
        },
        content: {
          name: "@reliverse/sdk",
          version: "1.0.0",
          private: true,
          type: "module",
          exports: {
            ".": "./bin/sdk-mod.ts"
          },
          dependencies: {
            "@reliverse/relinka": "1.0.0"
          },
        } satisfies PackageJson,
        type: "json",
      },
    },
  },
};
