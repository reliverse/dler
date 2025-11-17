import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PathLike } from "../types";

export const toPathString = (input: PathLike): string => {
  if (typeof input === "string") {
    return resolve(input);
  }

  return resolve(fileURLToPath(input));
};

export const getPathDirname = (input: PathLike): string => {
  return dirname(toPathString(input));
};
