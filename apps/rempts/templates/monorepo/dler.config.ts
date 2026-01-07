import { defineConfig } from "@reliverse/rempts-core";

export default defineConfig({
  name: "{{name}}",
  version: "{{version}}",
  description: "{{description}}",

  commands: {
    directory: "./packages/core/src/commands",
  },

  plugins: [],

  build: {
    entry: "./packages/core/src/mod.ts",
    outdir: "./packages/core/dist",
    targets: ["darwin-arm64", "darwin-x64", "linux-x64", "windows-x64"],
    minify: true,
    compress: true,
    sourcemap: true,
  },

  dev: {
    watch: true,
    inspect: false,
  },

  test: {
    pattern: ["**/*.test.ts", "**/*.spec.ts"],
    coverage: true,
    watch: false,
  },

  workspace: {
    packages: ["./packages/*"],
    versionStrategy: "fixed",
  },

  release: {
    npm: true,
    github: false,
    tagFormat: "v{{version}}",
    conventionalCommits: true,
  },
});
