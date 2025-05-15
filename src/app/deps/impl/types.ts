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
  includeBuiltins: boolean;
};

export type DependencyResult = {
  missingDependencies: string[];
  allDependencies: string[];
  listedDependencies: string[];
  builtinModules: string[];
};
