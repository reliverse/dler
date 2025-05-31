import path from "@reliverse/pathkit";

import type { Spell, SpellResult } from "./spell-types";

import * as fs from "./spell-filesystem";

export const replaceLineExecutor = async (
  spell: Spell,
  filePath: string,
  content: string,
): Promise<SpellResult> => {
  if (!spell.lineNumber) {
    return {
      spell,
      file: filePath,
      success: false,
      message: "Line number not provided",
    };
  }

  // the value is a relative path to a file to include
  if (!spell.value) {
    return {
      spell,
      file: filePath,
      success: false,
      message: "Target file not specified",
    };
  }

  const includeFilePath = path.resolve(path.dirname(filePath), spell.value);

  try {
    const includeContent = await fs.readFile(includeFilePath);
    const lines = content.split("\n");
    const originalLine = lines[spell.lineNumber - 1];

    lines[spell.lineNumber - 1] = includeContent.trim();

    const newContent = lines.join("\n");

    await fs.writeFile(filePath, newContent);

    return {
      spell,
      file: filePath,
      success: true,
      message: `Line replaced with content from ${includeFilePath}`,
      changes: {
        before: originalLine ?? "",
        after: includeContent.trim(),
      },
    };
  } catch (error) {
    return {
      spell,
      file: filePath,
      success: false,
      message: `Failed to replace line: ${error}`,
    };
  }
};

export const renameFileExecutor = async (
  spell: Spell,
  filePath: string,
): Promise<SpellResult> => {
  if (!spell.value) {
    return {
      spell,
      file: filePath,
      success: false,
      message: "New filename not provided",
    };
  }

  const newPath = path.resolve(path.dirname(filePath), spell.value);

  try {
    await fs.renameFile(filePath, newPath);

    return {
      spell,
      file: filePath,
      success: true,
      message: `File renamed to ${newPath}`,
    };
  } catch (error) {
    return {
      spell,
      file: filePath,
      success: false,
      message: `Failed to rename file: ${error}`,
    };
  }
};

export const removeCommentExecutor = async (
  spell: Spell,
  filePath: string,
  content: string,
): Promise<SpellResult> => {
  if (!spell.lineNumber || !spell.fullMatch) {
    return {
      spell,
      file: filePath,
      success: false,
      message: "Line number or full match not provided",
    };
  }

  try {
    const lines = content.split("\n");
    const originalLine = lines[spell.lineNumber - 1];
    // Remove the comment but keep the rest of the line
    lines[spell.lineNumber - 1] = (originalLine ?? "")
      .replace(spell.fullMatch, "")
      .trim();

    const newContent = lines.join("\n");

    await fs.writeFile(filePath, newContent);

    return {
      spell,
      file: filePath,
      success: true,
      message: "Comment removed",
      changes: {
        before: originalLine ?? "",
        after: lines[spell.lineNumber - 1] ?? "",
      },
    };
  } catch (error) {
    return {
      spell,
      file: filePath,
      success: false,
      message: `Failed to remove comment: ${error}`,
    };
  }
};

export const removeLineExecutor = async (
  spell: Spell,
  filePath: string,
  content: string,
): Promise<SpellResult> => {
  if (!spell.lineNumber) {
    return {
      spell,
      file: filePath,
      success: false,
      message: "Line number not provided",
    };
  }

  try {
    const lines = content.split("\n");
    const originalLine = lines[spell.lineNumber - 1];

    // Remove the entire line
    lines.splice(spell.lineNumber - 1, 1);

    const newContent = lines.join("\n");

    await fs.writeFile(filePath, newContent);

    return {
      spell,
      file: filePath,
      success: true,
      message: "Line removed",
      changes: {
        before: originalLine ?? "",
        after: "",
      },
    };
  } catch (error) {
    return {
      spell,
      file: filePath,
      success: false,
      message: `Failed to remove line: ${error}`,
    };
  }
};

