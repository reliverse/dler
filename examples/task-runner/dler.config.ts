import { defineConfig } from "@reliverse/rempts-core";
import { completionsPlugin } from "@reliverse/rempts-plugin-completions";

export default defineConfig({
  name: "task-runner",
  version: "2.3.0",
  description: "Task automation CLI with validation and interactivity",

  plugins: [completionsPlugin],
  commands: {
    directory: "./commands",
  },
  build: {
    entry: "./cli.ts",
    outdir: "./dist",
    targets: ["native"],
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
    tagFormat: "v{{version}}",
    conventionalCommits: true,
  },
});
