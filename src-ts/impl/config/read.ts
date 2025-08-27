/* ------------------------------------------------------------------
 * Config Read/Write (TypeBox)
 * ------------------------------------------------------------------
 */

import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { parseJSONC } from "confbox";
import { createJiti } from "jiti";
import { writeReliverseConfig } from "~/impl/config/create";
import { repairAndParseJSON } from "~/impl/config/repair";
import { mergeWithDefaults } from "~/impl/config/update";
import type { ReliverseConfig } from "~/impl/schema/mod";
import { DEFAULT_CONFIG_RELIVERSE } from "~/impl/schema/mod";
import type { IterableError } from "~/impl/types/mod";

// Create jiti instance for TypeScript config loading
const jiti = createJiti(import.meta.url);

/**
 * Parses the config file and validates it against the schema.
 * Returns both the parsed object and any errors (if present).
 */
async function parseReliverseConfig(configPath: string): Promise<{
  parsed: unknown;
  errors: IterableError | null;
} | null> {
  try {
    const content = (await fs.readFile(configPath, "utf-8")).trim();
    if (!content || content === "{}") return null;
    let parsed = parseJSONC(content);
    if (!parsed || typeof parsed !== "object") {
      const repaired = repairAndParseJSON(content);
      if (!repaired) return null;
      parsed = repaired;
      relinka("info", "Config JSON was repaired.");
      relinka("verbose", "Used tool: jsonrepair.");
    }

    // Filter out fields that are not part of the default config shape
    const schemaProperties = Object.keys(
      DEFAULT_CONFIG_RELIVERSE as unknown as Record<string, unknown>,
    );
    const filteredParsed = Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([key]) =>
        schemaProperties.includes(key),
      ),
    );
    return { parsed: filteredParsed, errors: null };
  } catch {
    return null;
  }
}

/**
 * Helper for TS config reading.
 * Uses jiti for TypeScript module loading.
 */
export async function readRseTs(configPath: string): Promise<ReliverseConfig | null> {
  try {
    const config: ReliverseConfig = await jiti.import(configPath, { default: true });
    return config;
  } catch (error) {
    relinka(
      "error",
      "Failed to import TS config:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * Reads and validates the config file.
 * If errors are detected, it attempts to merge missing or invalid fields with defaults.
 */
export async function readReliverseConfig(
  configPath: string,
  isDev: boolean,
): Promise<ReliverseConfig | null> {
  if (configPath.endsWith(".ts")) {
    return await readRseTs(configPath);
  }
  if (!(await fs.pathExists(configPath))) return null;
  const parseResult = await parseReliverseConfig(configPath);
  if (!parseResult) return null;
  if (!parseResult.errors) return parseResult.parsed as ReliverseConfig;

  const errors = [...parseResult.errors].map((err) => `Path "${err.path}": ${err.message}`);
  relinka("verbose", "Detected invalid fields in config:", errors.join("; "));

  const merged = mergeWithDefaults(parseResult.parsed as Partial<ReliverseConfig>);
  await writeReliverseConfig(configPath, merged, isDev);
  relinka("info", "Merged missing or invalid fields into config");
  return merged;
}
