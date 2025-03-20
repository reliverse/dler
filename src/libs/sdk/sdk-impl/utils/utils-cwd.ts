import { relinka } from "./utils-logs.js";

/**
 * Runs an async function within a given working directory,
 * ensuring that the original directory is restored afterward.
 */
export async function withWorkingDirectory<T>(
  transpileTargetDir: string,
  fn: () => Promise<T>,
): Promise<T> {
  relinka(
    "commonVerbose",
    `Entering withWorkingDirectory, transpileTargetDir: ${transpileTargetDir}`,
  );
  const originalDir = process.cwd();
  try {
    process.chdir(transpileTargetDir);
    relinka(
      "commonVerbose",
      `Changed working directory to: ${transpileTargetDir}`,
    );
    const result = await fn();
    return result;
  } catch (error) {
    relinka("error", `Error in directory ${transpileTargetDir}:`, error);
    throw error;
  } finally {
    process.chdir(originalDir);
    relinka("commonVerbose", `Restored working directory to: ${originalDir}`);
  }
}
