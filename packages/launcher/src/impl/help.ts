// packages/launcher/src/impl/launcher/help.ts

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
    `\n${name} - ${description}`,
  version: (version: string) => `Version: ${version}`,
  usage: (name: string) => `\nUsage:\n  ${name} [options]`,
  usageWithSubCommands: (name: string) =>
    `\nUsage:\n  ${name} [subcommand] [options]`,
  optionsHeader: `\nOptions:`,
  requiredNote: `\n* = required`,
  examplesHeader: `\nExamples:`,
  globalHeader: `\nAvailable commands:\n`,
  helpFooter: `\nUse "command --help" for command-specific help\n`,
} as const;

const formatArgName = (name: string, def: CmdArgsSchema[string]): string => {
  const aliases = def.aliases ? ` (-${def.aliases.join(", -")})` : "";
  const required = def.required ? "*" : "";
  return `--${name}${aliases}${required}`;
};

const formatArgType = (def: CmdArgsSchema[string]): string => {
  if (def.type === "boolean") return "";
  return `<${def.type}>`;
};

// Cache for formatted argument help to avoid recomputation
const argHelpCache = new Map<string, string>();

// Cache for generated help text with file hash validation
interface HelpCacheEntry {
  commandHelp: string;
  globalHelp: string;
  fileHash: string;
  lastModified: number;
}

const helpCache = new Map<string, HelpCacheEntry>();

const getArgHelp = (name: string, def: CmdArgsSchema[string]): string => {
  const cacheKey = `${name}:${JSON.stringify(def)}`;
  let cached = argHelpCache.get(cacheKey);

  if (!cached) {
    const argName = formatArgName(name, def);
    const argType = formatArgType(def);
    const desc = def.description ?? "";
    const defaultVal =
      "default" in def && def.default !== undefined
        ? ` (default: ${def.default})`
        : "";

    cached = `  ${argName} ${argType}\n      ${desc}${defaultVal}`;
    argHelpCache.set(cacheKey, cached);
  }

  return cached;
};

export const generateCommandHelp = async (
  definition: CmdDefinition,
): Promise<string> => {
  const { cfg, args } = definition;

  // Create cache key based on command configuration
  const cacheKey = `${cfg.name}:${JSON.stringify(cfg)}:${JSON.stringify(args)}`;
  const cached = helpCache.get(cacheKey);

  if (cached) {
    return cached.commandHelp;
  }

  const lines: string[] = [
    HELP_TEMPLATES.commandHeader(
      cfg.name,
      cfg.description || "No description available",
    ),
  ];

  if (cfg.version) {
    lines.push(HELP_TEMPLATES.version(cfg.version));
  }

  lines.push(HELP_TEMPLATES.usage(cfg.name));

  if (Object.keys(args).length > 0) {
    lines.push(HELP_TEMPLATES.optionsHeader);

    // Use cached argument help
    for (const [name, def] of Object.entries(args)) {
      lines.push(getArgHelp(name, def));
    }

    lines.push(HELP_TEMPLATES.requiredNote);
  }

  if (cfg.examples && cfg.examples.length > 0) {
    lines.push(HELP_TEMPLATES.examplesHeader);
    for (const example of cfg.examples) {
      lines.push(`  ${example}`);
    }
  }

  const helpText = lines.join("\n");

  // Cache the generated help
  helpCache.set(cacheKey, {
    commandHelp: helpText,
    globalHelp: "",
    fileHash: "",
    lastModified: Date.now(),
  });

  return helpText;
};

// Cache for command help formatting
const commandHelpCache = new Map<string, string>();

const formatCommandHelp = (name: string, metadata: CmdMetadata): string => {
  const cacheKey = `${name}:${JSON.stringify(metadata)}`;
  let cached = commandHelpCache.get(cacheKey);

  if (!cached) {
    const aliases = metadata.aliases ? ` (${metadata.aliases.join(", ")})` : "";
    const description = metadata.description || "No description available";
    cached = `  ${name}${aliases}\n      ${description}`;
    commandHelpCache.set(cacheKey, cached);
  }

  return cached;
};

export const generateGlobalHelp = async (
  registry: DiscoveryResult,
): Promise<string> => {
  // Create cache key for global help
  const cacheKey = `global:${Array.from(registry.metadata.keys()).sort().join(",")}`;
  const cached = helpCache.get(cacheKey);

  if (cached && cached.globalHelp) {
    return cached.globalHelp;
  }

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

  // Build help text using cached formatting
  for (const [name, metadata] of metadataResults) {
    lines.push(formatCommandHelp(name, metadata));
  }

  lines.push(HELP_TEMPLATES.helpFooter);

  const helpText = lines.join("\n");

  // Cache the global help
  helpCache.set(cacheKey, {
    commandHelp: "",
    globalHelp: helpText,
    fileHash: "",
    lastModified: Date.now(),
  });

  return helpText;
};
