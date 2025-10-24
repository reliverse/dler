// reliverse.example.ts
// Example configuration file for @reliverse/dler build system

import type { BuildDlerConfig as DlerConfig } from "./packages/config/src/mod";

export default {
  build: {
    // Global build configuration applied to all packages
    global: {
      // enable defaults to true when not specified
      target: "bun",
      format: "esm",
      minify: false,
      sourcemap: "inline",
      splitting: true,
      packages: "bundle",
    },

    // Per-package specific configurations
    packages: {
      "@reliverse/dler-launcher": {
        // enable defaults to true when not specified
        target: "bun",
        format: "esm",
        minify: true,
        sourcemap: "none",
        external: ["@reliverse/dler-logger"],
      },
      "@reliverse/dler-colors": {
        // enable defaults to true when not specified
        target: "bun",
        format: "esm",
        minify: true,
        sourcemap: "linked",
      },
      "@reliverse/react-app-example": {
        enable: false, // Explicitly disabled
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
        external: ["react", "react-dom"],
      },
      "@reliverse/native-app-example": {
        enable: false, // Explicitly disabled
        target: "bun",
        format: "cjs",
        minify: true,
        sourcemap: "none",
        splitting: false,
        bytecode: true,
        packages: "bundle",
        compile: true,
        windowsTitle: "Native App Example",
        windowsDescription: "Example native CLI application built with Dler",
        windowsPublisher: "Reliverse",
        windowsVersion: "1.0.0.0",
        windowsCopyright: "Copyright (c) 2025 Reliverse",
      },
    },
  },
  publish: {
    // Global publish configuration applied to all packages
    global: {
      // enable defaults to true when not specified
      access: "public",
      tag: "latest",
      verbose: false,
      concurrency: 1,
    },

    // Per-package specific publish configurations
    packages: {
      "@reliverse/dler-launcher": {
        // enable defaults to true when not specified
        tag: "latest",
        access: "public",
        verbose: true,
      },
      "@reliverse/dler-colors": {
        // enable defaults to true when not specified
        tag: "latest",
        access: "public",
        bump: "patch",
      },
      "@reliverse/react-app-example": {
        // enable defaults to true when not specified
        tag: "next",
        access: "public",
        dryRun: false,
      },
      "@reliverse/native-app-example": {
        enable: false, // Explicitly disabled
        tag: "beta",
        access: "restricted",
        bump: "prerelease",
      },
    },

    // Pattern-based configurations
    patterns: [
      {
        pattern: "@reliverse/dler-*",
        config: {
          // enable defaults to true when not specified
          tag: "latest",
          access: "public",
          verbose: true,
        },
      },
      {
        pattern: "*example*",
        config: {
          enable: false, // Explicitly disabled
          tag: "next",
          access: "public",
          dryRun: true,
        },
      },
    ],
  },
} satisfies DlerConfig;
