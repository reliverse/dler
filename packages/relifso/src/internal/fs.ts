import {
  access,
  appendFile,
  constants,
  link,
  lstat,
  mkdir,
  readdir,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";

export const fsAccess = access;
export const fsAppendFile = appendFile;
export const fsConstants = constants;
export const fsLink = link;
export const fsLStat = lstat;
export const fsMkdir = mkdir;
export const fsReaddir = readdir;
export const fsReadlink = readlink;
export const fsRename = rename;
export const fsRm = rm;
export const fsStat = stat;
export const fsSymlink = symlink;
export const fsUnlink = unlink;
export const fsUtimes = utimes;
export const fsWriteFile = writeFile;
