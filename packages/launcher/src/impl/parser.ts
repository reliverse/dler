// packages/launcher/src/impl/launcher/parser.ts

import { ArgumentValidationError } from "./errors";
import type { CmdArgsSchema } from "./types";
import { validateArgValue } from "./validator";

interface ParseResult {
  cmdName: string;
  parsedArgs: Record<string, unknown>;
}

interface ChainParseResult {
  cmdChain: string[];
  parsedArgs: Record<string, unknown>[];
  remainingArgs: string[];
}

interface SchemaMetadata {
  aliasMap: Map<string, string>;
  camelCaseCache: Map<string, string>;
  kebabCaseMap: Map<string, string>;
  defaults: Record<string, unknown>;
  requiredKeys: Set<string>;
  availableKeys: string[];
}

const camelCase = (str: string): string =>
  str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

export const kebabCase = (str: string): string => {
  // Convert camelCase/PascalCase to kebab-case
  // e.g., "skipTip2FA" -> "skip-tip-2fa"
  if (!str) return str;

  // First, handle lowercase+number+uppercase pattern (e.g., "e2F" -> "e-2F")
  // This keeps the number with the following uppercase
  let result = str.replace(
    /([a-z])([0-9])([A-Z])/g,
    (_, g1, g2, g3) => `${g1}-${g2}${g3}`,
  );

  // Then insert hyphens before uppercase letters that follow lowercase/number
  // But skip if there's already a hyphen (from step 1)
  result = result.replace(
    /([a-z0-9])([A-Z])/g,
    (match, g1, g2, offset, string) => {
      // Check if there's already a hyphen before this match
      if (offset > 0 && string[offset - 1] === "-") {
        return match; // Don't add another hyphen
      }
      return `${g1}-${g2}`;
    },
  );

  // Handle consecutive capitals before lowercase (e.g., "FA" before "T" -> "FA-T")
  result = result.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2");

  return result.toLowerCase();
};

const createSchemaMetadata = (schema: Record<string, any>): SchemaMetadata => {
  const aliasMap = new Map<string, string>();
  const camelCaseCache = new Map<string, string>();
  const kebabCaseMap = new Map<string, string>();
  const defaults: Record<string, unknown> = {};
  const requiredKeys = new Set<string>();
  const availableKeys: string[] = [];

  for (const [key, def] of Object.entries(schema)) {
    availableKeys.push(key);

    // Pre-cache camelCase conversion for main key
    const camelKey = camelCase(key);
    if (camelKey !== key) {
      camelCaseCache.set(key, camelKey);
    }

    // Build kebab-case map: map kebab-case variant back to original key
    const kebabKey = kebabCase(key);
    if (kebabKey !== key) {
      kebabCaseMap.set(kebabKey, key);
    }

    // Handle aliases
    if (def.aliases) {
      for (const alias of def.aliases) {
        aliasMap.set(alias, key);
        // Pre-cache camelCase conversion for aliases
        const camelAlias = camelCase(alias);
        if (camelAlias !== alias) {
          camelCaseCache.set(alias, camelAlias);
        }
        // Also map kebab-case variant of aliases
        const kebabAlias = kebabCase(alias);
        if (kebabAlias !== alias) {
          kebabCaseMap.set(kebabAlias, key);
        }
      }
    }

    // Track defaults and required keys
    if ("default" in def && def.default !== undefined) {
      // Validate default value against allowed list if present
      if ("allowed" in def && def.allowed) {
        if (!def.allowed.includes(def.default as never)) {
          const allowedValues = def.allowed
            .map((v: unknown) => (typeof v === "string" ? `"${v}"` : String(v)))
            .join(", ");
          throw new ArgumentValidationError(
            key,
            `Default value must be one of: ${allowedValues}. Got: ${typeof def.default === "string" ? `"${def.default}"` : def.default}`,
          );
        }
      }
      defaults[key] = def.default;
    }
    if (def.required) {
      requiredKeys.add(key);
    }
  }

  return {
    aliasMap,
    camelCaseCache,
    kebabCaseMap,
    defaults,
    requiredKeys,
    availableKeys,
  };
};

