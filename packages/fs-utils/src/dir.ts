import { dirname, join } from "node:path";
import {
  fsAccess,
  fsConstants,
  fsLStat,
  fsMkdir,
  fsReaddir,
  fsRm,
  fsUnlink,
} from "./internal/fs";
import { toPathString } from "./internal/path";
import type { ListFilesOptions, PathLike } from "./types";

export const pathExists = async (path: PathLike): Promise<boolean> => {
  try {
    await fsAccess(toPathString(path), fsConstants.F_OK);

    return true;
  } catch {
    return false;
  }
};

export const ensureDir = async (path: PathLike): Promise<void> => {
  await fsMkdir(toPathString(path), { recursive: true });
};

export const mkdirp = ensureDir;

export const remove = async (
  path: PathLike,
  options?: { readonly force?: boolean },
): Promise<void> => {
  await fsRm(toPathString(path), {
    recursive: true,
    force: options?.force ?? true,
  });
};

export const emptyDir = async (path: PathLike): Promise<void> => {
  const target = toPathString(path);
  await ensureDir(target);

  const entries = await fsReaddir(target, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(target, entry.name);

    if (entry.isDirectory()) {
      await remove(entryPath);
      continue;
    }

    await fsUnlink(entryPath);
  }
};

export const sizeOf = async (path: PathLike): Promise<number> => {
  const target = toPathString(path);
  const stats = await fsLStat(target);

  if (stats.isDirectory()) {
    let total = 0;
    const entries = await fsReaddir(target, { withFileTypes: true });

    for (const entry of entries) {
      total += await sizeOf(join(target, entry.name));
    }

    return total;
  }

  return stats.size;
};

export const readdirRecursive = async (
  path: PathLike,
  options?: ListFilesOptions,
): Promise<string[]> => {
  const target = toPathString(path);
  const queue: string[] = [target];
  const files: string[] = [];
  const follow = options?.followSymlinks ?? false;
  const extensions = options?.extensions?.map((ext) =>
    ext.startsWith(".") ? ext : `.${ext}`,
  );

  while (queue.length > 0) {
    const current = queue.pop()!;
    const entries = await fsReaddir(current, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(current, entry.name);

      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }

      if (entry.isSymbolicLink() && !follow) {
        continue;
      }

      if (extensions && extensions.length > 0) {
        const match = extensions.some((ext) => entry.name.endsWith(ext));

        if (!match) {
          continue;
        }
      }

      files.push(entryPath);
    }
  }

  return files;
};

export const listFiles = readdirRecursive;

export const ensureFile = async (path: PathLike): Promise<void> => {
  const fullPath = toPathString(path);
  const dir = dirname(fullPath);

  if (dir.length > 0) {
    await ensureDir(dir);
  }

  if (await pathExists(fullPath)) {
    return;
  }

  await Bun.write(fullPath, "");
};
