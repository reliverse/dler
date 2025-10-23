// reliverse.example.ts
// Example configuration file for @reliverse/dler build system

import type { ReliverseConfig } from "./apps/dler/src/cmds/build/types";

export default {
  build: {
    // Global build configuration applied to all packages
    global: {
      target: "bun",
      format: "esm",
      minify: false,
      sourcemap: "inline",
      splitting: true,
      external: ["react", "react-dom"],
      packages: "bundle",
    },

    // Per-package specific configurations
    packages: {
      "@reliverse/dler-launcher": {
        target: "node",
        format: "cjs",
        minify: true,
        sourcemap: "none",
        external: ["@reliverse/dler-logger"],
      },
      "@reliverse/dler-colors": {
        target: "bun",
        format: "esm",
        minify: true,
        sourcemap: "linked",
        bytecode: true,
      },
      "@reliverse/react-app-example": {
        target: "browser",
        format: "esm",
        minify: false,
        sourcemap: "inline",
        splitting: true,
        html: true,
        cssChunking: true,
        assets: {
          publicPath: "public",
        },
        packages: "bundle",
      },
    },

    // Pattern-based configurations for multiple packages
    patterns: [
      {
        pattern: "@reliverse/dler-*",
        config: {
          target: "bun",
          format: "esm",
          minify: false,
          sourcemap: "inline",
          banner: "// Built with @reliverse/dler",
        },
      },
      {
        pattern: "packages/*",
        config: {
          target: "bun",
          format: "esm",
          minify: true,
          sourcemap: "linked",
          drop: ["console.log", "debugger"],
        },
      },
      {
        pattern: "apps/*",
        config: {
          target: "node",
          format: "cjs",
          minify: true,
          sourcemap: "none",
          external: ["react", "react-dom", "next"],
        },
      },
    ],
  },
} satisfies ReliverseConfig;
