import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { buildTypes } from "../src/builder";
import { Generator } from "../src/generator";
import { parseCommand } from "../src/parser";
import { CommandScanner } from "../src/scanner";

describe("Generator", () => {
  const testDir = join(import.meta.dir, "fixtures");
  const outputFile = join(testDir, "commands.gen.ts");

  test("should scan command files", async () => {
    // Ensure test directory exists
    await mkdir(testDir, { recursive: true });

    // Create a test command file
    const testCommandContent = `
import { defineCommand, option } from '@reliverse/rempts-core'
import { type } from 'arktype'

export default defineCommand({
  name: 'test-command',
  description: 'A test command',
  options: {
    name: option(type("string"), { description: 'Name option' }),
    count: option(type("number", "=", 1), { description: 'Count option' })
  },
  handler: async ({ flags }) => {
    console.log('Test command executed')
  }
})
`;
    await Bun.write(join(testDir, "test-command.ts"), testCommandContent);

    const scanner = new CommandScanner();
    const files = await scanner.scanCommands(testDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.includes("test-command.ts"))).toBe(true);

    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  test("should parse command metadata", async () => {
    // Ensure test directory exists
    await mkdir(testDir, { recursive: true });

    // Create a test command file
    const testCommandContent = `
import { defineCommand, option } from '@reliverse/rempts-core'
import { type } from 'arktype'

export default defineCommand({
  name: 'test-command',
  description: 'A test command',
  options: {
    name: option(type("string"), { description: 'Name option' }),
    count: option(type("number", "=", 1), { description: 'Count option' })
  },
  handler: async ({ flags }) => {
    console.log('Test command executed')
  }
})
`;
    await Bun.write(join(testDir, "test-command.ts"), testCommandContent);

    const commandFile = join(testDir, "test-command.ts");
    const outputFile = join(testDir, "commands.gen.ts");
    const metadata = await parseCommand(commandFile, testDir, outputFile);

    expect(metadata).toBeTruthy();
    expect(metadata?.name).toBe("test-command");
    expect(metadata?.description).toBe("A test command");

    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  test("should build types", () => {
    const mockCommands = [
      {
        name: "test-command",
        description: "A test command",
        filePath: join(testDir, "test-command.ts"),
        importPath: "./cmds/test-command",
        exportPath: "./cmds/test-command",
      },
    ];

    const types = buildTypes(mockCommands as any);
    expect(types).toContain("const modules: Record<GeneratedNames, Command<any>> = {");
    expect(types).toContain("'test-command'");
    expect(types).toContain("declare module '@reliverse/rempts-core'");
  });

  test("should generate complete types file", async () => {
    // Ensure test directory exists
    await mkdir(testDir, { recursive: true });

    // Create a test command file
    const testCommandContent = `
import { defineCommand, option } from '@reliverse/rempts-core'
import { type } from 'arktype'

export default defineCommand({
  name: 'test-command',
  description: 'A test command',
  options: {
    name: option(type("string"), { description: 'Name option' }),
    count: option(type("number", "=", 1), { description: 'Count option' })
  },
  handler: async ({ flags }) => {
    console.log('Test command executed')
  }
})
`;

    await Bun.write(join(testDir, "test-command.ts"), testCommandContent);

    // Create generator and run it
    const generator = new Generator({
      cmdsDir: testDir,
      outputFile,
    });

    await generator.run();

    // Check that output file was created
    const output = await Bun.file(outputFile).text();
    expect(output).toContain("const modules: Record<GeneratedNames, Command<any>> = {");
    expect(output).toContain("'test-command'");
    expect(output).toContain("name: 'test-command'");
    expect(output).toContain("description: 'A test command'");
    expect(output).toContain("export const generated =");

    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });
});
