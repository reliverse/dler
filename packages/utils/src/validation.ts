import { type } from "arktype";

/**
 * Common validation utilities using arktype for consistent error handling
 * and type safety across the codebase.
 */

/**
 * Creates a branded type for compile-time guarantees
 * Note: This is a simplified version that works with basic types
 */
export const createBrandedType = <T extends string>(brand: T) =>
  (baseType: "string" | "number" | "boolean") =>
    type(baseType).brand(brand);

/**
 * File path validation with safety checks
 */
export const SafePath = type("string")
  .configure({
    description: "a safe file path",
  })
  .narrow((path: string, ctx) => {
    if (!path.trim()) {
      return ctx.reject("path cannot be empty or only whitespace");
    }

    // Prevent directory traversal attacks
    if (path.includes("../") || path.includes("..\\")) {
      return ctx.reject("path contains directory traversal which is not allowed");
    }

    // Prevent absolute paths in most contexts
    if (path.startsWith("/")) {
      console.warn("absolute paths may not work across different environments");
    }

    return true;
  });

/**
 * URL validation with protocol checking
 */
export const SafeUrl = type("string")
  .configure({
    description: "a valid URL with allowed protocols",
  })
  .narrow((url: string, ctx) => {
    try {
      const parsed = new URL(url);

      // Only allow safe protocols
      const allowedProtocols = ["http:", "https:", "ftp:"];
      if (!allowedProtocols.includes(parsed.protocol)) {
        return ctx.reject({
          expected: `URL with protocol: ${allowedProtocols.join(", ")}`,
          actual: parsed.protocol,
        });
      }

      return true;
    } catch {
      return ctx.reject("invalid URL format");
    }
  });

/**
 * Email validation using arktype built-in constraints
 */
export const Email = type("string.email")
  .configure({
    description: "a valid email address",
  });

/**
 * Port number validation with common service warnings
 */
export const Port = type("number.integer > 0 & number.integer < 65536")
  .configure({
    description: "a valid port number",
  })
  .narrow((port: number) => {
    // Warn about commonly used ports
    const commonPorts: Record<number, string> = {
      22: "SSH",
      25: "SMTP",
      53: "DNS",
      80: "HTTP",
      110: "POP3",
      143: "IMAP",
      443: "HTTPS",
      993: "IMAPS",
      995: "POP3S",
      3306: "MySQL",
      5432: "PostgreSQL",
      6379: "Redis",
      8080: "HTTP Alt",
      8443: "HTTPS Alt",
    };

    if (commonPorts[port]) {
      console.warn(`Port ${port} is commonly used by ${commonPorts[port]} - potential conflicts`);
    }

    return true;
  });

/**
 * Semver validation using arktype built-in constraints
 */
export const Semver = type("string.semver")
  .configure({
    description: "a valid semantic version",
  })
  .narrow((version: string) => {
    // Additional validation for pre-release versions
    if (version.includes("-")) {
      console.warn("pre-release version detected - ensure compatibility requirements");
    }
    return true;
  });

/**
 * Non-empty string validation
 */
export const NonEmptyString = type("string")
  .configure({
    description: "a non-empty string",
  })
  .narrow((str: string, ctx) => {
    return str.trim().length > 0 || ctx.reject("string cannot be empty or only whitespace");
  });

/**
 * Positive integer validation
 */
export const PositiveInteger = type("number.integer > 0")
  .configure({
    description: "a positive integer",
  });

/**
 * Creates a validated array with minimum and maximum length constraints
 */
export const createConstrainedArray = (
  itemType: "string" | "number" | "boolean",
  constraints: { minLength?: number; maxLength?: number } = {}
) => {
  const { minLength, maxLength } = constraints;

  return type(itemType)
    .array()
    .configure({
      description: `array of items${minLength ? ` (min ${minLength})` : ""}${maxLength ? ` (max ${maxLength})` : ""}`,
    })
    .narrow((arr: unknown[], ctx) => {
      if (minLength && arr.length < minLength) {
        return ctx.reject(`array must have at least ${minLength} items`);
      }
      if (maxLength && arr.length > maxLength) {
        return ctx.reject(`array must have at most ${maxLength} items`);
      }
      return true;
    });
};

/**
 * Creates a union type with custom error messages
 */
export const createUnionWithMessages = <T extends readonly [string, ...string[]]>(
  literals: T,
  descriptions?: Record<string, string>
) => {
  const unionString = literals.map(l => `'${l}'`).join(" | ") as any;

  return type(unionString)
    .configure({
      description: descriptions ? Object.values(descriptions).join(" | ") : `one of: ${literals.join(", ")}`,
    })
    .narrow((value: string, ctx) => {
      if (!literals.includes(value as any)) {
        const expected = descriptions
          ? Object.entries(descriptions).map(([k, v]) => `${k}: ${v}`).join(", ")
          : literals.join(", ");

        return ctx.reject({
          expected: `one of: ${expected}`,
          actual: value,
        });
      }
      return true;
    });
};

/**
 * Creates a morph that transforms data with validation
 */
export const createSafeMorph = <In, Out>(
  transformer: (input: In) => Out | Error,
  errorMessage?: string
) => {
  return (input: In) => {
    const result = transformer(input);
    if (result instanceof Error) {
      throw new Error(errorMessage || result.message);
    }
    return result;
  };
};

/**
 * Type guard helper for arktype validation results
 */
export const isValid = <T>(result: T | type.errors): result is T => {
  return !(result instanceof type.errors);
};

/**
 * Type assertion helper that throws on validation failure
 */
export const assertValid = <T>(result: T | type.errors, context?: string): T => {
  if (result instanceof type.errors) {
    const message = context ? `${context}: ${result.summary}` : result.summary;
    throw new Error(message);
  }
  return result;
};
