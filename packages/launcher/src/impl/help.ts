// packages/launcher/src/impl/help.ts

import { re } from "@reliverse/dler-colors";
import pMap from "@reliverse/dler-mapper";
import type {
  CmdArgsSchema,
  CmdDefinition,
  CmdMetadata,
  DiscoveryResult,
} from "./types";

// Pre-computed help templates to avoid string concatenation
const HELP_TEMPLATES = {
  commandHeader: (name: string, description: string) =>
    `\n${re.bold.cyan(name)} - ${re.gray(description)}`,
  version: (version: string) => `${re.yellow("Version:")} ${re.white(version)}`,
  usage: (name: string) =>
    `\n${re.bold("Usage:")}\n  ${re.green(name)} ${re.gray("[options]")}`,
  usageWithSubCommands: (name: string) =>
    `\n${re.bold("Usage:")}\n  ${re.green(name)} ${re.gray("[subcommand] [options]")}`,
  usageWithPositionals: (name: string, positionalStr: string) =>
    `\n${re.bold("Usage:")}\n  ${re.green(name)} ${positionalStr} ${re.gray("[options]")}`,
  optionsHeader: `\n${re.bold("Options:")}`,
  argumentsHeader: `\n${re.bold("Arguments:")}`,
  requiredNote: `\n${re.red("*")} = ${re.gray("required")}`,
  examplesHeader: `\n${re.bold("Examples:")}`,
  globalHeader: `\n${re.bold("Available commands:")}\n`,
  helpFooter: `\n${re.gray('Use "command --help" for command-specific help')}\n`,
} as const;

const getPositionalName = (name: string): string => {
  return name.toUpperCase();
};

const formatArgName = (name: string, def: CmdArgsSchema[string]): string => {
  const aliases = def.aliases ? re.gray(` (-${def.aliases.join(", -")})`) : "";
  const required = def.required ? re.red("*") : "";
  return `${re.cyan(`--${name}`)}${aliases}${required}`;
};

const formatArgType = (def: CmdArgsSchema[string]): string => {
  if (def.type === "boolean") return "";
  return re.dim(`<${def.type}>`);
};

const getArgHelp = (name: string, def: CmdArgsSchema[string]): string => {
  const argName = formatArgName(name, def);
  const argType = formatArgType(def);
  const desc = def.description ?? "";
  const defaultVal =
    "default" in def && def.default !== undefined
      ? re.gray(` (default: ${def.default})`)
      : "";
  const allowedVal =
    "allowed" in def && def.allowed && def.allowed.length > 0
      ? re.gray(
          ` (allowed: ${def.allowed.map((v: unknown) => (typeof v === "string" ? `"${v}"` : String(v))).join(", ")})`,
        )
      : "";

  return `  ${argName} ${argType}\n      ${desc}${defaultVal}${allowedVal}`;
};

const getPositionalArgHelp = (name: string, def: any): string => {
  const required = def.required ? re.red("*") : "";
  const argName = `${re.cyan(getPositionalName(name))}${required}`;
  const argType = def.type ? re.dim(`<${def.type}>`) : "";
  const desc = def.description ?? "";
  const defaultVal =
    "default" in def && def.default !== undefined
      ? re.gray(` (default: ${def.default})`)
      : "";
  const allowedVal =
    "allowed" in def && def.allowed && def.allowed.length > 0
      ? re.gray(
          ` (allowed: ${def.allowed.map((v: unknown) => (typeof v === "string" ? `"${v}"` : String(v))).join(", ")})`,
        )
      : "";

  return `  ${argName} ${argType}\n      ${desc}${defaultVal}${allowedVal}`;
};

export const generateCommandHelp = async (
  definition: CmdDefinition,
): Promise<string> => {
  const { meta, args } = definition;

  const lines: string[] = [
    HELP_TEMPLATES.commandHeader(
      meta.name,
      meta.description || "No description available",
    ),
  ];

  if (meta.version) {
    lines.push(HELP_TEMPLATES.version(meta.version));
  }

  // Separate positional and flag arguments
  const positionalArgs: [string, any][] = [];
  const flagArgs: [string, any][] = [];

  for (const [name, def] of Object.entries(args)) {
    if ((def as any).positional === true) {
      positionalArgs.push([name, def]);
    } else {
      flagArgs.push([name, def]);
    }
  }

  // Build positional arguments string for usage
  let positionalStr = "";
  if (positionalArgs.length > 0) {
    const positionalParts = positionalArgs.map(
      ([name, def]) =>
        `${def.required ? "" : "["}${getPositionalName(name)}${def.required ? "" : "]"}`,
    );
    positionalStr = positionalParts.join(" ");
  }

  // Display usage
  if (positionalArgs.length > 0) {
    lines.push(HELP_TEMPLATES.usageWithPositionals(meta.name, positionalStr));
  } else {
    lines.push(HELP_TEMPLATES.usage(meta.name));
  }

  // Display positional arguments
  if (positionalArgs.length > 0) {
    lines.push(HELP_TEMPLATES.argumentsHeader);
    for (const [name, def] of positionalArgs) {
      lines.push(getPositionalArgHelp(name, def));
    }
    lines.push(HELP_TEMPLATES.requiredNote);
  }

  // Display flag arguments
  if (flagArgs.length > 0) {
    lines.push(HELP_TEMPLATES.optionsHeader);
    for (const [name, def] of flagArgs) {
      lines.push(getArgHelp(name, def));
    }
    if (positionalArgs.length === 0) {
      lines.push(HELP_TEMPLATES.requiredNote);
    }
  }

  if (meta.examples && meta.examples.length > 0) {
    lines.push(HELP_TEMPLATES.examplesHeader);
    for (const example of meta.examples) {
      lines.push(`  ${re.cyan(example)}`);
    }
  }

  return lines.join("\n");
};

const formatCommandHelp = (name: string, metadata: CmdMetadata): string => {
  const aliases = metadata.aliases
    ? re.gray(` (${metadata.aliases.join(", ")})`)
    : "";
  const description = metadata.description || "No description available";
  return `  ${re.cyan(name)}${aliases}\n      ${re.gray(description)}`;
};

export const generateGlobalHelp = async (
  registry: DiscoveryResult,
): Promise<string> => {
  const lines: string[] = [HELP_TEMPLATES.globalHeader];

  // Load all metadata in parallel with controlled concurrency
  const metadataResults = await pMap(
    Array.from(registry.metadata.entries()),
    async ([name, metadataLoader]) => {
      const metadata = await metadataLoader();
      return [name, metadata] as [string, CmdMetadata];
    },
    { concurrency: 5 }, // Limit concurrency for metadata loading
  );

  // Sort commands alphabetically by name
  metadataResults.sort(([a], [b]) => a.localeCompare(b));

  // Build help text
  for (const [name, metadata] of metadataResults) {
    lines.push(formatCommandHelp(name, metadata));
  }

  lines.push(HELP_TEMPLATES.helpFooter);

  return lines.join("\n");
};
