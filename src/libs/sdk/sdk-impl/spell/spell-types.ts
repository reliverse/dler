export type SpellType =
  | "replace-line"
  | "rename-file"
  | "remove-comment"
  | "remove-line"
  | "remove-file"
  | "transform-content"
  | "copy-file"
  | "move-file"
  | "insert-at";

export type SpellParams = {
  hooked: boolean;
  [key: string]: any;
};

export type Spell = {
  type: SpellType;
  params: SpellParams;
  value?: string;
  lineNumber?: number;
  fullMatch?: string;
  fileName?: string;
};

export type SpellExecutionOptions = {
  spells?: (SpellType | "all")[];
  files?: string[];
  dryRun?: boolean;
};

export type FileOperation = {
  type: "read" | "write" | "rename" | "remove" | "copy" | "move";
  sourcePath: string;
  targetPath?: string;
  content?: string;
};

export type SpellResult = {
  spell: Spell;
  file: string;
  success: boolean;
  message?: string;
  changes?: {
    before: string;
    after: string;
  };
};
