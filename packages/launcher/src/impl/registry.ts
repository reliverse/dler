// packages/launcher/src/impl/launcher/registry.ts

import type { DiscoveryResult } from "./types";

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