export const removeFileExecutor = async (
  spell: Spell,
  filePath: string,
): Promise<SpellResult> => {
  try {
    await fs.removeFile(filePath);

    return {
      spell,
      file: filePath,
      success: true,
      message: "File removed",
    };
  } catch (error) {
    return {
      spell,
      file: filePath,
      success: false,
      message: `Failed to remove file: ${error}`,
    };
  }
};

export const copyFileExecutor = async (
  spell: Spell,
  filePath: string,
): Promise<SpellResult> => {
  if (!spell.value) {
    return {
      spell,
      file: filePath,
      success: false,
      message: "Target path not provided",
    };
  }

  const targetPath = path.resolve(path.dirname(filePath), spell.value);

  try {
    await fs.copyFile(filePath, targetPath, true);

    return {
      spell,
      file: filePath,
      success: true,
      message: `File copied to ${targetPath}`,
    };
  } catch (error) {
    return {
      spell,
      file: filePath,
      success: false,
      message: `Failed to copy file: ${error}`,
    };
  }
};

export const moveFileExecutor = async (
  spell: Spell,
  filePath: string,
): Promise<SpellResult> => {
  if (!spell.value) {
    return {
      spell,
      file: filePath,
      success: false,
      message: "Target path not provided",
    };
  }

  const targetPath = path.resolve(path.dirname(filePath), spell.value);

  try {
    await fs.renameFile(filePath, targetPath);

    return {
      spell,
      file: filePath,
      success: true,
      message: `File moved to ${targetPath}`,
    };
  } catch (error) {
    return {
      spell,
      file: filePath,
      success: false,
      message: `Failed to move file: ${error}`,
    };
  }
};

export const transformContentExecutor = async (
  spell: Spell,
  filePath: string,
  content: string,
): Promise<SpellResult> => {
  if (!spell.value) {
    return {
      spell,
      file: filePath,
      success: false,
      message: "Transform function not provided",
    };
  }

  try {
    let newContent = content;

    switch (spell.value) {
      case "trim-empty-lines":
        newContent = content
          .split("\n")
          .filter((line) => line.trim() !== "")
          .join("\n");
        break;
      case "normalize-imports":
        newContent = content.replace(
          /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
          (_, imports, source) => {
            const normalizedImports = imports
              .split(",")
              .map((i: string) => i.trim())
              .sort()
              .join(", ");
            return `import { ${normalizedImports} } from "${source}"`;
          },
        );
        break;
      default:
        return {
          spell,
          file: filePath,
          success: false,
          message: `Unknown transformation: ${spell.value}`,
        };
    }

    await fs.writeFile(filePath, newContent);

    return {
      spell,
      file: filePath,
      success: true,
      message: `Content transformed with ${spell.value}`,
      changes: {
        before: content,
        after: newContent,
      },
    };
  } catch (error) {
    return {
      spell,
      file: filePath,
      success: false,
      message: `Failed to transform content: ${error}`,
    };
  }
};

export const insertAtExecutor = async (
  spell: Spell,
  filePath: string,
  content: string,
): Promise<SpellResult> => {
  if (!spell.value || !spell.params.content) {
    return {
      spell,
      file: filePath,
      success: false,
      message: "Position or content not provided",
    };
  }

  try {
    const lines = content.split("\n");
    const position = Number(spell.value);

    if (Number.isNaN(position) || position < 0 || position > lines.length) {
      return {
        spell,
        file: filePath,
        success: false,
        message: `Invalid position: ${spell.value}`,
      };
    }

    lines.splice(position, 0, spell.params.content);

    const newContent = lines.join("\n");

    await fs.writeFile(filePath, newContent);

    return {
      spell,
      file: filePath,
      success: true,
      message: `Content inserted at position ${position}`,
      changes: {
        before: content,
        after: newContent,
      },
    };
  } catch (error) {
    return {
      spell,
      file: filePath,
      success: false,
      message: `Failed to insert content: ${error}`,
    };
  }
};
