import type { Spell, SpellParams, SpellType } from "./spell-types";

const SPELL_REGEX = /<dler-([a-z-]+)-(?:"([^"]+)")?-?(?:{([^}]+)})?>/;

export const parseParams = (paramsStr: string | undefined): SpellParams => {
  const defaultParams: SpellParams = {
    hooked: false,
  };

  if (!paramsStr) return defaultParams;

  const params = { ...defaultParams };

  for (const param of paramsStr.split(",")) {
    const [key, value] = param.trim().split("=");

    if (key && value !== undefined) {
      // Convert string value to appropriate type
      if (value === "true") params[key] = true;
      else if (value === "false") params[key] = false;
      else if (!Number.isNaN(Number(value))) params[key] = Number(value);
      else params[key] = value;
    }
  }

  return params;
};

export const parseSpellFromComment = (
  line: string,
  lineNumber: number,
  fileName: string,
): Spell | null => {
  const match = line.match(SPELL_REGEX);

  if (!match) return null;

  const [fullMatch, spellType, value, paramsStr] = match;

  if (!spellType || !isValidSpellType(spellType)) {
    console.warn(`Unknown spell type: ${spellType} in file ${fileName}:${lineNumber}`);
    return null;
  }

  return {
    type: spellType as SpellType,
    params: parseParams(paramsStr),
    value,
    lineNumber,
    fullMatch,
    fileName,
  };
};

export const extractSpellsFromFile = async (
  filePath: string,
  content: string,
): Promise<Spell[]> => {
  const lines = content.split("\n");
  const spells: Spell[] = [];

  lines.forEach((line, index) => {
    const spell = parseSpellFromComment(line, index + 1, filePath);
    if (spell) spells.push(spell);
  });

  return spells;
};

const isValidSpellType = (type: string): boolean => {
  const validTypes: SpellType[] = [
    "replace-line",
    "rename-file",
    "remove-comment",
    "remove-line",
    "remove-file",
    "transform-content",
    "copy-file",
    "move-file",
    "insert-at",
  ];

  return validTypes.includes(type as SpellType);
};
