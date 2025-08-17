export type MissingDepsFileType = ".js" | ".jsx" | ".ts" | ".tsx";

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface FinderOptions {
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
}

export interface DependencyResult {
  missingDependencies: string[];
  allDependencies: string[];
  listedDependencies: string[];
  builtinModules: string[];
  devOnlyDependencies: string[];
  duplicateDependencies: string[];
}
