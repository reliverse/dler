import { relinka } from "./utils-logs.js";

/**
 * Validates that the current working directory is appropriate for a development environment.
 * Throws an error if the current directory does not contain any of the required paths.
 */
export async function validateDevCwd(
  isDev: boolean,
  paths: string[],
  cliName: string,
  cliOrg = "",
): Promise<void> {
  if (!isDev) return;
  const projectName = cliOrg ? `@${cliOrg}/${cliName}` : cliName;
  const currentDir = process.cwd();
  if (!paths.some((path) => currentDir.includes(path))) {
    const pathsList = paths.map((p) => `'${p}'`).join(", ");
    throw new Error(
      [
        `│  The '--dev' flag is reserved exclusively for ${projectName} developers`,
        `│  Your current directory must include one of the following paths: ${pathsList}`,
        `│  Also please make sure to use 'bun dev' instead of '${cliName} --dev'`,
        `│  Current working directory: ${currentDir}`,
      ].join("\n"),
    );
  }
}

/**
 * Runs an async function within a given working directory,
 * ensuring that the original directory is restored afterward.
 */
export async function withWorkingDirectory<T>(
  transpileTargetDir: string,
  fn: () => Promise<T>,
): Promise<T> {
  relinka(
    "verbose",
    `Entering withWorkingDirectory, transpileTargetDir: ${transpileTargetDir}`,
  );
  const originalDir = process.cwd();
  try {
    process.chdir(transpileTargetDir);
    relinka("verbose", `Changed working directory to: ${transpileTargetDir}`);
    const result = await fn();
    return result;
  } catch (error) {
    relinka("error", `Error in directory ${transpileTargetDir}:`, error);
    throw error;
  } finally {
    process.chdir(originalDir);
    relinka("verbose", `Restored working directory to: ${originalDir}`);
  }
}
