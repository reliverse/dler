// don't edit this file manually
// re-generate via `dler rempts`

import type { Command } from "@reliverse/rempts";

import { loadCommand, callCmdImpl, getTypedCmdImpl } from "@reliverse/rempts";

// ========== TYPED COMMAND SYSTEM ==========

// Argument types for each command based on their defineArgs
interface CommandArgsMap {
  agg: {
    imports?: boolean;
    input?: string;
    named?: boolean;
    out?: string;
    recursive?: boolean;
    strip?: string;
    sort?: boolean;
    header?: string;
    verbose?: boolean;
    includeInternal?: boolean;
    internalMarker?: string;
    override?: boolean;
    extensions?: string;
    separateTypesFile?: boolean;
    typesOut?: string;
    nonInteractive?: boolean;
  };
  build: {
    dev?: boolean;
    debugOnlyCopyNonBuildFiles?: boolean;
    debugDontCopyNonBuildFiles?: boolean;
  };
  build_binary: {
    input?: string;
    targets?: string;
    outdir?: string;
    minify?: boolean;
    sourcemap?: boolean;
    bytecode?: boolean;
    clean?: boolean;
    parallel?: boolean;
    external?: string[];
  };
  check: {
    dev?: boolean;
    directory?: string;
    checks?: string;
    strict?: boolean;
    json?: boolean;
    deps?: boolean;
    all?: boolean;
    ignore?: string;
    builtins?: boolean;
    peer?: boolean;
    optional?: boolean;
    fix?: boolean;
    depth?: number;
  };
  conv: {
    // No arguments defined
  };
  create: {
    template?: string;
    mode?: "template" | "files";
    fileType?: string;
    destDir?: string;
    multiple?: boolean;
    parallel?: boolean;
    concurrency?: string;
    cwd?: string;
  };
  fs: {
    mode: "copy" | "rm" | "rename";
    target: string;
    nonInteractive?: boolean;
    source?: string;
    destination?: string;
    recursive?: boolean;
    preserveStructure?: boolean;
    increment?: boolean;
    concurrency?: number;
    gitignore?: boolean;
    prepareMyCLI?: boolean;
    revert?: boolean;
    useDtsTxtForPrepareMyCLI?: boolean;
  };
  get: {
    // No arguments defined
  };
  init: {
    // No arguments defined
  };
  inject: {
    // No arguments defined
  };
  install: {
    action?: string;
    name?: string;
    global?: boolean;
    cwd?: string;
    workspace?: boolean;
    silent?: boolean;
    recreateLockFile?: boolean;
    linter?: boolean;
  };
  libs: {
    init: string;
    overwrite?: boolean;
  };
  magic: {
    targets: string[];
    lib?: string;
    concurrency?: number;
    batchSize?: number;
    stopOnError?: boolean;
    about?: boolean;
  };
  merge: {
    s?: string[];
    d?: string;
    ignore?: string[];
    format?: string;
    stdout?: boolean;
    noPath?: boolean;
    pathAbove?: boolean;
  };
  migrate: {
    interactive?: boolean;
    codemod?: string;
    project?: string;
    mrTarget?: string;
    dryRun?: boolean;
    noBackup?: boolean;
    consoleRelinkaInput?: string;
    consoleRelinkaFrom?: string;
    consoleRelinkaTo?: string;
  };
  mkdist: {
    mkdistOnly?: boolean;
    dev?: boolean;
    dir?: string;
    cwd?: string;
    src?: string;
    dist?: string;
    clean?: boolean;
    pattern?: string;
    format?: string;
    declaration?: boolean;
    ext?: string;
    jsx?: string;
    jsxFactory?: string;
    jsxFragment?: string;
    loaders?: string;
    minify?: boolean;
    target?: string;
  };
  pack: {
    input: string;
    output?: string;
    whitelabel?: string;
    cdn?: string;
    force?: boolean;
    update?: boolean;
    files?: string;
    lastUpdate?: string;
    unpack?: boolean;
  };
  pub: {
    dev?: boolean;
  };
  remdn: {
    mode?: "dirs-scan-only" | "dirs-scan-compare";
    configPath?: string;
    outputFilePath?: string;
    initConfig?: string;
  };
  remove: {
    action?: string;
    name: string;
    global?: boolean;
    cwd?: string;
    workspace?: boolean;
    silent?: boolean;
    linter?: boolean;
    standalone?: boolean;
  };
  rempts: {
    init?: string;
    overwrite?: boolean;
    customCmdsRoot?: string;
    outFile?: string;
    cmdDirs?: string[];
  };
  split: {
    directory: string;
    fileLineThreshold: number;
    funcLineThreshold: number;
  };
  transform: {
    // No arguments defined
  };
  update: {
    name?: string[];
    ignore?: string[];
    concurrency?: number;
    linker?: "isolated" | "hoisted";
    global?: boolean;
    interactive?: boolean;
  };
  upgrade: {
    interactive?: boolean;
  };
  x: {
    action: string;
    name?: string;
    cwd?: string;
    silent?: boolean;
    target?: string;
    timeout?: number;
    throwOnError?: boolean;
    args?: string;
    global?: boolean;
    yes?: boolean;
    bun?: boolean;
    npm?: boolean;
    pnpm?: boolean;
    yarn?: boolean;
  };
}

