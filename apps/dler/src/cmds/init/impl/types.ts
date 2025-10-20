export type PackageInfo = {
  name: string;
  workspace: string;
  scope: string;
};

export type MonorepoConfig = {
  name: string;
  description: string;
  version: string;
  author: string;
  license: string;
  packages: PackageInfo[];
  rootPath: string;
};

export type CatalogDependency = {
  name: string;
  version: string;
};

export type ValidationResult = {
  valid: boolean;
  error?: string;
};
