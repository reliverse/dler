export type CommentStyle = "// " | "# " | "-- " | "/* " | "<!-- ";

export type FileExtension =
  | "js"
  | "jsx"
  | "ts"
  | "tsx"
  | "c"
  | "cpp"
  | "h"
  | "java"
  | "go"
  | "kt"
  | "swift"
  | "rs"
  | "cs"
  | "json"
  | "proto"
  | "dart"
  | "inc"
  | "pwn"
  | "py"
  | "rb"
  | "sh"
  | "pl"
  | "r"
  | "yml"
  | "yaml"
  | "sql"
  | "lua"
  | "css"
  | "scss"
  | "less"
  | "html"
  | "htm"
  | "xml"
  | "md";

export type CommentMapping = Record<FileExtension, CommentStyle>;

export const DEFAULT_COMMENT = "// " as const;

const createCommentMapping = <T extends FileExtension>(
  extensions: T[],
  comment: CommentStyle,
): Record<T, CommentStyle> =>
  Object.fromEntries(extensions.map((ext) => [ext, comment])) as Record<T, CommentStyle>;

export const COMMENT_MAP: CommentMapping = {
  // Single-line comment style //
  ...createCommentMapping(
    [
      "js",
      "jsx",
      "ts",
      "tsx",
      "c",
      "cpp",
      "h",
      "java",
      "go",
      "kt",
      "swift",
      "rs",
      "cs",
      "json",
      "proto",
      "dart",
      "inc",
      "pwn",
    ] as const,
    "// ",
  ),
  // Single-line comment style #
  ...createCommentMapping(["py", "rb", "sh", "pl", "r", "yml", "yaml"] as const, "# "),
  // Single-line comment style --
  ...createCommentMapping(["sql", "lua"] as const, "-- "),
  // Multi-line comment style /* */
  ...createCommentMapping(["css", "scss", "less"] as const, "/* "),
  // Multi-line comment style <!-- -->
  ...createCommentMapping(["html", "htm", "xml", "md"] as const, "<!-- "),
} as const;

export const getCommentPrefix = (
  filePath: string,
  forceComment?: boolean,
  customComment?: string,
): string => {
  if (forceComment && customComment) return customComment;
  const ext = filePath.split(".").pop()?.toLowerCase() as FileExtension;
  return COMMENT_MAP[ext] ?? customComment ?? DEFAULT_COMMENT;
};
