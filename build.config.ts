import { defineBuildConfig } from "unbuild";

import pubConfig from "./pub.config.js";

export default defineBuildConfig({
  declaration: true,
  clean: false,
  entries: [
    {
      builder: "mkdist",
      outDir: "dist-npm/bin",
      format: "esm",
      input: "src",
      ext: "js",
      //   pattern: [
      //     "**/*.ts",
      //     "**/*.tsx",
      //     "!**/*.d.ts",
      //     "!**/*.test.ts",
      //     "!**/__tests__/**",
      //   ],
    },
  ],
  rollup: {
    emitCJS: false,
    esbuild: {
      minify: pubConfig.shouldMinify,
      target: "es2023",
      exclude: ["**/*.test.ts", "**/__tests__/**"],
    },
  },
});
