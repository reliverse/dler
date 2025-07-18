import type { Command } from "@reliverse/rempts";

import { loadCommand } from "@reliverse/rempts";

export const getAggCmd = async (): Promise<Command> => loadCommand("agg");

export const getBuildCmd = async (): Promise<Command> => loadCommand("build");

export const getCheckCmd = async (): Promise<Command> => loadCommand("check");

export const getConvCmd = async (): Promise<Command> => loadCommand("conv");

export const getCopyCmd = async (): Promise<Command> => loadCommand("copy");

export const getInitCmd = async (): Promise<Command> => loadCommand("init");

export const getInjectCmd = async (): Promise<Command> => loadCommand("inject");

export const getLibsCmd = async (): Promise<Command> => loadCommand("libs");

export const getMergeCmd = async (): Promise<Command> => loadCommand("merge");

export const getMigrateCmd = async (): Promise<Command> => loadCommand("migrate");

export const getPubCmd = async (): Promise<Command> => loadCommand("pub");

export const getRemptsCmd = async (): Promise<Command> => loadCommand("rempts");

export const getRenameCmd = async (): Promise<Command> => loadCommand("rename");

export const getMagicCmd = async (): Promise<Command> => loadCommand("magic");

export const getSplitCmd = async (): Promise<Command> => loadCommand("split");

export const getRmCmd = async (): Promise<Command> => loadCommand("rm");

export const getUpdateCmd = async (): Promise<Command> => loadCommand("update");
