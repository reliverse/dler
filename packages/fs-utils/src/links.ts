import { dirname } from "node:path";
import { ensureDir, remove } from "./dir";
import { fsLink, fsLStat, fsSymlink, fsUnlink } from "./internal/fs";
import { toPathString } from "./internal/path";
import type { EnsureSymlinkOptions, PathLike } from "./types";

const ensureParentDirectory = async (path: string): Promise<void> => {
  const directory = dirname(path);

  if (directory.length === 0) {
    return;
  }

  await ensureDir(directory);
};

const removeExistingPath = async (path: string): Promise<void> => {
  try {
    await fsUnlink(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT") {
      return;
    }

    if (code === "EISDIR" || code === "EPERM") {
      await remove(path);

      return;
    }

    throw error;
  }
};

const resolveSymlinkType = async (
  source: string,
  type?: EnsureSymlinkOptions["type"],
): Promise<EnsureSymlinkOptions["type"] | undefined> => {
  if (type) {
    if (type === "dir" && process.platform === "win32") {
      return "junction";
    }

    return type;
  }

  if (process.platform !== "win32") {
    return undefined;
  }

  try {
    const stats = await fsLStat(source);

    return stats.isDirectory() ? "junction" : "file";
  } catch {
    return "file";
  }
};

export const ensureLink = async (
  from: PathLike,
  to: PathLike,
): Promise<void> => {
  const source = toPathString(from);
  const destination = toPathString(to);

  await ensureParentDirectory(destination);

  try {
    await fsLink(source, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      await removeExistingPath(destination);
      await fsLink(source, destination);

      return;
    }

    throw error;
  }
};

export const ensureSymlink = async (
  from: PathLike,
  to: PathLike,
  options?: EnsureSymlinkOptions,
): Promise<void> => {
  const source = toPathString(from);
  const destination = toPathString(to);
  const type = await resolveSymlinkType(source, options?.type);

  await ensureParentDirectory(destination);

  try {
    await fsSymlink(source, destination, type);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      await remove(destination);
      await fsSymlink(source, destination, type);

      return;
    }

    throw error;
  }
};
