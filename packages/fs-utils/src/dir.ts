import { dirname, join } from "node:path";
import {
  fsLStat,
  fsMkdir,
  fsReaddir,
  fsRm,
  fsStat,
  fsUnlink,
} from "./internal/fs";
import { toPathString } from "./internal/path";
import type {
  EmptyDirOptions,
  ListFilesOptions,
  PathLike,
  ReaddirOptions,
  SizeOfOptions,
} from "./types";

export const pathExists = async (path: PathLike): Promise<boolean> => {
  const pathStr = toPathString(path);
  const file = Bun.file(pathStr);

  // Bun.file().exists() is always available and optimized
  return file.exists();
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

export const emptyDir = async (
  path: PathLike,
  options?: EmptyDirOptions,
): Promise<void> => {
  const target = toPathString(path);
  await ensureDir(target);

  const entries = await fsReaddir(target, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(target, entry.name);

    if (options?.filter) {
      const shouldKeep = await options.filter(entryPath);

      if (shouldKeep) {
        continue;
      }
    }

    if (entry.isDirectory()) {
      await remove(entryPath);
      continue;
    }

    await fsUnlink(entryPath);
  }
};

export const sizeOf = async (
  path: PathLike,
  options?: SizeOfOptions,
): Promise<number> => {
  const target = toPathString(path);
  const stats = options?.followSymlinks
    ? await fsStat(target)
    : await fsLStat(target);

  if (stats.isDirectory()) {
    let total = 0;
    const entries = await fsReaddir(target, { withFileTypes: true });

    for (const entry of entries) {
      total += await sizeOf(join(target, entry.name), options);
    }

    return total;
  }

  return stats.size;
};

export const readdir = async (
  path: PathLike,
  options?: ReaddirOptions,
): Promise<string[]> => {
  const target = toPathString(path);

  if (options?.withFileTypes) {
    const entries = await fsReaddir(target, { withFileTypes: true });

    return entries.map((entry) => entry.name);
  }

  const entries = await fsReaddir(target);

  return entries;
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

  // Try to write directly, catch EEXIST if file already exists
  // This avoids an extra syscall (pathExists check)
  try {
    await Bun.write(fullPath, "");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    // If file already exists, that's fine
    if (code !== "EEXIST") {
      throw error;
    }
  }
};
