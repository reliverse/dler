/* ------------------------------------------------------------------
 * Config Fixing Utilities
 * ------------------------------------------------------------------
 */

import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { parseJSONC } from "confbox";
import { jsonrepair } from "jsonrepair";
import { writeReliverseConfig } from "~/impl/config/create";
import { cleanGitHubUrl } from "~/impl/config/utils";
import type { ReliverseConfig } from "~/impl/schema/mod";
import { DEFAULT_CONFIG_RELIVERSE } from "~/impl/schema/mod";

// Uses jsonrepair to fix broken JSON then parses it.
export function repairAndParseJSON(raw: string): any {
  try {
    const repaired = jsonrepair(raw);
    return JSON.parse(repaired);
  } catch (_error) {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively fixes each property in the object. Returns the fixed config and
 * an array of property paths that were changed.
 */
export function fixLineByLine(
  userConfig: unknown,
  defaultConfig: unknown,
): { fixedConfig: unknown; changedKeys: string[] } {
  if (!isPlainObject(defaultConfig)) {
    return {
      fixedConfig: userConfig === undefined ? defaultConfig : userConfig,
      changedKeys: userConfig === undefined ? ["<entire_object>"] : [],
    };
  }

  const result: Record<string, unknown> = {
    ...(defaultConfig as Record<string, unknown>),
  };
  const changedKeys: string[] = [];
  const missingKeys: string[] = [];

  const userObj = isPlainObject(userConfig) ? (userConfig as Record<string, unknown>) : {};

  for (const propName of Object.keys(defaultConfig as Record<string, unknown>)) {
    const userValue = userObj[propName];
    const defaultValue = (defaultConfig as Record<string, unknown>)[propName];

    if (!(propName in userObj)) {
      missingKeys.push(propName);
      result[propName] = defaultValue;
      continue;
    }

    if (propName === "customUserFocusedRepos" || propName === "customDevsFocusedRepos") {
      if (Array.isArray(userValue)) {
        result[propName] = userValue.map((url) => cleanGitHubUrl(String(url)));
        continue;
      }
    }

    if (isPlainObject(defaultValue)) {
      const { fixedConfig, changedKeys: nested } = fixLineByLine(userValue, defaultValue);
      result[propName] = fixedConfig;
      if (nested.length > 0) changedKeys.push(...nested.map((n) => `${propName}.${n}`));
    } else if (userValue === undefined) {
      result[propName] = defaultValue;
      changedKeys.push(propName);
    } else {
      result[propName] = userValue;
    }
  }

  if (missingKeys.length > 0) {
    relinka("verbose", "Missing fields injected from default config:", missingKeys.join(", "));
  }

  return { fixedConfig: result, changedKeys };
}

/**
 * Reads the config file, fixes invalid lines based on the schema,
 * writes back the fixed config, and returns the fixed config.
 */
export async function parseAndFixReliverseConfig(
  configPath: string,
  isDev: boolean,
): Promise<ReliverseConfig | null> {
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    let parsed = parseJSONC(raw);
    if (!parsed || typeof parsed !== "object") {
      const repaired = repairAndParseJSON(raw);
      if (repaired) {
        relinka("info", "Config JSON was repaired.");
        relinka("verbose", "Used tool: jsonrepair.");
      }
      parsed = repaired;
    }
    if (parsed && typeof parsed === "object") {
      const originalErrors: any[] = [];
      if (originalErrors.length === 0) return parsed as ReliverseConfig;

      const { fixedConfig, changedKeys } = fixLineByLine(parsed, DEFAULT_CONFIG_RELIVERSE);
      if (fixedConfig && typeof fixedConfig === "object") {
        await writeReliverseConfig(configPath, fixedConfig as ReliverseConfig, isDev);
        const originalInvalidPaths = originalErrors.map((err) => err.path);
        relinka(
          "info",
          "Your config has been fixed. Please ensure it aligns with your project.",
          `Changed keys: ${changedKeys.join(", ") || "(none)"}`,
        );
        relinka(
          "verbose",
          `Originally invalid paths were: ${originalInvalidPaths.join(", ") || "(none)"}`,
        );
        return fixedConfig as ReliverseConfig;
      }
      relinka("warn", "Could not validate all config lines. Applied best-effort fixes.");
      return null;
    }
  } catch (error) {
    relinka(
      "warn",
      "Failed to parse/fix config line-by-line:",
      error instanceof Error ? error.message : String(error),
    );
  }
  return null;
}
