import { runCmd } from "@reliverse/rempts";
import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { readFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { getMigrateCmd } from "~/app/cmds";

type TsConfig = {
  compilerOptions: {
    moduleResolution?: string;
    module?: string;
    target?: string;
    noEmit?: boolean;
  };
};

type PackageJson = {
  type?: "module" | "commonjs";
  dependencies?: Record<string, string>;
};

describe("Module Resolution Migration", () => {
  const originalCwd = process.cwd();
  let testDir: string;
  let tsConfigPath: string;
  let packageJsonPath: string;
  let testFile: string;

  beforeEach(async () => {
    // Create a unique test directory for each test
    testDir = resolve(originalCwd, `.test-migrate-${Date.now()}`);
    tsConfigPath = join(testDir, "tsconfig.json");
    packageJsonPath = join(testDir, "package.json");
    testFile = join(testDir, "src", "test.ts");

    // Create test directory structure
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, "src"), { recursive: true });

    // Create test files
    await Bun.write(
      tsConfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            moduleResolution: "node",
            module: "commonjs",
            target: "ES2022",
          },
        },
        null,
        2,
      ),
    );

    await Bun.write(
      packageJsonPath,
      JSON.stringify(
        {
          type: "commonjs",
          dependencies: {},
        },
        null,
        2,
      ),
    );

    // Create test file with explicit imports
    await Bun.write(
      testFile,
      `
import { something } from "./other.ts";
import { another } from "../utils/helper.ts";
import { third } from "@/components/third.ts";
    `,
    );

    // Change to test directory for command execution
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Change back to original directory
    process.chdir(originalCwd);

    // Add a small delay to ensure all file handles are closed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Clean up test directory
    try {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`Failed to clean up test directory ${testDir}:`, error);
      // Try again after a longer delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        if (existsSync(testDir)) {
          rmSync(testDir, { recursive: true, force: true });
        }
      } catch (error) {
        console.error(`Failed to clean up test directory ${testDir} after retry:`, error);
      }
    }
  });

  test("should migrate to nodenext module resolution", async () => {
    const cmd = await getMigrateCmd();
    await runCmd(cmd, ["--lib", "nodenext-bundler", "--target", "nodenext"]);

    // Check tsconfig.json
    const tsConfig = JSON.parse(await readFile(tsConfigPath, "utf-8")) as TsConfig;
    expect(tsConfig.compilerOptions.moduleResolution).toBe("nodenext");
    expect(tsConfig.compilerOptions.module).toBe("nodenext");

    // Check package.json
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8")) as PackageJson;
    expect(packageJson.type).toBe("module");

    // Check test file
    const testContent = await readFile(testFile, "utf-8");
    expect(testContent).toContain('from "./other.js"');
    expect(testContent).toContain('from "../utils/helper.js"');
    expect(testContent).toContain('from "@/components/third.js"');
  });

  test("should migrate to bundler module resolution", async () => {
    const cmd = await getMigrateCmd();
    await runCmd(cmd, ["--lib", "nodenext-bundler", "--target", "bundler"]);

    // Check tsconfig.json
    const tsConfig = JSON.parse(await readFile(tsConfigPath, "utf-8")) as TsConfig;
    expect(tsConfig.compilerOptions.moduleResolution).toBe("bundler");
    expect(tsConfig.compilerOptions.module).toBe("preserve");
    expect(tsConfig.compilerOptions.noEmit).toBe(true);

    // Check package.json
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8")) as PackageJson;
    expect(packageJson.type).toBe("module");

    // Check test file
    const testContent = await readFile(testFile, "utf-8");
    expect(testContent).toContain('from "./other"');
    expect(testContent).toContain('from "../utils/helper"');
    expect(testContent).toContain('from "@/components/third"');
  });

  test("should handle dry run correctly ()", async () => {
    const cmd = await getMigrateCmd();
    await runCmd(cmd, ["--lib", "nodenext-bundler", "--target", "nodenext", "--dryRun"]);

    // Check that files were not modified
    const tsConfig = JSON.parse(await readFile(tsConfigPath, "utf-8")) as TsConfig;
    expect(tsConfig.compilerOptions.moduleResolution).toBe("node");
    expect(tsConfig.compilerOptions.module).toBe("commonjs");

    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8")) as PackageJson;
    expect(packageJson.type).toBe("commonjs");

    const testContent = await readFile(testFile, "utf-8");
    expect(testContent).toContain('from "./other.ts"');
    expect(testContent).toContain('from "../utils/helper.ts"');
    expect(testContent).toContain('from "@/components/third.ts"');
  });

  test("should handle invalid target (`Invalid target: invalid` should be printed)", async () => {
    const cmd = await getMigrateCmd();
    try {
      await runCmd(cmd, ["--lib", "nodenext-bundler", "--target", "invalid"]);
      throw new Error("Expected command to fail");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
