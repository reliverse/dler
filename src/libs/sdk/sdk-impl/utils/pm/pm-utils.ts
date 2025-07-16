import { resolve } from "@reliverse/pathkit";
import { createRequire } from "node:module";

import { x } from "~/libs/sdk/sdk-impl/utils/exec/exec-mod";

import type { OperationOptions, PackageManager } from "./pm-types";

import { detectPackageManager, packageManagers } from "./pm-detect";

function cached<T>(fn: () => Promise<T>): () => T | Promise<T> {
  let v: T | Promise<T> | undefined;
  return () => {
    if (v === undefined) {
      v = fn().then((r) => {
        v = r;
        return v;
      });
    }
    return v;
  };
}

const hasCorepack = cached(async () => {
  if (globalThis.process?.versions?.webcontainer) {
    return false;
  }
  try {
    const { exitCode } = await x("corepack", ["--version"]);
    return exitCode === 0;
  } catch {
    return false;
  }
});

export async function executeCommand(
  command: string,
  args: string[],
  options: Pick<OperationOptions, "cwd" | "silent"> = {},
): Promise<void> {
  const xArgs: [string, string[]] =
    command === "npm" || command === "bun" || command === "deno" || !(await hasCorepack())
      ? [command, args]
      : ["corepack", [command, ...args]];

  const { exitCode, stdout, stderr } = await x(xArgs[0], xArgs[1], {
    nodeOptions: {
      cwd: resolve(options.cwd || process.cwd()),
      stdio: options.silent ? "pipe" : "inherit",
    },
  });

  if (exitCode !== 0) {
    throw new Error(
      `\`${xArgs.flat().join(" ")}\` failed.${options.silent ? ["", stdout, stderr].join("\n") : ""}`,
    );
  }
}

type NonPartial<T> = { [P in keyof T]-?: T[P] };

export const NO_PACKAGE_MANAGER_DETECTED_ERROR_MSG = "No package manager auto-detected.";

export async function resolveOperationOptions(options: OperationOptions = {}): Promise<
  NonPartial<Pick<OperationOptions, "cwd" | "silent" | "dev" | "global">> &
    Pick<OperationOptions, "workspace"> & {
      packageManager: PackageManager;
    }
> {
  const cwd = options.cwd || process.cwd();

  const packageManager =
    (typeof options.packageManager === "string"
      ? packageManagers.find((pm) => pm.name === options.packageManager)
      : options.packageManager) || (await detectPackageManager(options.cwd || process.cwd()));

  if (!packageManager) {
    throw new Error(NO_PACKAGE_MANAGER_DETECTED_ERROR_MSG);
  }

  return {
    cwd,
    silent: options.silent ?? false,
    packageManager,
    dev: options.dev ?? false,
    workspace: options.workspace,
    global: options.global ?? false,
  };
}

export function getWorkspaceArgs(
  options: Awaited<ReturnType<typeof resolveOperationOptions>>,
): string[] {
  if (!options.workspace) {
    return [];
  }

  const workspacePkg =
    typeof options.workspace === "string" && options.workspace !== ""
      ? options.workspace
      : undefined;

  // pnpm
  if (options.packageManager.name === "pnpm") {
    return workspacePkg ? ["--filter", workspacePkg] : ["--workspace-root"];
  }

  // npm
  if (options.packageManager.name === "npm") {
    return workspacePkg ? ["-w", workspacePkg] : ["--workspaces"];
  }

  if (options.packageManager.name === "yarn") {
    if (!options.packageManager.majorVersion || options.packageManager.majorVersion === "1") {
      // Yarn classic
      return workspacePkg ? ["--cwd", workspacePkg] : ["-W"];
    } else {
      // Yarn berry
      return workspacePkg ? ["workspace", workspacePkg] : [];
    }
  }

  return [];
}

export function doesDependencyExist(
  name: string,
  options: Pick<Awaited<ReturnType<typeof resolveOperationOptions>>, "cwd" | "workspace">,
) {
  const require = createRequire(options.cwd.endsWith("/") ? options.cwd : options.cwd + "/");

  try {
    const resolvedPath = require.resolve(name);

    return resolvedPath.startsWith(options.cwd);
  } catch {
    return false;
  }
}
