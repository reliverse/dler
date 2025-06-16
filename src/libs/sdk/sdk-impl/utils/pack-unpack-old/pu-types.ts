export type FileContent = string | Record<string, unknown>;
export type FileType = "text" | "json" | "binary";

export interface FileMetadata {
  updatedAt: string;
  updatedHash: string;
}

export interface TemplatesFileContent {
  content: FileContent;
  type: FileType;
  hasError?: boolean;
  error?: string;
  jsonComments?: Record<number, string>;
  binaryHash?: string;
  metadata?: FileMetadata;
}

export interface TemplateConfig {
  files: Record<string, TemplatesFileContent>;
}

export interface Template {
  name: string;
  description: string;
  config: TemplateConfig;
  updatedAt: string;
}

export type Templates = Record<string, Template>;
