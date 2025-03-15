import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    watch: false,
    include: ["tests/**/*.test.ts"],
    alias: { "~/": new URL("./src/", import.meta.url).pathname },
  },
});
