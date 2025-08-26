import type { PackageJson } from "pkg-types";

import type { Template } from "../mock-types.ts";

export const SDK_DLER_TEMPLATE: Template = {
  name: "sdk",
  description: "Template generated from 5 files",
  updatedAt: "2025-06-06T14:43:33.638Z",
  config: {
    files: {
      "sdk/jsr/bin/placeholder.ts": {
        metadata: {
          updatedAt: "2025-06-06T14:37:50.726Z",
          updatedHash: "19b36eae5e",
        },
        content: `// this is a test mock file
`,
        type: "text",
      },
      "app/config/default.ts": {
        metadata: {
          updatedAt: "2025-06-06T14:37:51.163Z",
          updatedHash: "4281af2ed1",
        },
        content: `/**
 * A helper exported by the SDK library.
 * this is a test mock file.
 */
export function defineConfig(name: string) {
  return { name };
}
`,
        type: "text",
      },
      "sdk/npm/bin/sdk-mod.ts": {
        metadata: {
          updatedAt: "2025-06-06T14:37:51.050Z",
          updatedHash: "ca391d6cd7",
        },
        content: `// Should be rewritten to a local (“./…”) import because this file
// belongs to the SDK library itself (sdk→sdk):
// @ts-expect-error this is a test mock file (💡 "Unused '@ts-expect-error' directive" is an expected error here (after "bun libs:example"))
export { defineConfig } from "~/app/config/default";
`,
        type: "text",
      },
      "sdk/npm/bin/unused.d.ts": {
        metadata: {
          updatedAt: "2025-06-06T14:37:50.978Z",
          updatedHash: "19b36eae5e",
        },
        content: `// this is a test mock file
`,
        type: "text",
      },
      "sdk/npm/package.json": {
        metadata: {
          updatedAt: "2025-06-06T12:25:41.963Z",
          updatedHash: "d3299f6cfa",
        },
        content: {
          name: "@reliverse/sdk",
          version: "1.0.0",
          private: true,
          type: "module",
          exports: {
            ".": "./bin/sdk-mod.ts",
          },
          dependencies: {
            "@reliverse/relinka": "1.0.0",
          },
        } satisfies PackageJson,
        type: "json",
      },
    },
  },
};
