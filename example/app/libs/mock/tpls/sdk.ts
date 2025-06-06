import type { PackageJson } from "pkg-types";

import type { Template } from "../mock-types.ts";

export const SDK_DLER_TEMPLATE: Template = {
  name: "sdk",
  description: "Template generated from 5 files",
  config: {
    files: {
      "sdk/jsr/bin/placeholder.ts": {
        content: `// this is a mock file
`,
        type: "text",
      },
      "sdk/npm/bin/sdk-impl/config/define.ts": {
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
        content: `// Should be rewritten to a local (“./…”) import because this file
// belongs to the SDK library itself (sdk→sdk):
// @ts-expect-error this is a mock file
export { defineConfig } from "~/libs/sdk/sdk-impl/config/define";
`,
        type: "text",
      },
      "sdk/npm/bin/unused.d.ts": {
        content: `// this is a mock file
`,
        type: "text",
      },
      "sdk/npm/package.json": {
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
          }
        } satisfies PackageJson,
        type: "json",
      },
    },
  },
};
