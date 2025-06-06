import type { Template } from "~/libs/sdk/sdk-impl/utils/pack-unpack/pu-types";

export const RESOLVE_CROSS_LIBS_MOCK_DLER_TEMPLATE: Template = {
  name: "resolve-cross-libs-mock",
  description: "Template generated from 6 files",
  config: {
    files: {
      "dist-libs/cfg/jsr/bin/placeholder.ts": {
        content: "// this is a mock file\n",
        type: "text",
      },
      "dist-libs/cfg/npm/bin/cfg-mod.ts": {
        content:
          '// Should be **inlined** because it points to a *different* library (cfg→sdk):\n// @ts-expect-error this is a mock file\nexport { defineConfig } from "~/libs/sdk/sdk-impl/config/define";\n',
        type: "text",
      },
      "dist-libs/sdk/jsr/bin/placeholder.ts": {
        content: "// this is a mock file\n",
        type: "text",
      },
      "dist-libs/sdk/npm/bin/sdk-impl/config/define.ts": {
        content:
          "/**\n * A helper exported by the SDK library.\n * this is a mock file\n */\nexport function defineConfig(name: string) {\n  return { name };\n}\n",
        type: "text",
      },
      "dist-libs/sdk/npm/bin/sdk-mod.ts": {
        content:
          '// Should be rewritten to a local (“./…”) import because this file\n// belongs to the SDK library itself (sdk→sdk):\n// @ts-expect-error this is a mock file\nexport { defineConfig } from "~/libs/sdk/sdk-impl/config/define";\n',
        type: "text",
      },
      "dist-libs/sdk/npm/bin/unused.d.ts": {
        content: "// this is a mock file\n",
        type: "text",
      },
    },
  },
};

export const DLER_TEMPLATES = {
  resolve_cross_libs_mock: RESOLVE_CROSS_LIBS_MOCK_DLER_TEMPLATE,
} as const;

export type DLER_TEMPLATE_NAMES = keyof typeof DLER_TEMPLATES;

export const dlerTemplatesMap: Record<string, DLER_TEMPLATE_NAMES> = {
  RESOLVE_CROSS_LIBS_MOCK_DLER_TEMPLATE: "resolve_cross_libs_mock",
};
