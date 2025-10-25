import { defineConfig } from "./packages/config/src/mod";

export default defineConfig({
  build: {
    // Global build configuration applied to all packages
    global: {
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
        target: "bun",
        format: "esm",
        minify: true,
        sourcemap: "none",
        external: ["@reliverse/dler-logger"],
      },
      "@reliverse/dler-colors": {
        target: "bun",
        format: "esm",
        minify: true,
        sourcemap: "linked",
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
});
