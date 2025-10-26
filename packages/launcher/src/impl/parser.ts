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
  defaults: Record<string, unknown>;
  requiredKeys: Set<string>;
  availableKeys: string[];
}

const camelCase = (str: string): string =>
  str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

const createSchemaMetadata = (schema: CmdArgsSchema): SchemaMetadata => {
  const aliasMap = new Map<string, string>();
  const camelCaseCache = new Map<string, string>();
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

    // Handle aliases
    if (def.aliases) {
      for (const alias of def.aliases) {
        aliasMap.set(alias, key);
        // Pre-cache camelCase conversion for aliases
        const camelAlias = camelCase(alias);
        if (camelAlias !== alias) {
          camelCaseCache.set(alias, camelAlias);
        }
      }
    }

    // Track defaults and required keys
    if ("default" in def && def.default !== undefined) {
      defaults[key] = def.default;
    }
    if (def.required) {
      requiredKeys.add(key);
    }
  }

  return {
    aliasMap,
    camelCaseCache,
    defaults,
    requiredKeys,
    availableKeys,
  };
};

const getSchemaMetadata = (schema: CmdArgsSchema): SchemaMetadata => {
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

  // Get pre-computed schema metadata
  const { aliasMap, camelCaseCache, defaults, requiredKeys, availableKeys } =
    getSchemaMetadata(schema);

  const parsedArgs: Record<string, unknown> = { ...defaults };

  // Single-pass argument parsing
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (!arg || !arg.startsWith("-")) continue;

    const isLongForm = arg.startsWith("--");
    const flagName = arg.slice(isLongForm ? 2 : 1);
    const actualKey =
      aliasMap.get(flagName) ??
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
      parsedArgs[actualKey] = true;
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
