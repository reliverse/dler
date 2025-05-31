export type FileType = ".js" | ".jsx" | ".ts" | ".tsx";

export type PackageJson = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

export type FinderOptions = {
  directory: string;
  showAll: boolean;
  ignorePatterns: string[];
  json: boolean;
  builtins: boolean;
  dev: boolean;
  peer: boolean;
  optional: boolean;
  fix: boolean;
  depth: number;
};

export type DependencyResult = {
  missingDependencies: string[];
  allDependencies: string[];
  listedDependencies: string[];
  builtinModules: string[];
  devOnlyDependencies: string[];
  duplicateDependencies: string[];
};
