import fs from "fs-extra";
import os from "node:os";
import path from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  convertImportPaths,
  normalizeQuotes,
} from "~/libs/sdk/sdk-impl/utils/utils-paths.js";

describe("Import Paths Converter", () => {
  let tempDir: string;

  // Create a temporary directory for testing
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "import-paths-test-"));
  });

  // Clean up after tests
  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("should convert relative imports to absolute imports", async () => {
    // Create a test file with relative imports
    const filePath = path.join(tempDir, "testFile.ts");
    const fileContent = `import { foo } from './foo';
export * from "./bar";`;
    await fs.writeFile(filePath, fileContent, "utf8");

    // Call conversion: relative -> absolute (distJsrDryRun: false so file is modified)
    const results = await convertImportPaths({
      baseDir: tempDir,
      distJsrDryRun: false,
      fromType: "relative",
      libsList: {},
      toType: "absolute",
    });

    // Read the modified file
    const modifiedContent = await fs.readFile(filePath, "utf8");

    // Compute the expected absolute paths
    const expectedFoo = path
      .resolve(path.dirname(filePath), "./foo")
      .replace(/\\/g, "/");
    const expectedBar = path
      .resolve(path.dirname(filePath), "./bar")
      .replace(/\\/g, "/");

    expect(normalizeQuotes(modifiedContent)).toContain(
      `import { foo } from "${expectedFoo}"`,
    );
    expect(normalizeQuotes(modifiedContent)).toContain(
      `export * from "${expectedBar}"`,
    );
    expect(results.some((r) => r.success === true)).toBe(true);
  });

  it("should convert relative imports to alias imports", async () => {
    // Create a test file with a relative import
    const filePath = path.join(tempDir, "testAlias.ts");
    const fileContent = `import foo from './foo';`;
    await fs.writeFile(filePath, fileContent, "utf8");

    // Convert relative -> alias
    await convertImportPaths({
      aliasPrefix: "~/",
      baseDir: tempDir,
      distJsrDryRun: false,
      fromType: "relative",
      libsList: {},
      toType: "alias",
    });

    // Read the modified file
    const modifiedContent = await fs.readFile(filePath, "utf8");
    expect(normalizeQuotes(modifiedContent)).toContain(
      `import foo from "~/foo"`,
    );
  });

  it("should convert complex relative imports to alias imports", async () => {
    // Create a test file with multiple relative imports (nested paths)
    const filePath = path.join(tempDir, "testComplexRelativeToAlias.ts");
    const fileContent = `
      import { a } from './folder/a';
      import b from './folder/b/index';
      export { default as c } from './folder/c';
    `;
    await fs.writeFile(filePath, fileContent, "utf8");

    // Convert relative -> alias
    await convertImportPaths({
      aliasPrefix: "~/",
      baseDir: tempDir,
      distJsrDryRun: false,
      fromType: "relative",
      libsList: {},
      toType: "alias",
    });

    // Read the modified file
    const modifiedContent = await fs.readFile(filePath, "utf8");

    expect(normalizeQuotes(modifiedContent)).toContain(
      `import { a } from "~/folder/a"`,
    );
    expect(normalizeQuotes(modifiedContent)).toContain(
      `import b from "~/folder/b/index"`,
    );
    expect(normalizeQuotes(modifiedContent)).toContain(
      `export { default as c } from "~/folder/c"`,
    );
  });

  it("should process dynamic imports", async () => {
    // Create a test file with a dynamic import
    const filePath = path.join(tempDir, "testDynamic.ts");
    const fileContent = `const mod = await import('./dynamicModule');`;
    await fs.writeFile(filePath, fileContent, "utf8");

    // Convert dynamic -> absolute
    await convertImportPaths({
      baseDir: tempDir,
      distJsrDryRun: false,
      fromType: "dynamic",
      libsList: {},
      toType: "absolute",
    });

    const modifiedContent = await fs.readFile(filePath, "utf8");
    const expectedDynamic = path
      .resolve(path.dirname(filePath), "./dynamicModule")
      .replace(/\\/g, "/");
    expect(normalizeQuotes(modifiedContent)).toContain(
      `import("${expectedDynamic}")`,
    );
  });

  it("should convert alias imports to relative imports", async () => {
    const filePath = path.join(tempDir, "testAliasToRelative.ts");
    const fileContent = `import foo from "~/foo";`;
    await fs.writeFile(filePath, fileContent, "utf8");

    await convertImportPaths({
      aliasPrefix: "~/",
      baseDir: tempDir,
      distJsrDryRun: false,
      fromType: "alias",
      libsList: {},
      toType: "relative",
    });

    const modifiedContent = await fs.readFile(filePath, "utf8");
    expect(normalizeQuotes(modifiedContent)).toContain(
      `import foo from "./foo"`,
    );
  });

  it("should convert alias imports to alias imports (no changes)", async () => {
    // Create a test file with an alias import
    const filePath = path.join(tempDir, "testAliasToAlias.ts");
    const fileContent = `import foo from "~/foo";`;
    await fs.writeFile(filePath, fileContent, "utf8");

    // Convert alias -> alias (conversion should result in no changes)
    await convertImportPaths({
      aliasPrefix: "~/",
      baseDir: tempDir,
      distJsrDryRun: false,
      fromType: "alias",
      libsList: {},
      toType: "alias",
    });

    // Read the modified file
    const modifiedContent = await fs.readFile(filePath, "utf8");
    expect(modifiedContent).toBe(fileContent);
  });

  it("should not change file if no matching imports are found", async () => {
    // Create a test file with an import that doesn't match the conversion criteria
    const filePath = path.join(tempDir, "noChange.ts");
    const fileContent = `import { bar } from "/absolute/path/bar";`;
    await fs.writeFile(filePath, fileContent, "utf8");

    // Try to convert from relative to absolute (won't match because it's already absolute)
    const results = await convertImportPaths({
      aliasPrefix: "~/",
      baseDir: tempDir,
      distJsrDryRun: false,
      fromType: "relative",
      libsList: {},
      toType: "absolute",
    });

    // Read the file again
    const modifiedContent = await fs.readFile(filePath, "utf8");
    expect(modifiedContent).toBe(fileContent);

    // Check that the result message indicates no matching import paths were found.
    const fileResult = results.find((r) => r.filePath === filePath);
    expect(fileResult?.message).toContain("No matching import paths found");
  });

  it("should throw an error when alias conversion is attempted without aliasPrefix", async () => {
    // Create a test file with an alias import
    const filePath = path.join(tempDir, "testMissingAlias.ts");
    const fileContent = `import foo from "~/foo";`;
    await fs.writeFile(filePath, fileContent, "utf8");

    // Attempt conversion without providing aliasPrefix and expect an error.
    await expect(
      convertImportPaths({
        baseDir: tempDir,
        // aliasPrefix is intentionally omitted
        distJsrDryRun: false,
        fromType: "alias",
        libsList: {},
        toType: "relative",
      }),
    ).rejects.toThrow("aliasPrefix is required for alias path conversions");
  });
});
