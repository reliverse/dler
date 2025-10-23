// Convenient wrapper around pkg-types for reading package.json and tsconfig.json files
import {
  defineTSConfig,
  readPackageJSON,
  readTSConfig,
  resolvePackageJSON,
  writePackageJSON,
  writeTSConfig,
} from "pkg-types";

export {
  readPackageJSON,
  writePackageJSON,
  resolvePackageJSON,
  defineTSConfig,
  writeTSConfig,
  readTSConfig,
};

// Additional utility functions for package.json operations
export const readPackageJSONSafe = async (path: string) => {
  try {
    return await readPackageJSON(path);
  } catch (error) {
    return null;
  }
};

export const hasWorkspaces = (packageJson: any): boolean =>
  !!(
    packageJson?.workspaces?.packages &&
    Array.isArray(packageJson.workspaces.packages)
  );

export const getWorkspacePatterns = (packageJson: any): string[] =>
  packageJson?.workspaces?.packages || [];
