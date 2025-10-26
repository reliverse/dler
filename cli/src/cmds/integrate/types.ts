// apps/dler/src/cmds/integrate/types.ts

export interface IntegrationContext {
  targetPath: string;
  isMonorepo: boolean;
  monorepoRoot?: string;
  packageName?: string;
  verbose: boolean;
  tempDir: TempDirectory;
}

export interface Integration {
  name: string;
  description: string;
  dependencies: string[];
  devDependencies: string[];

  // Lifecycle hooks
  validate(context: IntegrationContext): Promise<boolean>;
  install(context: IntegrationContext): Promise<void>;
  configure(context: IntegrationContext): Promise<void>;
  postInstall(context: IntegrationContext): Promise<void>;
}

export interface ProjectContext {
  type: "monorepo" | "single-repo";
  rootPath: string;
  targetPath: string;
  packages?: PackageInfo[];
  selectedPackage?: PackageInfo;
}

export interface PackageInfo {
  name: string;
  path: string;
  packageJson: any;
}

export interface BiomeConfig {
  path: string;
  exists: boolean;
  content?: any;
}

export interface TempDirectory {
  path: string;
  cleanup: () => Promise<void>;
}
