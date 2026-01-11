import type { InferOptions, Options, StandardSchemaV1 } from "./types";
import { RemptsValidationError } from "./types";

export interface ParsedArgs<TOptions extends Options = Options> {
  flags: InferOptions<TOptions>;
  positional: string[];
}

/**
 * Convert kebab-case string to camelCase
 */
function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export async function parseArgs<TOptions extends Options = Options>(
  args: string[],
  options: TOptions,
  commandName = "unknown"
): Promise<ParsedArgs<TOptions>> {
  const flags: Record<string, unknown> = {};
  const positional: string[] = [];

  // Build lookup maps for short aliases
  const shortToName = new Map<string, string>();
  for (const [name, opt] of Object.entries(options)) {
    if (opt.short) {
      shortToName.set(opt.short, name);
    }
  }

  // Parse arguments
  let stopParsingFlags = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }

    // Handle -- separator: everything after is positional
    if (arg === "--") {
      stopParsingFlags = true;
      continue;
    }

    // After -- separator, treat everything as positional
    if (stopParsingFlags) {
      positional.push(arg);
      continue;
    }

    if (arg.startsWith("--")) {
      // Long flag: --name or --name=value
      const eqIndex = arg.indexOf("=");
      const kebabName = eqIndex > 0 ? arg.slice(2, eqIndex) : arg.slice(2);
      const name = kebabToCamel(kebabName);
      const inlineValue = eqIndex > 0 ? arg.slice(eqIndex + 1) : undefined;

      if (!(name && options[name])) {
        continue;
      }

      // Get the value (inline, next arg, or 'true' for boolean-like flags)
      let value: string | undefined = inlineValue;
      if (value === undefined) {
        // Check if this option only accepts boolean values
        const isStrictBooleanFlag = await isStrictBooleanOption(options[name]?.schema);
        if (!isStrictBooleanFlag && i + 1 < args.length && !args[i + 1]?.startsWith("-")) {
          value = args[++i];
        }
      }

      // Pass the value to the schema for validation
      flags[name] = await validateOption(name, value ?? "true", options[name]?.schema, commandName);
    } else if (arg.startsWith("-") && arg.length > 1) {
      // Short flag: -n or -n value
      const short = arg.slice(1);
      const name = shortToName.get(short);

      if (name && options[name]) {
        // Check if this option only accepts boolean values (not boolean|string)
        const isStrictBooleanFlag = await isStrictBooleanOption(options[name]?.schema);

        // Get the next argument as value only if it's not a strict boolean flag
        let value: string | undefined;
        if (!isStrictBooleanFlag && i + 1 < args.length && !args[i + 1]?.startsWith("-")) {
          value = args[++i];
        }

        flags[name] = await validateOption(
          name,
          value ?? "true",
          options[name]?.schema,
          commandName
        );
      }
    } else {
      // Positional argument
      positional.push(arg);
    }
  }

  // Validate all options were provided (schemas handle their own defaults/required logic)
  // We run validation with undefined for options not provided on command line
  // If a schema has a default value, it will be used during validation
  for (const [name, opt] of Object.entries(options)) {
    if (!(name in flags)) {
      // Check if the option has an explicit default value
      if (opt.default !== undefined) {
        // Validate the default value against the schema
        const defaultValidated = await validateOption(name, opt.default, opt.schema, commandName);
        flags[name] = defaultValidated;
      } else {
        // No explicit default, validate undefined
        const validatedValue = await validateOption(name, undefined, opt.schema, commandName);

        // For boolean flags that weren't provided, default to false instead of undefined
        // This is a common CLI pattern and makes boolean flags more intuitive to use
        if (validatedValue === undefined) {
          // Check if the schema accepts boolean values
          const booleanTest = await opt.schema["~standard"].validate(false);
          if (booleanTest.issues) {
            // Schema doesn't accept boolean, keep undefined
            flags[name] = undefined;
          } else {
            // Schema accepts boolean, so default to false
            flags[name] = false;
          }
        } else {
          // Validation returned a value (could be a default from the schema)
          flags[name] = validatedValue;
        }
      }
    }
  }

  // Type assertion: flags are validated at runtime, so we can safely assert the type
  return { flags: flags as InferOptions<TOptions>, positional };
}

async function validateOption(
  name: string,
  value: unknown,
  schema: StandardSchemaV1,
  commandName = "unknown"
): Promise<unknown> {
  // Convert string 'true'/'false' to boolean for boolean schemas
  let processedValue = value;
  if (typeof value === "string" && (value === "true" || value === "false")) {
    // Check if the schema expects a boolean by trying to validate true
    const testResult = await schema["~standard"].validate(true);
    if (!testResult.issues) {
      // Schema accepts boolean, convert the string
      processedValue = value === "true";
    }
  }

  // Use Standard Schema validation
  const result = await schema["~standard"].validate(processedValue);

  if (result.issues && result.issues.length > 0) {
    const issue = result.issues[0];
    if (!issue) {
      return processedValue; // Fallback if no issues
    }

    const expectedType = extractSchemaType(schema);
    const hint = generateHint(schema, value);

    throw new RemptsValidationError(`Invalid option '${name}': ${issue.message}`, {
      option: name,
      value,
      command: commandName,
      expectedType,
      hint,
    });
  }

  return "value" in result ? result.value : processedValue;
}

/**
 * Extract a human-readable type description from a schema
 */
function extractSchemaType(schema: StandardSchemaV1): string {
  // Try to infer type from the schema structure
  if ("type" in schema && typeof schema.type === "string") {
    return schema.type;
  }

  // Fallback to checking common patterns
  if ("enum" in schema) {
    return "enum";
  }
  if ("items" in schema) {
    return "array";
  }
  if ("properties" in schema) {
    return "object";
  }
  if ("format" in schema) {
    return "string";
  }

  return "unknown";
}

/**
 * Check if a schema ONLY accepts boolean values (not boolean|string etc.)
 */
async function isStrictBooleanOption(schema: StandardSchemaV1): Promise<boolean> {
  // Check if it accepts boolean values
  const trueResult = await schema["~standard"].validate(true);
  const falseResult = await schema["~standard"].validate(false);

  // Check if it rejects non-boolean values
  const stringResult = await schema["~standard"].validate("true");

  // It's a strict boolean if it accepts true/false but rejects strings
  return !(trueResult.issues || falseResult.issues) && !!stringResult.issues;
}

/**
 * Generate a helpful hint based on the schema and value
 */
function generateHint(schema: StandardSchemaV1, value: unknown): string {
  const type = extractSchemaType(schema);

  if (type === "boolean" && typeof value === "string") {
    return "Use --flag or --no-flag for boolean options";
  }
  if (type === "number" && typeof value === "string") {
    return "Provide a numeric value";
  }
  if (type === "array" && !Array.isArray(value)) {
    return "Provide a comma-separated list of values";
  }
  if (type === "enum" && typeof value === "string") {
    return "Choose from the available options";
  }
  return "";
}
