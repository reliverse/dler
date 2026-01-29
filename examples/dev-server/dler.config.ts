import { defineConfig } from "@reliverse/rempts";

export default defineConfig({
  name: "dev-server",
  version: "0.0.1",
  description:
    "Development server with plugins - Advanced plugin system and configuration management",
  plugins: [],
  commands: {
    directory: "./cmds",
  },
  build: {
    entry: "cli.ts",
    outdir: "dist",
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
