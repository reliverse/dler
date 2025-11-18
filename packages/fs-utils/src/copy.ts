import { dirname, join } from "node:path";
import { ensureDir, pathExists, remove } from "./dir";
import {
  fsLStat,
  fsReaddir,
  fsReadlink,
  fsRename,
  fsStat,
  fsSymlink,
} from "./internal/fs";
import { toPathString } from "./internal/path";
import type { CopyOptions, MoveOptions, PathLike } from "./types";

const shouldCopyEntry = async (
  path: string,
  filter?: CopyOptions["filter"],
): Promise<boolean> => {
  if (!filter) {
    return true;
  }

  const result = filter(path);

  if (result instanceof Promise) {
    return result;
  }

  return result;
};

const copyFile = async (
  source: string,
  destination: string,
  overwrite: boolean,
): Promise<void> => {
  await ensureDir(dirname(destination));

  if (!overwrite && (await pathExists(destination))) {
    return;
  }

  // Use Bun.write() directly for optimal performance (uses copy_file_range/sendfile)
  await Bun.write(destination, Bun.file(source));
};

const copySymlink = async (
  source: string,
  destination: string,
): Promise<void> => {
  const target = await fsReadlink(source);

  try {
    await fsSymlink(target, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      await remove(destination);
      await fsSymlink(target, destination);

      return;
    }

    throw error;
  }
};

const copyDirectory = async (
  source: string,
  destination: string,
  options: CopyOptions,
): Promise<void> => {
  await ensureDir(destination);
  const entries = await fsReaddir(source, { withFileTypes: true });

  for (const entry of entries) {
    const entrySource = join(source, entry.name);
    const entryDest = join(destination, entry.name);

    if (!(await shouldCopyEntry(entrySource, options.filter))) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirectory(entrySource, entryDest, options);
      continue;
    }

    if (entry.isSymbolicLink() && !options.dereference) {
      await copySymlink(entrySource, entryDest);
      continue;
    }

    await copyFile(entrySource, entryDest, options.overwrite ?? true);
  }
};

export const copy = async (
  from: PathLike,
  to: PathLike,
  options: CopyOptions = {},
): Promise<void> => {
  const source = toPathString(from);
  const destination = toPathString(to);
  const stats = options.dereference
    ? await fsStat(source)
    : await fsLStat(source);

  if (stats.isDirectory()) {
    await copyDirectory(source, destination, options);

    return;
  }

  if (stats.isSymbolicLink() && !options.dereference) {
    await copySymlink(source, destination);

    return;
  }

  await copyFile(source, destination, options.overwrite ?? true);
};

export const move = async (
  from: PathLike,
  to: PathLike,
  options?: MoveOptions,
): Promise<void> => {
  const source = toPathString(from);
  const destination = toPathString(to);

  if (!options?.overwrite && (await pathExists(destination))) {
    return;
  }

  try {
    await ensureDir(dirname(destination));
    await fsRename(source, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EXDEV") {
      await copy(source, destination, {
        overwrite: options?.overwrite ?? true,
      });
      await remove(source);

      return;
    }

    throw error;
  }
};
