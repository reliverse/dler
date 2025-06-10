import { re } from "@reliverse/relico";
import { relinka } from "@reliverse/relinka";
import { deleteLastLines } from "@reliverse/rempts";
import { ExecaError } from "execa";

/**
 * Handles errors during the build process.
 * This is the single source of error logging.
 */
export function handleDlerError(error: unknown): never {
  let rootCause = "";

  if (error instanceof ExecaError) {
    rootCause = error.message;
    deleteLastLines(8); // remove execa error stack trace lines
  } else if (error instanceof Error) {
    rootCause = error.message;
  }

  // Log error information in a structured way
  relinka("error", re.bold("Unexpected error happened:"));
  if (rootCause) {
    relinka("error", re.italic(rootCause));
  }

  // Exit with error code
  process.exit(1);
}

/**
 * Runs an async function within a given working directory,
 * ensuring that the original directory is restored afterward.
 */
export async function withWorkingDirectory<T>(
  transpileTargetDir: string,
  fn: () => Promise<T>,
): Promise<T> {
  const originalDir = process.cwd();
  try {
    process.chdir(transpileTargetDir);
    relinka("log", `CWD (current working directory): ${originalDir} -> ${transpileTargetDir}`);
    const result = await fn();
    return result;
  } catch (error) {
    relinka("null", "");
    relinka("error", re.italic(transpileTargetDir), error);
    throw error;
  } finally {
    process.chdir(originalDir);
    relinka("log", `CWD (current working directory): ${transpileTargetDir} -> ${originalDir}`);
  }
}

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
 * Converts unknown errors to readable strings.
 */
export const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