// Typed loadCommand wrapper with intellisense
export async function loadTypedCommand<T extends keyof CommandArgsMap>(
  cmdName: T,
): Promise<Command> {
  return await loadCommand(cmdName as string);
}

// ========== TRADITIONAL COMMAND EXPORTS (with typed intellisense) ==========

export const getAggCmd = async (): Promise<Command> => loadTypedCommand("agg");
export const getBuildCmd = async (): Promise<Command> => loadTypedCommand("build");
export const getBuildBinaryCmd = async (): Promise<Command> => loadTypedCommand("build_binary");
export const getCheckCmd = async (): Promise<Command> => loadTypedCommand("check");
export const getConvCmd = async (): Promise<Command> => loadTypedCommand("conv");
export const getCreateCmd = async (): Promise<Command> => loadTypedCommand("create");
export const getFsCmd = async (): Promise<Command> => loadTypedCommand("fs");
export const getGetCmd = async (): Promise<Command> => loadTypedCommand("get");
export const getInitCmd = async (): Promise<Command> => loadTypedCommand("init");
export const getInjectCmd = async (): Promise<Command> => loadTypedCommand("inject");
export const getInstallCmd = async (): Promise<Command> => loadTypedCommand("install");
export const getLibsCmd = async (): Promise<Command> => loadTypedCommand("libs");
export const getMagicCmd = async (): Promise<Command> => loadTypedCommand("magic");
export const getMergeCmd = async (): Promise<Command> => loadTypedCommand("merge");
export const getMigrateCmd = async (): Promise<Command> => loadTypedCommand("migrate");
export const getMkdistCmd = async (): Promise<Command> => loadTypedCommand("mkdist");
export const getPackCmd = async (): Promise<Command> => loadTypedCommand("pack");
export const getPubCmd = async (): Promise<Command> => loadTypedCommand("pub");
export const getRemdnCmd = async (): Promise<Command> => loadTypedCommand("remdn");
export const getRemoveCmd = async (): Promise<Command> => loadTypedCommand("remove");
export const getRemptsCmd = async (): Promise<Command> => loadTypedCommand("rempts");
export const getSplitCmd = async (): Promise<Command> => loadTypedCommand("split");
export const getTransformCmd = async (): Promise<Command> => loadTypedCommand("transform");
export const getUpdateCmd = async (): Promise<Command> => loadTypedCommand("update");
export const getUpgradeCmd = async (): Promise<Command> => loadTypedCommand("upgrade");
export const getXCmd = async (): Promise<Command> => loadTypedCommand("x");

// Typed command functions with type safety
export async function callCmd<T extends keyof CommandArgsMap>(
  cmdName: T,
  args?: CommandArgsMap[T],
): Promise<void> {
  await callCmdImpl<CommandArgsMap>(cmdName, args);
}

export async function getTypedCmd<T extends keyof CommandArgsMap>(
  cmdName: T,
): Promise<{
  command: Command;
  run: (args?: CommandArgsMap[T]) => Promise<void>;
}> {
  return await getTypedCmdImpl<CommandArgsMap>(cmdName);
}

// Export type for external use
export type { CommandArgsMap };
