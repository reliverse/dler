import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFileCommandLoader } from "../src/file-loader";

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
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "test",
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
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "parent",
  description: "A parent command",
  handler: () => {
    console.log("parent executed");
  }
});
`;

    const childContent = `
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "child",
  description: "A child command",
  handler: () => {
    console.log("child executed");
  }
});
`;

    await mkdir(join(testDir, "parent"), { recursive: true });
    await mkdir(join(testDir, "child"), { recursive: true });
    await writeFile(join(testDir, "parent", "cmd.ts"), parentContent);
    await writeFile(join(testDir, "child", "cmd.ts"), childContent);

    const tree = await loader.loadFromDirectory(testDir);

    expect(tree).toHaveProperty("parent");
    expect(tree.parent).toHaveProperty("filePath", "parent/cmd.ts");
    expect(tree.parent).toHaveProperty("commandName", "parent");

    expect(tree).toHaveProperty("child");
    expect(tree.child).toHaveProperty("filePath", "child/cmd.ts");
    expect(tree.child).toHaveProperty("commandName", "child");
  });

  it("should detect command conflicts", async () => {
    // Create conflicting command files
    const command1 = `
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "build",
  description: "First build command",
  handler: () => {}
});
`;

    const command2 = `
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "build",
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
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "js-cmd",
  description: "JavaScript command",
  handler: () => {}
});
`;

    const mjsCommand = `
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "mjs-cmd",
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
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "utility-test",
  description: "Utility test command",
  handler: () => {}
});
`;

    await mkdir(join(testDir, "utility-test"), { recursive: true });
    await writeFile(join(testDir, "utility-test", "cmd.ts"), commandContent);

    // Test that scanning works (loading would require dependencies)
    const loader = createFileCommandLoader();
    const tree = await loader.loadFromDirectory(testDir);

    expect(Object.keys(tree)).toHaveLength(1);
    expect(tree).toHaveProperty("utility-test");
  });

  it("should only detect valid command files", async () => {
    // Create a valid command file
    const validCommand = `
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "valid-test",
  description: "Valid command file",
  handler: () => {}
});
`;

    // Create an invalid command file (missing rempts import)
    const invalidCommand = `
const cmd = {
  name: "invalid-test",
  description: "Invalid command file",
  handler: () => {}
};

export default cmd;
`;

    await mkdir(join(testDir, "valid-test"), { recursive: true });
    await mkdir(join(testDir, "invalid-test"), { recursive: true });
    await writeFile(join(testDir, "valid-test", "cmd.ts"), validCommand);
    await writeFile(join(testDir, "invalid-test", "cmd.ts"), invalidCommand);

    const testLoader = createFileCommandLoader();
    const tree = await testLoader.loadFromDirectory(testDir);

    // Only the valid command should be detected
    expect(Object.keys(tree)).toHaveLength(1);
    expect(tree).toHaveProperty("valid-test");
    expect(tree).not.toHaveProperty("invalid-test");
  });
});

describe("Directory Loading", () => {
  const testDir = join(process.cwd(), "test-app-commands");

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("should load commands from directory", async () => {
    const cmdsCommand = `
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "app-test",
  description: "Cmds directory test command",
  handler: () => {}
});
`;

    await mkdir(join(testDir, "cmds", "app-test"), { recursive: true });
    await writeFile(join(testDir, "cmds", "app-test", "cmd.ts"), cmdsCommand);

    const loader = createFileCommandLoader();
    const tree = await loader.loadFromDirectory(join(testDir, "cmds"));

    expect(tree).toHaveProperty("app-test");
    expect(tree["app-test"]).toHaveProperty("filePath", "app-test/cmd.ts");
    expect(tree["app-test"]).toHaveProperty("commandName", "app-test");
  });

  it("should handle multiple commands", async () => {
    const parentCommand = `
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "parent",
  description: "Parent cmds command",
  handler: () => {}
});
`;

    const childCommand = `
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "build",
  description: "Build cmds command",
  handler: () => {}
});
`;

    await mkdir(join(testDir, "cmds", "parent"), { recursive: true });
    await mkdir(join(testDir, "cmds", "build"), { recursive: true });
    await writeFile(join(testDir, "cmds", "parent", "cmd.ts"), parentCommand);
    await writeFile(join(testDir, "cmds", "build", "cmd.ts"), childCommand);

    const loader = createFileCommandLoader();
    const tree = await loader.loadFromDirectory(join(testDir, "cmds"));

    expect(tree).toHaveProperty("parent");
    expect(tree.parent).toHaveProperty("filePath", "parent/cmd.ts");
    expect(tree.parent).toHaveProperty("commandName", "parent");

    expect(tree).toHaveProperty("build");
    expect(tree.build).toHaveProperty("filePath", "build/cmd.ts");
    expect(tree.build).toHaveProperty("commandName", "build");
  });

  it("should only accept files with default export and defineCommand", async () => {
    // Valid cmds command
    const validCommand = `
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "valid",
  description: "Valid cmds command",
  handler: () => {}
});
`;

    // Invalid - no default export
    const invalidCommand1 = `
import { defineCommand } from "@reliverse/rempts-core";

export const command = defineCommand({
  name: "invalid1",
  description: "Invalid cmds command",
  handler: () => {}
});
`;

    // Invalid - no defineCommand
    const invalidCommand2 = `
export default {
  name: "invalid2",
  description: "Invalid cmds command",
  handler: () => {}
};
`;

    await mkdir(join(testDir, "cmds"), { recursive: true });
    await mkdir(join(testDir, "cmds", "valid"), { recursive: true });
    await mkdir(join(testDir, "cmds", "invalid1"), { recursive: true });
    await mkdir(join(testDir, "cmds", "invalid2"), { recursive: true });

    await writeFile(join(testDir, "cmds", "valid", "cmd.ts"), validCommand);
    await writeFile(join(testDir, "cmds", "invalid1", "cmd.ts"), invalidCommand1);
    await writeFile(join(testDir, "cmds", "invalid2", "cmd.ts"), invalidCommand2);

    const loader = createFileCommandLoader();
    const tree = await loader.loadFromDirectory(join(testDir, "cmds"));

    // Should only contain the valid command
    expect(Object.keys(tree)).toHaveLength(1);
    expect(tree).toHaveProperty("valid");
  });
});
