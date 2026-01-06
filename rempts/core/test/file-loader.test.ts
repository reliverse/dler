import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { FileCommandLoader, loadCommandsFromDirectory } from "../src/file-loader";
import type { CommandFileTree } from "../src/file-loader";

describe("FileCommandLoader", () => {
  const testDir = join(process.cwd(), "test-commands");
  const loader = new FileCommandLoader();

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("should build command tree from directory", async () => {
    // Create a test command file
    const commandContent = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  name: "test",
  description: "A test command",
  handler: () => {
    console.log("test executed");
  }
});
`;

    await writeFile(join(testDir, "test.ts"), commandContent);

    const tree = await loader.loadFromDirectory(testDir);

    expect(tree).toHaveProperty("test");
    expect(tree.test).toHaveProperty("filePath", "test.ts");
    expect(tree.test).toHaveProperty("commandName", "test");
  });

  it("should handle nested commands", async () => {
    // Create nested command files
    const parentContent = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  name: "parent",
  description: "A parent command",
  handler: () => {
    console.log("parent executed");
  }
});
`;

    const childContent = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  name: "child",
  description: "A child command",
  handler: () => {
    console.log("child executed");
  }
});
`;

    await mkdir(join(testDir, "parent"), { recursive: true });
    await writeFile(join(testDir, "parent", "index.ts"), parentContent);
    await writeFile(join(testDir, "parent", "child.ts"), childContent);

    const tree = await loader.loadFromDirectory(testDir);

    expect(tree).toHaveProperty("parent");
    const parentTree = tree.parent as CommandFileTree;
    expect(parentTree).toHaveProperty("index");
    expect(parentTree.index).toHaveProperty("commandName", "parent");
    expect(parentTree).toHaveProperty("child");
    expect(parentTree.child).toHaveProperty("commandName", "parent child");
  });

  it("should detect command conflicts", async () => {
    // Create conflicting command files
    const command1 = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  name: "build",
  description: "First build command",
  handler: () => {}
});
`;

    const command2 = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  name: "build",
  description: "Second build command",
  handler: () => {}
});
`;

    await mkdir(join(testDir, "build"), { recursive: true });
    await writeFile(join(testDir, "build.ts"), command1);
    await writeFile(join(testDir, "build", "index.ts"), command2);

    await expect(loader.loadFromDirectory(testDir)).rejects.toThrow(
      /Command "build" conflicts between/,
    );
  });

  it("should support .js and .mjs extensions", async () => {
    const jsCommand = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  name: "js-cmd",
  description: "JavaScript command",
  handler: () => {}
});
`;

    const mjsCommand = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  name: "mjs-cmd",
  description: "MJS command",
  handler: () => {}
});
`;

    await writeFile(join(testDir, "js-cmd.js"), jsCommand);
    await writeFile(join(testDir, "mjs-cmd.mjs"), mjsCommand);

    const tree = await loader.loadFromDirectory(testDir);

    expect(tree).toHaveProperty("js-cmd");
    expect(tree).toHaveProperty("mjs-cmd");
    expect(tree["js-cmd"]).toHaveProperty("filePath", "js-cmd.js");
    expect(tree["mjs-cmd"]).toHaveProperty("filePath", "mjs-cmd.mjs");
  });
});

describe("loadCommandsFromDirectory", () => {
  const testDir = join(process.cwd(), "test-commands-utility");

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("should provide utility function for loading commands", async () => {
    const commandContent = `
// Mock defineCommand for testing
const defineCommand = (cmd: any) => cmd;

export default defineCommand({
  name: "utility-test",
  description: "Utility test command",
  handler: () => {}
});
`;

    await writeFile(join(testDir, "utility-test.ts"), commandContent);

    const commands = await loadCommandsFromDirectory(testDir);

    expect(commands).toHaveLength(1);
    expect(commands[0]?.name).toBe("utility-test");
  });

  it("should detect commands that only use defineCommand without rempts imports", async () => {
    // Test the fixed logic for detecting commands that use defineCommand
    // but don't explicitly import from rempts-core
    const commandContent = `
import { z } from "zod";

const cmd = defineCommand({
  name: "define-only-test",
  description: "Command using defineCommand without explicit import",
  options: {
    test: z.string().optional()
  },
  handler: () => {}
});

export default cmd;
`;

    await writeFile(join(testDir, "define-only-test.ts"), commandContent);

    const testLoader = new FileCommandLoader();
    const tree = await testLoader.loadFromDirectory(testDir);

    // The file should be detected as a command file
    expect(Object.keys(tree)).toContain("define-only-test");
  });

  it("should skip files that are not command files", async () => {
    // Test files that should be skipped
    const nonCommandFiles = [
      "test.spec.ts",
      "command.test.ts",
      "__tests__/helper.ts",
      "node_modules/some-file.ts",
      "dist/build.ts",
      ".dler/generated.ts",
      "commands.gen.ts",
      ".config.ts",
      "setup.ts",
    ];

    const testLoader = new FileCommandLoader();
    for (const file of nonCommandFiles) {
      const filePath = join(testDir, file);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, "export default {};");

      const isCommand = await testLoader["isCommandFile"](filePath);
      expect(isCommand).toBe(false);
    }
  });
});
