export type SpellType =
  | "replace-line"
  | "replace-range"
  | "rename-file"
  | "remove-comment"
  | "remove-line"
  | "remove-file"
  | "transform-content"
  | "transform-line"
  | "copy-file"
  | "move-file"
  | "insert-at"
  | "insert-before"
  | "insert-after"
  | "conditional-execute";

export type SpellParams = {
  /** Whether the spell should be executed manually (true) or automatically at postbuild (false) */
  hooked: boolean;
  /** Line number to start the operation (for range operations) */
  startLine?: number;
  /** Line number to end the operation (for range operations) */
  endLine?: number;
  /** Condition to check before executing the spell */
  condition?: string;
  /** Whether to skip the spell if the target file doesn't exist */
  skipIfMissing?: boolean;
  /** Whether to create the target directory if it doesn't exist */
  createDir?: boolean;
  /** Custom parameters for specific spell types */
  [key: string]: any;
};

export type Spell = {
  type: SpellType;
  params: SpellParams;
  value?: string;
  lineNumber?: number;
  fullMatch?: string;
  fileName?: string;
  /** Optional array of spells that must be executed before this one */
  dependsOn?: Spell[];
};

export type SpellExecutionOptions = {
  spells?: (SpellType | "all")[];
  files?: string[];
  dryRun?: boolean;
  /** Whether to show detailed changes in the output */
  showChanges?: boolean;
  /** Whether to validate spell parameters before execution */
  validate?: boolean;
};

export type FileOperation = {
  type: "read" | "write" | "rename" | "remove" | "copy" | "move";
  sourcePath: string;
  targetPath?: string;
  content?: string;
  /** Whether to create parent directories if they don't exist */
  createDir?: boolean;
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
  /** Detailed information about the changes made */
  details?: {
    linesAffected?: number[];
    filesAffected?: string[];
    validationErrors?: string[];
  };
};
