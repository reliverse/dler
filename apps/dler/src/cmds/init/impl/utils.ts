import { mkdir, exists } from "node:fs/promises";
import { join } from "node:path";
import { write } from "bun";

export const getWorkspaceScope = (workspace: string): string => {
  return `@${workspace.charAt(0)}/`;
};

export const ensureDir = async (path: string): Promise<void> => {
  const dirExists = await exists(path);
  if (!dirExists) {
    await mkdir(path, { recursive: true });
  }
};

export const writeJsonFile = async (
  path: string,
  data: unknown,
): Promise<void> => {
  await write(path, JSON.stringify(data, null, 2) + "\n");
};

export const writeTextFile = async (
  path: string,
  content: string,
): Promise<void> => {
  await write(path, content);
};

export const fileExists = async (path: string): Promise<boolean> => {
  return exists(path);
};

export const createFullPath = (...paths: string[]): string => {
  return join(...paths);
};