const getSchemaMetadata = (schema: Record<string, any>): SchemaMetadata => {
  return createSchemaMetadata(schema);
};

export const parseArgs = (
  argv: string[],
  schema: CmdArgsSchema,
): ParseResult => {
  const [cmdName, ...rawArgs] = argv;

  if (!cmdName) {
    throw new ArgumentValidationError("command", "No command provided");
  }

  // Collect positional argument keys in order
  const positionalKeys = Object.entries(schema)
    .filter(([, def]) => (def as any).positional === true)
    .map(([key]) => key);

  return parseArgsWithPositionalSupport(
    cmdName,
    rawArgs,
    schema,
    positionalKeys,
  );
};

const parseArgsWithPositionalSupport = (
  cmdName: string,
  rawArgs: string[],
  schema: Record<string, any>,
  positionalKeys: string[],
): ParseResult => {
  // Get pre-computed schema metadata
  const {
    aliasMap,
    camelCaseCache,
    kebabCaseMap,
    defaults,
    requiredKeys,
    availableKeys,
  } = getSchemaMetadata(schema);

  const parsedArgs: Record<string, unknown> = { ...defaults };
  let positionalIndex = 0;

  // Single-pass argument parsing
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    // Handle positional arguments (non-flag arguments)
    if (!arg || !arg.startsWith("-")) {
      if (!arg) continue;

      // This is a positional argument
      if (positionalIndex < positionalKeys.length) {
        const positionalKey = positionalKeys[positionalIndex]!;
        const definition = schema[positionalKey];

        let value: string | number = arg;
        if (definition.type === "number") {
          value = Number(arg);
          if (Number.isNaN(value)) {
            throw new ArgumentValidationError(
              positionalKey,
              `Expected number for positional argument "${positionalKey}", got "${arg}"`,
            );
          }
        }

        validateArgValue(positionalKey, value, definition);
        parsedArgs[positionalKey] = value;
        positionalIndex++;
      } else {
        throw new ArgumentValidationError(
          `positional_${positionalIndex}`,
          `Too many positional arguments. Expected ${positionalKeys.length}, got at least ${positionalIndex + 1}`,
        );
      }
      continue;
    }

    const isLongForm = arg.startsWith("--");
    let flagName = arg.slice(isLongForm ? 2 : 1);
    let isNegated = false;

    // Handle --no-* convention for boolean flags
    if (isLongForm && flagName.startsWith("no-")) {
      flagName = flagName.slice(3); // Remove "no-" prefix
      isNegated = true;
    }

    const actualKey =
      aliasMap.get(flagName) ??
      kebabCaseMap.get(flagName) ??
      camelCaseCache.get(flagName) ??
      camelCase(flagName);

    const definition = schema[actualKey];

    if (!definition) {
      throw new ArgumentValidationError(
        flagName,
        `Unknown argument. Available: ${availableKeys.join(", ")}`,
      );
    }

    if (definition.type === "boolean") {
      // If --no-* convention was used, set to false
      if (isNegated) {
        // Check if a value was provided after --no-* flag
        const nextArg = rawArgs[i + 1];
        if (nextArg !== undefined && !nextArg.startsWith("-")) {
          const lowerNext = nextArg.toLowerCase();
          // If it's a boolean-like value, it's an error
          if (
            lowerNext === "true" ||
            lowerNext === "false" ||
            lowerNext === "1" ||
            lowerNext === "0" ||
            lowerNext === "yes" ||
            lowerNext === "no" ||
            lowerNext === "on" ||
            lowerNext === "off"
          ) {
            throw new ArgumentValidationError(
              flagName,
              `--no-* flags cannot accept values. Use --${flagName} ${nextArg} instead of --no-${flagName} ${nextArg}`,
            );
          }
          // If it's not a boolean value, treat it as a positional argument
          // and just set the flag to false (ignore the value)
        }
        const falseValue = false;
        validateArgValue(actualKey, falseValue, definition);
        parsedArgs[actualKey] = falseValue;
        continue;
      }
      // Check if next argument is an explicit boolean value
      const nextArg = rawArgs[i + 1];
      if (nextArg !== undefined && !nextArg.startsWith("-")) {
        // Try to parse as boolean
        const lowerNext = nextArg.toLowerCase();
        if (
          lowerNext === "true" ||
          lowerNext === "1" ||
          lowerNext === "yes" ||
          lowerNext === "on"
        ) {
          const trueValue = true;
          validateArgValue(actualKey, trueValue, definition);
          parsedArgs[actualKey] = trueValue;
          i++; // Skip the value
          continue;
        }
        if (
          lowerNext === "false" ||
          lowerNext === "0" ||
          lowerNext === "no" ||
          lowerNext === "off"
        ) {
          const falseValue = false;
          validateArgValue(actualKey, falseValue, definition);
          parsedArgs[actualKey] = falseValue;
          i++; // Skip the value
          continue;
        }
        // If it's not a recognized boolean value, treat it as a positional argument
        // and set the flag to true (default behavior)
      }
      const trueValue = true;
      validateArgValue(actualKey, trueValue, definition);
      parsedArgs[actualKey] = trueValue;
      continue;
    }

    const nextArg = rawArgs[++i];
    if (nextArg === undefined || nextArg.startsWith("-")) {
      throw new ArgumentValidationError(
        flagName,
        `Expected value for argument "${flagName}"`,
      );
    }

    let value: string | number = nextArg;
    if (definition.type === "number") {
      value = Number(nextArg);
      if (Number.isNaN(value)) {
        throw new ArgumentValidationError(
          flagName,
          `Expected number, got "${nextArg}"`,
        );
      }
    }

    validateArgValue(actualKey, value, definition);
    parsedArgs[actualKey] = value;
  }

  // Validate required arguments
  for (const requiredKey of requiredKeys) {
    if (!(requiredKey in parsedArgs)) {
      throw new ArgumentValidationError(
        requiredKey,
        `Required argument "${requiredKey}" is missing`,
      );
    }
  }

  return { cmdName, parsedArgs };
};

