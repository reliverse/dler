import { defineConfig } from "@reliverse/rempts";

export default defineConfig({
  name: "{{name}}",
  version: "{{version}}",
  description: "{{description}}",

  build: {
    entry: "./src/mod.ts",
    outdir: "./dist",
    targets: ["native"],
    minify: true,
    sourcemap: true,
    compress: false,
  },

  dev: {
    watch: true,
    inspect: true,
  },

  test: {
    pattern: ["**/*.test.ts", "**/*.spec.ts"],
    coverage: true,
    watch: false,
  },

  plugins: [],

  workspace: {
    versionStrategy: "fixed",
  },

  release: {
    npm: true,
    github: false,
    tagFormat: "v{{version}}",
    conventionalCommits: true,
  },
});
