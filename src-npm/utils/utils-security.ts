import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";

// Constants
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_MERGE_SIZE = DEFAULT_MAX_FILE_SIZE * 10; // 100MB

let MAX_FILE_SIZE = DEFAULT_MAX_FILE_SIZE;
let MAX_MERGE_SIZE = DEFAULT_MAX_MERGE_SIZE;

export const setFileSizeLimits = (maxFileSize?: number, maxMergeSize?: number): void => {
  if (maxFileSize !== undefined) {
    MAX_FILE_SIZE = maxFileSize;
  }
  if (maxMergeSize !== undefined) {
    MAX_MERGE_SIZE = maxMergeSize;
  }
};

export const ALLOWED_FILE_TYPES = new Set(["text", "json", "binary"]);

// Path validation
export const validatePath = (filePath: string, baseDir: string): string => {
  // Normalize the input path and base directory
  const normalizedPath = path.normalize(filePath);
  const normalizedBaseDir = path.normalize(baseDir);

  // Resolve the path relative to the base directory
  const resolvedPath = path.resolve(normalizedBaseDir, normalizedPath);

  // Check if the resolved path is within the base directory
  // We use path.relative to check if the path is within the base directory
  const relativePath = path.relative(normalizedBaseDir, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Path traversal attempt detected: ${filePath}`);
  }

  return resolvedPath;
};

// File type validation
export const validateFileType = (type: string): void => {
  if (!ALLOWED_FILE_TYPES.has(type)) {
    throw new Error(`Invalid file type: ${type}`);
  }
};

// Content validation
export const validateContent = (content: unknown, type: string): void => {
  if (type === "json" && typeof content !== "object") {
    throw new Error("Invalid JSON content");
  }
  if (type === "text" && typeof content !== "string") {
    throw new Error("Invalid text content");
  }
};

// Input sanitization
export const sanitizeInput = (input: string): string => {
  // Don't sanitize Windows drive letters and colons
  return input.replace(/[<>"|?*]/g, "_");
};

// Permission checks
export const checkPermissions = async (
  filePath: string,
  operation: "read" | "write",
): Promise<void> => {
  try {
    const dir = path.dirname(filePath);

    // For write operations, check directory permissions if file doesn't exist
    if (operation === "write") {
      // Ensure directory exists
      await fs.ensureDir(dir);
      // Check directory permissions
      await fs.access(dir, fs.constants.W_OK);
      return;
    }

    // For read operations, check file permissions
    if (operation === "read") {
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      await fs.access(filePath, fs.constants.R_OK);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not exist")) {
      throw error;
    }
    throw new Error(`Permission denied: ${operation} access to ${filePath}`);
  }
};

// File size checks
export const checkFileSize = async (filePath: string): Promise<void> => {
  const stats = await fs.stat(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${filePath}`);
  }
};

// Error handling
export const handleError = (error: unknown, context: string): never => {
  const message = error instanceof Error ? error.message : String(error);
  relinka("error", `Error in ${context}: ${message}`);
  process.exit(1);
};

// Template validation
export const validateTemplate = (template: any): void => {
  if (!template.name || typeof template.name !== "string") {
    throw new Error("Invalid template name");
  }
  if (!template.config?.files || typeof template.config.files !== "object") {
    throw new Error("Invalid template files configuration");
  }
};

// Merge operation safety
export const validateMergeOperation = async (files: string[]): Promise<void> => {
  const totalSize = await Promise.all(files.map(async (f) => (await fs.stat(f)).size)).then(
    (sizes) => sizes.reduce((a, b) => a + b, 0),
  );

  if (totalSize > MAX_MERGE_SIZE) {
    throw new Error("Total size of files to merge exceeds limit");
  }
};

// File existence check with validation
export const validateFileExists = async (filePath: string, operation: string): Promise<void> => {
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`File does not exist for ${operation}: ${filePath}`);
  }
};
