import { relinka } from "@reliverse/relinka";

import type { Spell, SpellExecutionOptions, SpellResult, SpellType } from "./spell-types";

import * as executors from "./spell-executors";
import * as fs from "./spell-filesystem";
import { extractSpellsFromFile } from "./spell-parser";

export const executeSpell = async (
  spell: Spell,
  filePath: string,
  content: string,
): Promise<SpellResult> => {
  // Skip hooked spells when executing directly
  if (spell.params.hooked) {
    relinka("verbose", "Skipping hooked spell in " + filePath);
    return {
      spell,
      file: filePath,
      success: true,
      message: "Skipped (hooked=true)",
    };
  }

  // Log spell execution details
  relinka("verbose", "Processing spell in file: " + filePath);
  relinka("verbose", "Spell type: " + spell.type);
  relinka("verbose", "Spell params:", spell.params);

  // Validate target file requirement
  if (!spell.params.targetFile && spell.type !== "remove-file") {
    relinka("error", "Spell in " + filePath + " requires target file but none specified");
    return {
      spell,
      file: filePath,
      success: false,
      message: "Target file not specified",
    };
  }

  try {
    switch (spell.type) {
      case "replace-line":
        return await executors.replaceLineExecutor(spell, filePath, content);
      case "rename-file":
        return await executors.renameFileExecutor(spell, filePath);
      case "remove-comment":
        return await executors.removeCommentExecutor(spell, filePath, content);
      case "remove-line":
        return await executors.removeLineExecutor(spell, filePath, content);
      case "remove-file":
        return await executors.removeFileExecutor(spell, filePath);
      case "transform-content":
        return await executors.transformContentExecutor(spell, filePath, content);
      case "copy-file":
        return await executors.copyFileExecutor(spell, filePath);
      case "move-file":
        return await executors.moveFileExecutor(spell, filePath);
      case "insert-at":
        return await executors.insertAtExecutor(spell, filePath, content);
      default:
        relinka("error", "Unknown spell type: " + spell.type + " in " + filePath);
        return {
          spell,
          file: filePath,
          success: false,
          message: "Unknown spell type: " + spell.type,
        };
    }
  } catch (error) {
    relinka("error", "Error executing spell in " + filePath + ":", error);
    return {
      spell,
      file: filePath,
      success: false,
      message: "Spell execution failed: " + error,
    };
  }
};

export const processFile = async (
  filePath: string,
  options: SpellExecutionOptions = {},
): Promise<SpellResult[]> => {
  const results: SpellResult[] = [];

  try {
    relinka("verbose", "Processing file for spells: " + filePath);
    const content = await fs.readFile(filePath);
    const spells = await extractSpellsFromFile(filePath, content);
    relinka("verbose", "Found " + spells.length + " spells in " + filePath);

    if (spells.length > 0) {
      relinka("verbose", "Spells found in " + filePath + ":", spells);
    }

    for (const spell of spells) {
      // Skip spells that don't match the requested types
      if (
        options.spells &&
        options.spells.length > 0 &&
        !options.spells.includes("all") &&
        !options.spells.includes(spell.type)
      ) {
        relinka(
          "verbose",
          "Skipping spell type " + spell.type + " in " + filePath + " (not in requested types)",
        );
        continue;
      }

      const result = await executeSpell(spell, filePath, content);
      results.push(result);

      // Stop processing this file if it's been removed or renamed
      if (result.success && (spell.type === "remove-file" || spell.type === "rename-file")) {
        relinka(
          "verbose",
          "Stopping processing of " + filePath + " due to " + spell.type + " spell",
        );
        break;
      }
    }

    return results;
  } catch (error) {
    relinka("error", "Error processing file " + filePath + ":", error);
    return [
      {
        spell: { type: "unknown" as SpellType, params: { hooked: false } },
        file: filePath,
        success: false,
        message: "Failed to process file: " + error,
      },
    ];
  }
};

export const spells = async (options: SpellExecutionOptions = {}): Promise<SpellResult[]> => {
  const results: SpellResult[] = [];

  try {
    // Find files to process
    const filesToProcess = options.files?.length
      ? options.files
      : await fs.findFiles(["*"], process.cwd());

    relinka("verbose", "Files to process for spells:", filesToProcess);

    // Process each file
    for (const filePath of filesToProcess) {
      const fileResults = await processFile(filePath, options);
      results.push(...fileResults);
    }

    // Log summary
    const failedSpells = results.filter((r) => !r.success);
    if (failedSpells.length > 0) {
      relinka("error", "Failed spells:", failedSpells);
    }

    return results;
  } catch (error) {
    relinka("error", "Error in spell execution:", error);
    return [
      {
        spell: { type: "unknown" as SpellType, params: { hooked: false } },
        file: "unknown",
        success: false,
        message: "Failed to trigger spells: " + error,
      },
    ];
  }
};
