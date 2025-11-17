import { ensureFile } from "./dir";
import { readFile } from "./file";
import { fsStat, fsUtimes } from "./internal/fs";
import { toPathString } from "./internal/path";
import type { PathLike } from "./types";

export const touch = async (
  path: PathLike,
  time: Date = new Date(),
): Promise<void> => {
  const target = toPathString(path);

  await ensureFile(target);

  const stats = await fsStat(target);
  const atime = stats.atime;

  await fsUtimes(target, atime, time);
};

export const readLines = async (
  path: PathLike,
  options?: { readonly trim?: boolean },
): Promise<string[]> => {
  const text = await readFile(path, { encoding: "utf8" });
  const lines = text.split(/\r?\n/);

  if (options?.trim) {
    for (let index = 0; index < lines.length; index += 1) {
      lines[index] = lines[index]?.trim() ?? "";
    }
  }

  const result: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (line === "" && index === lines.length - 1) {
      continue;
    }

    result.push(line);
  }

  return result;
};
