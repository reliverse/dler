export type FileContent = string | Record<string, unknown>;
export type FileType = "text" | "json" | "binary";

export type TemplatesFileContent = {
  content: FileContent;
  type: FileType;
  hasError?: boolean;
  jsonComments?: Record<number, string>;
  binaryHash?: string;
};

export type TemplateConfig = {
  files: Record<string, TemplatesFileContent>;
};

export type Template = {
  name: string;
  description: string;
  config: TemplateConfig;
};

export type Templates = Record<string, Template>;
