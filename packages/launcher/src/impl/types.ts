// packages/launcher/src/impl/launcher/types.ts

interface BaseArg {
  description?: string;
  aliases?: string[];
}

type StringArg = BaseArg & {
  type: "string";
  required?: boolean;
  default?: string;
  validate?: (value: string) => boolean | string;
};

type BooleanArg = BaseArg & {
  type: "boolean";
  required?: boolean;
  default?: boolean;
};

type NumberArg = BaseArg & {
  type: "number";
  required?: boolean;
  default?: number;
  validate?: (value: number) => boolean | string;
};

export type CmdArgDefinition = StringArg | BooleanArg | NumberArg;

export type CmdArgsSchema = Record<string, CmdArgDefinition>;

export interface CmdCfg {
  name: string;
  description: string;
  version?: string;
  aliases?: string[];
  examples?: string[];
  category?: string;
}

export interface CmdDefinition<T extends CmdArgsSchema = CmdArgsSchema> {
  handler: CmdHandler<T>;
  args: T;
  cfg: CmdCfg;
}

export type CmdHandler<T extends CmdArgsSchema = CmdArgsSchema> = (
  args: ParsedArgs<T>,
) => Promise<void> | void;

// Enhanced type inference for parsed arguments
type InferArgType<T extends CmdArgDefinition> = T["type"] extends "string"
  ? string
  : T["type"] extends "number"
    ? number
    : boolean;

type InferArgValue<T extends CmdArgDefinition> = T extends {
  required: true;
}
  ? InferArgType<T>
  : T extends { default: any }
    ? InferArgType<T>
    : InferArgType<T> | undefined;

export type ParsedArgs<T extends CmdArgsSchema> = {
  [K in keyof T]: InferArgValue<T[K]>;
};

export type CmdLoader = () => Promise<CmdDefinition>;

export type CmdRegistry = Map<string, CmdLoader>;

export interface CmdMetadata {
  name: string;
  description: string;
  category?: string;
  aliases?: string[];
  version?: string;
  examples?: string[];
}

export interface DiscoveryResult {
  registry: CmdRegistry;
  aliases: Map<string, string>;
  metadata: Map<string, () => Promise<CmdMetadata>>;
}
