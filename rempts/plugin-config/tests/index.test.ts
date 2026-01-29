import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createLogger } from "@reliverse/rempts/utils";
import { configMergerPlugin } from "../src/mod";

// Create a mock plugin context for testing
function createMockPluginContext(config: any) {
  const configUpdates: any[] = [];
  const context = {
    config,
    updateConfig: (update: any) => {
      configUpdates.push(update);
    },
    registerCommand: () => {},
    use: () => {},
    store: new Map(),
    logger: createLogger("test"),
    paths: {
      cwd: process.cwd(),
      home: homedir(),
      config: join(homedir(), ".config", config.name || "rempts"),
    },
    getConfigUpdates: () => configUpdates,
  };
  return context;
}

describe("Config Merger Plugin", () => {
  const testDir = join(process.cwd(), ".test-config");
  const _homeConfigDir = join(homedir(), ".config", "test-app");

  beforeEach(async () => {
    // Create test directories
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directories
    await rm(testDir, { recursive: true, force: true });
  });

  test("loads config from local rc file", async () => {
    const config = { apiKey: "test-key", port: 3000 };
    await writeFile(join(testDir, ".test-apprc"), JSON.stringify(config));

    const hooks = configMergerPlugin({
      sources: [join(testDir, ".test-apprc")],
    })();

    const context = createMockPluginContext({ name: "test-app" });

    // Override paths for test
    context.paths.cwd = testDir;
    context.paths.config = testDir;

    await hooks.setup?.(context);

    const configUpdates = context.getConfigUpdates();
    expect(configUpdates).toHaveLength(1);
    expect(configUpdates[0]).toEqual(config);
  });

  test("merges multiple config files", async () => {
    const config1 = { apiKey: "key1", port: 3000, debug: false };
    const config2 = { apiKey: "key2", extra: "value" };

    await writeFile(join(testDir, "config1.json"), JSON.stringify(config1));
    await writeFile(join(testDir, "config2.json"), JSON.stringify(config2));

    const hooks = configMergerPlugin({
      sources: [join(testDir, "config1.json"), join(testDir, "config2.json")],
    })();

    const context = createMockPluginContext({ name: "test-app" });
    context.paths.cwd = testDir;
    context.paths.config = testDir;

    await hooks.setup?.(context);

    const configUpdates = context.getConfigUpdates();
    expect(configUpdates).toHaveLength(1);
    // Later config should override earlier
    expect(configUpdates[0]).toEqual({
      apiKey: "key2",
      port: 3000,
      debug: false,
      extra: "value",
    });
  });

  test("replaces {{name}} template in paths", async () => {
    const config = { test: true };
    await writeFile(join(testDir, ".my-clirc"), JSON.stringify(config));

    const hooks = configMergerPlugin({
      sources: [".{{name}}rc"],
    })();

    const context = createMockPluginContext({ name: "my-cli" });
    context.paths.cwd = testDir;
    context.paths.config = testDir;

    await hooks.setup?.(context);

    const configUpdates = context.getConfigUpdates();
    expect(configUpdates).toHaveLength(1);
    expect(configUpdates[0]).toEqual(config);
  });

  test("handles missing config files gracefully", async () => {
    const hooks = configMergerPlugin({
      sources: [join(testDir, "does-not-exist.json")],
    });

    const context = createMockPluginContext({ name: "test-app" });
    context.paths.cwd = testDir;
    context.paths.config = testDir;

    // Should not throw
    await hooks.setup?.(context);

    // No config updates since file doesn't exist
    const configUpdates = context.getConfigUpdates();
    expect(configUpdates).toHaveLength(0);
  });

  test("stopOnFirst option", async () => {
    const config1 = { source: "first" };
    const config2 = { source: "second" };

    await writeFile(join(testDir, "first.json"), JSON.stringify(config1));
    await writeFile(join(testDir, "second.json"), JSON.stringify(config2));

    const hooks = configMergerPlugin({
      sources: [join(testDir, "first.json"), join(testDir, "second.json")],
      stopOnFirst: true,
    })();

    const context = createMockPluginContext({ name: "test-app" });
    context.paths.cwd = testDir;
    context.paths.config = testDir;

    await hooks.setup?.(context);

    const configUpdates = context.getConfigUpdates();
    expect(configUpdates).toHaveLength(1);
    expect(configUpdates[0]).toEqual({ source: "first" });
  });
});
