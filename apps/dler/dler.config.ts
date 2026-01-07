import { defineConfig } from "@reliverse/rempts-core";

export default defineConfig({
  name: "dler",
  version: "2.3.0",
  description:
    "@reliverse/dler is a framework which helps TypeScript and JavaScript developers create their libraries and CLI tools. It provides ready-to-use primitives, so you don't have to write them from scratch.",
  plugins: [],
  commands: {
    directory: "./src/commands",
  },
  build: {
    entry: "./cli.ts",
    outdir: "./dist",
    targets: ["linux-x64", "darwin-x64", "windows-x64"],
    compress: false,
    minify: false,
    sourcemap: true,
  },
  dev: {
    watch: true,
    inspect: false,
  },
  test: {
    pattern: ["**/*.test.ts", "**/*.spec.ts"],
    coverage: false,
    watch: false,
  },
  workspace: {
    versionStrategy: "fixed" as const,
  },
  release: {
    npm: true,
    github: false,
    tagFormat: "v${version}",
    conventionalCommits: true,
  },
});
