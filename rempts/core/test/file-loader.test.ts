import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CommandFileTree } from "../src/file-loader";
import { createFileCommandLoader, loadCommandsFromDirectory } from "../src/file-loader";

describe("FileCommandLoader", () => {
  const testDir = join(process.cwd(), "test-commands");
  const loader = createFileCommandLoader();

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
  description: "A test command",
  handler: () => {
    console.log("test executed");
  }
});
`;

    await mkdir(join(testDir, "test"), { recursive: true });
    await writeFile(join(testDir, "test", "cmd.ts"), commandContent);

    const tree = await loader.loadFromDirectory(testDir);

    expect(tree).toHaveProperty("test");
    expect(tree.test).toHaveProperty("filePath", "test/cmd.ts");
    expect(tree.test).toHaveProperty("commandName", "test");
  });

  it("should handle nested commands", async () => {
    // Create nested command files
    const parentContent = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  description: "A parent command",
  handler: () => {
    console.log("parent executed");
  }
});
`;

    const childContent = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  description: "A child command",
  handler: () => {
    console.log("child executed");
  }
});
`;

    await mkdir(join(testDir, "parent", "child"), { recursive: true });
    await writeFile(join(testDir, "parent", "cmd.ts"), parentContent);
    await writeFile(join(testDir, "parent", "child", "cmd.ts"), childContent);

    const tree = await loader.loadFromDirectory(testDir);

    expect(tree).toHaveProperty("parent");
    const parentTree = tree.parent as CommandFileTree;
    expect(parentTree).toHaveProperty("child");
    expect((parentTree as any).filePath).toBe("parent/cmd.ts");
    expect((parentTree as any).commandName).toBe("parent");
    expect(parentTree.child).toHaveProperty("filePath", "parent/child/cmd.ts");
    expect(parentTree.child).toHaveProperty("commandName", "parent child");
  });

  it("should detect command conflicts", async () => {
    // Create conflicting command files
    const command1 = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  description: "First build command",
  handler: () => {}
});
`;

    const command2 = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  description: "Second build command",
  handler: () => {}
});
`;

    await mkdir(join(testDir, "build1"), { recursive: true });
    await mkdir(join(testDir, "build2"), { recursive: true });
    await writeFile(join(testDir, "build1", "cmd.ts"), command1);
    await writeFile(join(testDir, "build2", "cmd.ts"), command2);

    // Rename the second command to "build" to create a conflict
    const conflictCommand = command2.replace('name: "build"', 'name: "build"');

    await expect(loader.loadFromDirectory(testDir)).rejects.toThrow(/Command conflicts detected/);
  });

  it("should support .js and .mjs extensions", async () => {
    const jsCommand = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  description: "JavaScript command",
  handler: () => {}
});
`;

    const mjsCommand = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  description: "MJS command",
  handler: () => {}
});
`;

    await mkdir(join(testDir, "js-cmd"), { recursive: true });
    await mkdir(join(testDir, "mjs-cmd"), { recursive: true });
    await writeFile(join(testDir, "js-cmd", "cmd.js"), jsCommand);
    await writeFile(join(testDir, "mjs-cmd", "cmd.mjs"), mjsCommand);

    const tree = await loader.loadFromDirectory(testDir);

    expect(tree).toHaveProperty("js-cmd");
    expect(tree).toHaveProperty("mjs-cmd");
    expect(tree["js-cmd"]).toHaveProperty("filePath", "js-cmd/cmd.js");
    expect(tree["mjs-cmd"]).toHaveProperty("filePath", "mjs-cmd/cmd.mjs");
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
  description: "Utility test command",
  handler: () => {}
});
`;

    await mkdir(join(testDir, "utility-test"), { recursive: true });
    await writeFile(join(testDir, "utility-test", "cmd.ts"), commandContent);

    const commands = await loadCommandsFromDirectory(testDir);

    expect(commands).toHaveLength(1);
    expect(commands[0]?.name).toBe("utility-test");
  });

  it("should detect commands that only use defineCommand without @reliverse/dler rempts imports", async () => {
    // Test the fixed logic for detecting commands that use defineCommand
    // but don't explicitly import from rempts-core
    const commandContent = `
import { type } from "arktype";

const cmd = defineCommand({
  name: "define-only-test",
  description: "Command using defineCommand without explicit import",
  options: {
    test: type("string?")
  },
  handler: () => {}
});

export default cmd;
`;

    await writeFile(join(testDir, "define-only-test.ts"), commandContent);

    const testLoader = createFileCommandLoader();
    const tree = await testLoader.loadFromDirectory(testDir);

    // The file should be detected as a command file
    expect(Object.keys(tree)).toContain("define-only-test");
  });
});

describe("Directory-Based Command Loading", () => {
  const testDir = join(process.cwd(), "test-cmds-commands");

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("should load commands from directory structure", async () => {
    const commandContent = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  description: "Test command",
  handler: () => {}
});
`;

    await mkdir(join(testDir, "test-cmd"), { recursive: true });
    await writeFile(join(testDir, "test-cmd", "cmd.ts"), commandContent);

    const loader = createFileCommandLoader();
    const tree = await loader.loadFromDirectory(testDir);

    expect(tree).toHaveProperty("test-cmd");
    expect(tree["test-cmd"]).toHaveProperty("filePath", "test-cmd/cmd.ts");
    expect(tree["test-cmd"]).toHaveProperty("commandName", "test-cmd");
  });

  it("should handle nested commands", async () => {
    const parentCommand = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  description: "Parent command",
  handler: () => {}
});
`;

    const childCommand = `
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  description: "Child command",
  handler: () => {}
});
`;

    await mkdir(join(testDir, "parent"), { recursive: true });
    await mkdir(join(testDir, "parent", "child"), { recursive: true });
    await writeFile(join(testDir, "parent", "cmd.ts"), parentCommand);
    await writeFile(join(testDir, "parent", "child", "cmd.ts"), childCommand);

    const loader = createFileCommandLoader();
    const tree = await loader.loadFromDirectory(testDir);

    expect(tree).toHaveProperty("parent");
    const parentTree = tree.parent as CommandFileTree;
    expect(parentTree).toHaveProperty("child");
    expect((parentTree as any).filePath).toBe("parent/cmd.ts");
    expect((parentTree as any).commandName).toBe("parent");
    expect(parentTree.child).toHaveProperty("filePath", "parent/child/cmd.ts");
    expect(parentTree.child).toHaveProperty("commandName", "parent child");
  });
});
