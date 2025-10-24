// packages/launcher/src/impl/launcher/registry.ts

import type { CmdNode, DiscoveryResult } from "./types";

let cachedRegistry: DiscoveryResult | null = null;

export const getRegistry = (): DiscoveryResult | null => cachedRegistry;

export const setRegistry = (registry: DiscoveryResult): void => {
  cachedRegistry = registry;
};

export const clearRegistry = (): void => {
  cachedRegistry = null;
};

export const resolveCommand = (
  registry: DiscoveryResult,
  cmdNameOrAlias: string,
): string => {
  const resolvedName = registry.aliases.get(cmdNameOrAlias) ?? cmdNameOrAlias;
  return resolvedName;
};

export const resolveCommandChain = (
  registry: DiscoveryResult,
  cmdChain: string[],
): { parent?: CmdNode; child?: CmdNode; fullPath: string[] } => {
  if (cmdChain.length === 0) {
    throw new Error("Empty command chain");
  }

  if (cmdChain.length === 1) {
    const cmdName = resolveCommand(registry, cmdChain[0]!);
    const node = registry.hierarchy.get(cmdName);
    if (!node) {
      throw new Error(`Command not found: ${cmdChain[0]}`);
    }
    return { fullPath: [cmdName] };
  }

  // Multi-level command chain
  const parentName = resolveCommand(registry, cmdChain[0]!);
  const childName = resolveCommand(registry, cmdChain[1]!);

  const parentNode = registry.hierarchy.get(parentName);
  const childNode = registry.hierarchy.get(childName);

  if (!parentNode) {
    throw new Error(`Parent command not found: ${cmdChain[0]}`);
  }

  if (!childNode || childNode.parent !== parentName) {
    throw new Error(
      `Sub-command not found: ${cmdChain[1]} under ${cmdChain[0]}`,
    );
  }

  return {
    parent: parentNode,
    child: childNode,
    fullPath: [parentName, childName],
  };
};
