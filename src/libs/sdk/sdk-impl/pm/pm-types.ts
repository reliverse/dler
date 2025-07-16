export type PackageManagerName = "npm" | "yarn" | "pnpm" | "bun" | "deno";

export interface PackageManager {
  name: PackageManagerName;
  command: string;
  version?: string;
  buildMeta?: string;
  majorVersion?: string;
  lockFile?: string | string[];
  files?: string[];
}

export interface OperationOptions {
  cwd?: string;
  silent?: boolean;
  packageManager?: PackageManager | PackageManagerName;
  installPeerDependencies?: boolean;
  dev?: boolean;
  workspace?: boolean | string;
  global?: boolean;
}

export interface DetectPackageManagerOptions {
  /**
   * Whether to ignore the lock file
   *
   * @default false
   */
  ignoreLockFile?: boolean;

  /**
   * Whether to ignore the package.json file
   *
   * @default false
   */
  ignorePackageJSON?: boolean;

  /**
   * Whether to include parent directories
   *
   * @default false
   */
  includeParentDirs?: boolean;

  /**
   * Weather to ignore argv[1] to detect script
   */
  ignoreArgv?: boolean;
}
