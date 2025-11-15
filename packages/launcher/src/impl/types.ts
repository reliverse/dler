// packages/launcher/src/impl/launcher/types.ts

interface BaseArg {
  description?: string;
  aliases?: string[];
}

type StringArg = BaseArg & {
  type: "string";
  required?: boolean;
  default?: string;
  allowed?: string[];
  validate?: (value: string) => boolean | string;
};

type BooleanArg = BaseArg & {
  type: "boolean";
  required?: boolean;
  default?: boolean;
  allowed?: boolean[];
};

type NumberArg = BaseArg & {
  type: "number";
  required?: boolean;
  default?: number;
  allowed?: number[];
  validate?: (value: number) => boolean | string;
};

export type CmdArgDefinition = StringArg | BooleanArg | NumberArg;

export type CmdArgsSchema = Record<string, CmdArgDefinition>;

export interface CmdMeta {
  name: string;
  description?: string;
  version?: string;
  aliases?: string[];
  examples?: string[];
}

export interface CmdDefinition<T extends CmdArgsSchema = CmdArgsSchema> {
  handler: CmdHandler<T>;
  args: T;
  meta: CmdMeta;
}

export type CmdHandler<T extends CmdArgsSchema = CmdArgsSchema> = (context: {
  args: ParsedArgs<T>;
  parentArgs?: ParsedArgs<any>;
}) => Promise<void> | void;

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
  description?: string;
  aliases?: string[];
  version?: string;
  examples?: string[];
}

export interface CmdNode {
  name: string;
  path: string;
  depth: number;
  parent?: string;
  children: Map<string, CmdNode>;
  loader: CmdLoader;
  metadata: () => Promise<CmdMetadata>;
}

export interface DiscoveryResult {
  registry: CmdRegistry;
  aliases: Map<string, string>;
  metadata: Map<string, () => Promise<CmdMetadata>>;
  hierarchy: Map<string, CmdNode>;
  rootCommands: Set<string>;
}
