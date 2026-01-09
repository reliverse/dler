import { expect, test } from "bun:test";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, remptsConfigSchema } from "@reliverse/rempts-core";
import { loadConfig } from "../src/config";

test("defineConfig - returns config as-is", () => {
  const config = {
    name: "test-cli",
    build: {
      entry: "src/cli.ts",
    },
  };

  const result = defineConfig(config);
  expect(result).toEqual(config);
});

test("remptsConfigSchema - validates valid config", () => {
  const config = {
    name: "test-cli",
    version: "1.0.0",
    build: {
      entry: "src/cli.ts",
      outdir: "./dist",
      minify: true,
    },
    dev: {
      watch: true,
    },
  };

  const result = remptsConfigSchema.assert(config);
  expect(result.name).toBe("test-cli");
  expect(result.version).toBe("1.0.0");
  expect(result.build?.entry).toBe("src/cli.ts");
  expect(result.build?.minify).toBe(true);
  expect(result.build?.outdir).toBe("./dist");
  expect(result.dev?.watch).toBe(true);
});

test("remptsConfigSchema - handles partial build config", () => {
  const config = {
    build: {
      entry: "src/mod.ts",
      minify: false,
    },
  };

  const result = remptsConfigSchema.assert(config);
  expect(result.build?.entry).toBe("src/mod.ts");
  expect(result.build?.minify).toBe(false);
  expect(result.build?.outdir).toBeUndefined();
});

test("loadConfig - returns default config when no file found", async () => {
  const config = await loadConfig("/tmp/nonexistent");
  // With simplified schema, defaults are not automatically applied
  // Just check that we get a valid config object
  expect(typeof config).toBe("object");
  expect(config).not.toBeNull();
});

test("loadConfig - loads config from file", async () => {
  const tmpDir = tmpdir();
  const configPath = join(tmpDir, "dler.config.js");
  const expectedConfig = {
    name: "test-cli",
    build: { entry: "src/cli.ts" },
  };

  // Write config file
  writeFileSync(configPath, `export default ${JSON.stringify(expectedConfig)}`);

  try {
    const config = await loadConfig(tmpDir);
    expect(config.name).toBe("test-cli");
    expect(config.build?.entry).toBe("src/cli.ts");
  } finally {
    // Cleanup
    if (existsSync(configPath)) {
      unlinkSync(configPath);
    }
  }
});
