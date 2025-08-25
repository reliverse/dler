import { createRequire } from "node:module";
import { resolve } from "@reliverse/pathkit";

import { x } from "~/app/utils/exec/exec-mod";
import { detectPackageManager, packageManagers } from "./pm-detect";
import type { OperationOptions, PackageManager } from "./pm-types";

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
  // Debug logging
  console.log("DEBUG: executeCommand called with:", {
    command,
    args,
    options,
    commandType: typeof command,
    argsType: typeof args,
    isArgsArray: Array.isArray(args),
  });

  // Add validation to ensure args is an array
  if (!Array.isArray(args)) {
    throw new Error(`executeCommand: args must be an array, got ${typeof args}: ${args}`);
  }

  const xArgs: [string, string[]] =
    command === "npm" || command === "bun" || command === "deno" || !(await hasCorepack())
      ? [command, args]
      : ["corepack", [command, ...args]];

  console.log("DEBUG: executeCommand xArgs:", {
    xArgs,
    command: xArgs[0],
    args: xArgs[1],
    commandType: typeof xArgs[0],
    argsType: typeof xArgs[1],
    isArgsArray: Array.isArray(xArgs[1]),
  });

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
    Pick<OperationOptions, "workspace" | "filter" | "asCatalog" | "catalogName"> & {
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
    filter: options.filter,
    asCatalog: options.asCatalog,
    catalogName: options.catalogName,
    global: options.global ?? false,
  };
}

export function getWorkspaceArgs(
  options: Awaited<ReturnType<typeof resolveOperationOptions>>,
): string[] {
  const args: string[] = [];

  // Handle filter option (monorepo workspace filtering)
  if (options.filter && options.filter.length > 0) {
    for (const filter of options.filter) {
      args.push("--filter", filter);
    }
    return args;
  }

  // Handle legacy workspace option
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
