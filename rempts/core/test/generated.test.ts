import { describe, it, expect } from "bun:test";
import { createGeneratedHelpers } from "../src/generated";

describe("Generated Store", () => {
  it("should create helpers with empty modules", () => {
    const modules = {} as const;
    const metadata = {} as const;

    const helpers = createGeneratedHelpers(modules, metadata);

    expect(helpers).toHaveProperty("commands");
    expect(helpers).toHaveProperty("metadata");
    expect(helpers).toHaveProperty("list");
    expect(helpers).toHaveProperty("get");
    expect(helpers).toHaveProperty("validateCommand");
  });

  it("should validate commands safely without eval", () => {
    const modules = {
      test: {
        name: "test",
        description: "test command",
        options: {
          stringOpt: { type: "string", required: false, hasDefault: false },
          numberOpt: { type: "number", required: false, hasDefault: false },
          booleanOpt: { type: "boolean", required: false, hasDefault: false },
          arrayOpt: { type: "array", required: false, hasDefault: false },
        },
      },
    } as const;

    const metadata = {
      test: {
        name: "test",
        description: "test command",
        path: "./test",
        options: {
          stringOpt: {
            type: "string",
            required: false,
            hasDefault: false,
            validator: '(val) => typeof val === "string"',
          },
          numberOpt: {
            type: "number",
            required: false,
            hasDefault: false,
            validator: '(val) => typeof val === "number"',
          },
          booleanOpt: {
            type: "boolean",
            required: false,
            hasDefault: false,
            validator: '(val) => typeof val === "boolean"',
          },
          arrayOpt: {
            type: "array",
            required: false,
            hasDefault: false,
            validator: "(val) => Array.isArray(val)",
          },
        },
      },
    } as const;

    const helpers = createGeneratedHelpers(modules, metadata);

    // Test valid values
    expect(helpers.validateCommand("test", { stringOpt: "hello" })).toEqual({
      success: true,
      data: { stringOpt: "hello" },
    });

    expect(helpers.validateCommand("test", { numberOpt: 42 })).toEqual({
      success: true,
      data: { numberOpt: 42 },
    });

    expect(helpers.validateCommand("test", { booleanOpt: true })).toEqual({
      success: true,
      data: { booleanOpt: true },
    });

    expect(helpers.validateCommand("test", { arrayOpt: [1, 2, 3] })).toEqual({
      success: true,
      data: { arrayOpt: [1, 2, 3] },
    });

    // Test invalid values
    expect(helpers.validateCommand("test", { stringOpt: 123 })).toEqual({
      success: false,
      errors: ["Option 'stringOpt' failed validation: expected string"],
    });

    expect(helpers.validateCommand("test", { numberOpt: "not a number" })).toEqual({
      success: false,
      errors: ["Option 'numberOpt' failed validation: expected number"],
    });

    // Test required validation
    const modulesWithRequired = {
      test: {
        ...modules.test,
        options: {
          ...modules.test.options,
          requiredOpt: { type: "string", required: true, hasDefault: false },
        },
      },
    } as const;

    const metadataWithRequired = {
      test: {
        ...metadata.test,
        options: {
          ...metadata.test.options,
          requiredOpt: {
            type: "string",
            required: true,
            hasDefault: false,
            validator: '(val) => typeof val === "string"',
          },
        },
      },
    } as const;

    const helpersWithRequired = createGeneratedHelpers(modulesWithRequired, metadataWithRequired);

    expect(helpersWithRequired.validateCommand("test", {})).toEqual({
      success: false,
      errors: ["Option 'requiredOpt' is required"],
    });
  });

  it("should handle unknown validator types gracefully", () => {
    const modules = {
      test: {
        name: "test",
        options: {
          unknownOpt: { type: "unknown", required: false, hasDefault: false },
        },
      },
    } as const;

    const metadata = {
      test: {
        name: "test",
        description: "test command",
        path: "./test",
        options: {
          unknownOpt: {
            type: "unknown",
            required: false,
            hasDefault: false,
            validator: "invalid validator string",
          },
        },
      },
    } as const;

    const helpers = createGeneratedHelpers(modules, metadata);

    // Should not crash and should pass validation for unknown types
    expect(helpers.validateCommand("test", { unknownOpt: "anything" })).toEqual({
      success: true,
      data: { unknownOpt: "anything" },
    });
  });
});
