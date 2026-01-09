import { defineConfig } from "@reliverse/rempts-core";

export default defineConfig({
  name: "hello-world",
  version: "2.3.0",
  description: "Hello World - Simplest possible Rempts CLI",

  plugins: [],
  commands: {
    directory: "./cmds",
  },
  build: {
    entry: "./cli.ts",
    outdir: "./dist",
    targets: ["bun-linux-x64-modern"],
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
