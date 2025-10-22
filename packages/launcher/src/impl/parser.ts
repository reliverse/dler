// packages/launcher/src/impl/launcher/parser.ts

import { ArgumentValidationError } from "./errors";
import type { CmdArgsSchema } from "./types";
import { validateArgValue } from "./validator";

interface ParseResult {
  cmdName: string;
  parsedArgs: Record<string, unknown>;
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

// Global cache for schema metadata to avoid recomputation
const schemaMetadataCache = new Map<string, SchemaMetadata>();

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

// Lightweight hash function for schema keys
const hashSchema = (schema: CmdArgsSchema): string => {
  const keys = Object.keys(schema).sort();
  return keys.join("|");
};

const getSchemaMetadata = (schema: CmdArgsSchema): SchemaMetadata => {
  // Create a cache key from schema structure using lightweight hash
  const schemaKey = hashSchema(schema);

  let metadata = schemaMetadataCache.get(schemaKey);
  if (!metadata) {
    metadata = createSchemaMetadata(schema);
    schemaMetadataCache.set(schemaKey, metadata);
  }

  return metadata;
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
