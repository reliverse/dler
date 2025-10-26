import type { DlerConfig } from "./packages/config/src/impl/core";

export default {
  build: {
    // Global build configuration applied to all packages
    global: {
      bundler: "mkdist",
      target: "bun",
      format: "esm",
      minify: false,
      sourcemap: "inline",
      splitting: true,
      packages: "external", // Changed to external to allow per-package configuration
      // Declaration generation
      dts: {
        enable: true,
        provider: "mkdist", // Default provider
        bundle: false, // Bundleless by default
        abortOnError: true,
      },
    },

    // Per-package specific configurations
    packages: {
      "@reliverse/dler-build": {
        target: "bun",
        format: "esm",
        minify: true,
        sourcemap: "none",
        external: ["@reliverse/dler-logger"],
        dts: {
          enable: true,
          provider: "mkdist",
          bundle: false,
          abortOnError: true,
        },
      },
      "@reliverse/dler-launcher": {
        target: "bun",
        format: "esm",
        minify: true,
        sourcemap: "none",
        external: ["@reliverse/dler-logger"],
        // Bundled declarations for this package
        dts: {
          provider: "api-extractor", // Use api-extractor for bundled declarations
          bundle: true,
          distPath: "types",
          abortOnError: true,
        },
      },
      "@reliverse/dler-colors": {
        target: "bun",
        format: "esm",
        minify: true,
        sourcemap: "linked",
        // Use experimental tsgo for faster declaration generation
        dts: {
          provider: "typescript", // Use TypeScript compiler for tsgo
          tsgo: false,
          bundle: false,
        },
      },
      "@reliverse/react-app-example": {
        enable: false,
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
        // Disable declaration generation for frontend apps
        dts: false,
      },
      "@reliverse/native-app-example": {
        enable: false,
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
      bumpDisable: false,
      access: "public",
      tag: "latest",
      verbose: false,
      concurrency: 1,
      registry: "npm",
      kind: "library",
    },

    // Per-package specific publish configurations
    packages: {
      "@reliverse/dler": {
        enable: true,
        tag: "latest",
        access: "public",
        registry: "npm",
        kind: "cli",
      },
      "@reliverse/dler-v1": {
        enable: false,
        tag: "latest",
        access: "public",
        registry: "npm",
        kind: "cli",
      },
      "@reliverse/dler-tsconfig": {
        enable: false,
        tag: "latest",
        access: "public",
        registry: "npm",
        kind: "library",
      },
      "@reliverse/dler-launcher": {
        tag: "latest",
        access: "public",
        verbose: true,
        registry: "npm",
        kind: "library",
      },
      "@reliverse/dler-colors": {
        tag: "latest",
        access: "public",
        bump: "patch",
        registry: "npm",
        kind: "library",
      },
      "@reliverse/react-app-example": {
        tag: "next",
        access: "restricted",
        dryRun: false,
        registry: "vercel",
        kind: "browser-app",
      },
      "@reliverse/native-app-example": {
        enable: false,
        tag: "beta",
        access: "restricted",
        bump: "prerelease",
        registry: "none",
        kind: "native-app",
      },
    },
  },
} satisfies DlerConfig;
