import type { CLI, Command } from "./types";

export interface GeneratedOptionMeta {
  type: string;
  required: boolean;
  hasDefault: boolean;
  default?: unknown;
  description?: string;
  short?: string;
  // NEW: Enhanced schema information
  schema?: any;
  validator?: string;
  fileType?: string; // For file/directory type options
}

export interface GeneratedCommandMeta {
  name: string;
  description: string;
  alias?: string | readonly string[];
  options?: Record<string, GeneratedOptionMeta>;
  commands?: GeneratedCommandMeta[];
  path: string;
}

/**
 * Safe validation function that replaces eval() for security
 */
function safeValidate(validatorName: string, value: unknown): boolean {
  // Parse validator type from the generated string format
  // Expected formats: '(val) => typeof val === "string"' etc.
  const typeMatch = validatorName.match(/typeof val === "(\w+)"/);
  if (typeMatch) {
    const expectedType = typeMatch[1];
    switch (expectedType) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number";
      case "boolean":
        return typeof value === "boolean";
      case "object":
        return typeof value === "object" && value !== null;
      default:
        return true;
    }
  }

  // Handle Array.isArray check
  if (validatorName.includes("Array.isArray(val)")) {
    return Array.isArray(value);
  }

  // Default to true for unknown validators
  return true;
}

export interface GeneratedStore<
  TModules extends Record<string, Command<any>>,
  TMeta extends Record<string, GeneratedCommandMeta>,
> {
  readonly commands: TModules;
  readonly metadata: TMeta;
  register(cli?: CLI<any>): GeneratedStore<TModules, TMeta>;
  list(): Array<{
    name: keyof TModules & string;
    command: TModules[keyof TModules & string];
    metadata: TMeta[keyof TModules & string];
  }>;
  get<Name extends keyof TModules & string>(name: Name): TModules[Name];
  getMetadata<Name extends keyof TModules & string>(name: Name): TMeta[Name];
  // Typed flags shape for compile-time DX (keys come from RegisteredCommands via augmentation)
  getFlags<Name extends keyof import("./types.js").RegisteredCommands & string>(
    name: Name
  ): Record<string, unknown>;
  // Raw metadata for UI/inspection
  getFlagsMeta<Name extends keyof TModules & string>(
    name: Name
  ): Record<string, GeneratedOptionMeta>;
  // Enhanced discovery methods
  findByName<Name extends keyof TModules & string>(
    name: Name
  ): {
    name: Name;
    command: TModules[Name];
    metadata: TMeta[Name];
  };
  findByDescription(searchTerm: string): Array<{
    name: keyof TModules & string;
    command: TModules[keyof TModules & string];
    metadata: TMeta[keyof TModules & string];
  }>;
  getCommandNames(): Array<keyof TModules & string>;
  // Runtime validation
  validateCommand<Name extends keyof TModules & string>(
    name: Name,
    flags: Record<string, unknown>
  ): { success: true; data: Record<string, unknown> } | { success: false; errors: string[] };
  withCLI(cli: CLI<any>): GeneratedExecutor<TModules>;
}

export interface GeneratedExecutor<_TModules extends Record<string, Command<any>>> {
  execute(name: string, options: unknown): Promise<void>;
}

const generatedStores: GeneratedStore<any, any>[] = [];

export function registerGeneratedStore<
  TModules extends Record<string, Command<any>>,
  TMeta extends Record<string, GeneratedCommandMeta>,
>(store: GeneratedStore<TModules, TMeta>): GeneratedStore<TModules, TMeta> {
  generatedStores.push(store);
  return store;
}

export function getGeneratedStores(): readonly GeneratedStore<any, any>[] {
  return generatedStores;
}

export function clearGeneratedStores(): void {
  generatedStores.length = 0;
}

export function loadGeneratedStores(cli?: CLI<any>): void {
  if (generatedStores.length === 0) {
    // Generated types are optional enhancements for developer experience.
    // Don't warn end users who don't need these types.
    return;
  }

  for (const generated of generatedStores) {
    generated.register(cli);
  }
}

export function createGeneratedHelpers<
  TModules extends Record<string, Command<any>>,
  TMeta extends Record<string, GeneratedCommandMeta>,
>(modules: TModules, metadata: TMeta): GeneratedStore<TModules, TMeta> {
  type CommandName = Extract<keyof TModules, string>;

  const store: GeneratedStore<TModules, TMeta> = {
    commands: modules,
    metadata,
    register(cli) {
      if (cli) {
        // Register commands with their names (keys from modules record)
        // Names come from file paths: <cmds-dir>/<cmd-name>/cmd.{ts,js,mjs}
        for (const [name, command] of Object.entries(modules) as [
          CommandName,
          Command<any, any>,
        ][]) {
          // Use type assertion to access internal command() method
          // This method exists on the implementation but not on the public CLI interface
          (cli as any).command(name, command);
        }
      }
      return store;
    },
    list() {
      return (Object.keys(modules) as CommandName[]).map((name) => ({
        name,
        command: modules[name],
        metadata: metadata[name],
      }));
    },
    findByName<Name extends keyof TModules & string>(name: Name) {
      return {
        name,
        command: modules[name],
        metadata: metadata[name],
      };
    },
    findByDescription(searchTerm: string) {
      const term = searchTerm.toLowerCase();
      return this.list().filter((item) => item.metadata.description.toLowerCase().includes(term));
    },
    getCommandNames(): CommandName[] {
      return Object.keys(modules) as CommandName[];
    },
    get(name) {
      return modules[name];
    },
    getMetadata(name) {
      return metadata[name];
    },
    getFlags<Name extends keyof TModules & string>(name: Name): Record<string, unknown> {
      // Build runtime type shape from metadata with proper typing
      const meta = metadata[name];
      if (!meta?.options) {
        return {};
      }

      const flagShape: Record<string, unknown> = {};
      for (const [key, option] of Object.entries(meta.options)) {
        if (option.hasDefault && option.default !== undefined) {
          flagShape[key] = option.default;
        }
      }
      return flagShape;
    },
    getFlagsMeta(name) {
      return (metadata[name]?.options ?? {}) as Record<string, GeneratedOptionMeta>;
    },
    validateCommand<Name extends keyof TModules & string>(
      name: Name,
      flags: Record<string, unknown>
    ): { success: true; data: Record<string, unknown> } | { success: false; errors: string[] } {
      const meta = metadata[name];
      if (!meta?.options) {
        return { success: true, data: {} };
      }

      const errors: string[] = [];
      const validatedFlags = {} as Record<string, unknown>;

      for (const [key, option] of Object.entries(meta.options)) {
        const value = flags[key];

        // Check required fields
        if (option.required && (value === undefined || value === null)) {
          errors.push(`Option '${key}' is required`);
          continue;
        }

        // Use runtime validator if available
        if (option.validator && value !== undefined) {
          try {
            const isValid = safeValidate(option.validator, value);
            if (!isValid) {
              errors.push(`Option '${key}' failed validation: expected ${option.type}`);
              continue;
            }
          } catch (error) {
            errors.push(`Option '${key}' validation error: ${error}`);
            continue;
          }
        }

        // Set default value if not provided
        if (value === undefined && option.hasDefault && option.default !== undefined) {
          validatedFlags[key] = option.default;
        } else if (value !== undefined) {
          validatedFlags[key] = value;
        }
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      return { success: true, data: validatedFlags };
    },
    withCLI(cli) {
      const executor = cli.execute.bind(cli) as (
        commandName: string,
        options: unknown
      ) => Promise<void>;
      return {
        execute(name, options) {
          return executor(name, options);
        },
      };
    },
  };

  return store;
}
