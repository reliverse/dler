// packages/launcher/src/impl/launcher/validator.ts

import { ArgumentValidationError } from "./errors";
import type { CmdArgDefinition, CmdArgsSchema } from "./types";

export const validateArgValue = (
  argName: string,
  value: unknown,
  definition: CmdArgDefinition,
): boolean => {
  const expectedType =
    definition.type === "boolean"
      ? "boolean"
      : definition.type === "number"
        ? "number"
        : "string";

  if (typeof value !== expectedType) {
    throw new ArgumentValidationError(
      argName,
      `Expected ${expectedType}, got ${typeof value}`,
    );
  }

  // Check if value is in the allowed list
  if ("allowed" in definition && definition.allowed) {
    if (!definition.allowed.includes(value as never)) {
      const allowedValues = definition.allowed
        .map((v) => (typeof v === "string" ? `"${v}"` : String(v)))
        .join(", ");
      throw new ArgumentValidationError(
        argName,
        `Value must be one of: ${allowedValues}. Got: ${typeof value === "string" ? `"${value}"` : value}`,
      );
    }
  }

  if ("validate" in definition && definition.validate) {
    const result = definition.validate(value as never);
    if (result !== true) {
      throw new ArgumentValidationError(
        argName,
        typeof result === "string" ? result : "Validation failed",
      );
    }
  }

  return true;
};

export const validateRequiredArgs = (
  args: Record<string, unknown>,
  schema: CmdArgsSchema,
): void => {
  for (const [key, def] of Object.entries(schema)) {
    if (def.required && !(key in args)) {
      throw new ArgumentValidationError(
        key,
        `Required argument "${key}" is missing`,
      );
    }
  }
};
