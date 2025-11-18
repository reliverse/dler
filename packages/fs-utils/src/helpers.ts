import { ensureFile } from "./dir";
import { readFile } from "./file";
import { fsStat, fsUtimes } from "./internal/fs";
import { toPathString } from "./internal/path";
import type { PathLike, ReadLinesOptions, TouchOptions } from "./types";

export const touch = async (
  path: PathLike,
  options?: TouchOptions | Date,
): Promise<void> => {
  const target = toPathString(path);

  await ensureFile(target);

  const stats = await fsStat(target);

  // Support legacy Date parameter for backward compatibility
  if (options instanceof Date) {
    await fsUtimes(target, stats.atime, options);

    return;
  }

  const mtime = options?.mtime ?? new Date();
  const atime = options?.atime ?? stats.atime;

  await fsUtimes(target, atime, mtime);
};

export const readLines = async (
  path: PathLike,
  options?: ReadLinesOptions,
): Promise<string[]> => {
  const text = await readFile(path, { encoding: "utf8" });
  const lines = text.split(/\r?\n/);

  const result: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index] ?? "";

    if (options?.trim) {
      line = line.trim();
    }

    if (options?.skipEmpty && line === "") {
      continue;
    }

    if (options?.maxLines && result.length >= options.maxLines) {
      break;
    }

    // Skip trailing empty line
    if (line === "" && index === lines.length - 1) {
      continue;
    }

    result.push(line);
  }

  return result;
};