export const parseCommandChain = (
  argv: string[],
  schemas: CmdArgsSchema[],
): ChainParseResult => {
  const cmdChain: string[] = [];
  const parsedArgs: Record<string, unknown>[] = [];
  let remainingArgs = [...argv];

  for (let i = 0; i < schemas.length; i++) {
    const schema = schemas[i];
    if (!schema) break;

    // Find the next command in the chain
    let cmdName = "";
    let argsStartIndex = 0;

    for (let j = 0; j < remainingArgs.length; j++) {
      const arg = remainingArgs[j];
      if (arg && !arg.startsWith("-")) {
        cmdName = arg;
        argsStartIndex = j + 1;
        break;
      }
    }

    if (!cmdName) {
      throw new ArgumentValidationError("command", "No command provided");
    }

    cmdChain.push(cmdName);

    // Extract args for this command
    const commandArgs: string[] = [];
    for (let j = argsStartIndex; j < remainingArgs.length; j++) {
      const arg = remainingArgs[j];
      if (!arg) continue;

      if (!arg.startsWith("-")) {
        // Found next command, stop here
        remainingArgs = remainingArgs.slice(j);
        break;
      }
      commandArgs.push(arg);
    }

    // Parse args for this command
    const { parsedArgs: cmdParsedArgs } = parseArgs(
      [cmdName, ...commandArgs],
      schema,
    );
    parsedArgs.push(cmdParsedArgs);
  }

  return { cmdChain, parsedArgs, remainingArgs };
};
