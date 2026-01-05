import { copy, move } from "./copy";
import {
  emptyDir,
  ensureDir,
  ensureFile,
  listFiles,
  mkdirp,
  pathExists,
  readdir,
  readdirRecursive,
  remove,
  sizeOf,
} from "./dir";
import {
  appendFile,
  outputFile,
  outputJson,
  readFile,
  readJSONSync,
  readJson,
  writeFile,
  writeJson,
} from "./file";
import { readLines, touch } from "./helpers";
import { ensureLink, ensureSymlink } from "./links";

export type {
  CopyOptions,
  EmptyDirOptions,
  EnsureSymlinkOptions,
  FileEncoding,
  JsonWriteOptions,
  ListFilesOptions,
  MoveOptions,
  PathLike,
  ReaddirOptions,
  ReadFileOptions,
  ReadLinesOptions,
  SizeOfOptions,
  TouchOptions,
  WriteFileOptions,
} from "./types";

// Named exports
export { copy, move };
export {
  emptyDir,
  ensureDir,
  ensureFile,
  listFiles,
  mkdirp,
  pathExists,
  readdir,
  readdirRecursive,
  remove,
  sizeOf,
};
export {
  appendFile,
  outputFile,
  outputJson,
  readFile,
  readJson,
  readJSONSync,
  writeFile,
  writeJson,
};
export { readLines, touch };
export { ensureLink, ensureSymlink };

// Default export
const fs = {
  appendFile,
  copy,
  move,
  emptyDir,
  ensureDir,
  ensureFile,
  listFiles,
  mkdirp,
  pathExists,
  readdir,
  readdirRecursive,
  remove,
  sizeOf,
  outputFile,
  outputJson,
  readFile,
  readJson,
  readJSONSync,
  writeFile,
  writeJson,
  readLines,
  touch,
  ensureLink,
  ensureSymlink,
} as const;

export default fs;
