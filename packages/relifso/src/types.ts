export type PathLike = string | URL;

export type FileInput =
  | string
  | ArrayBuffer
  | SharedArrayBuffer
  | NodeJS.ArrayBufferView
  | Blob;

export type FileEncoding =
  | "utf8"
  | "utf-8"
  | "ascii"
  | "base64"
  | "hex"
  | "latin1"
  | "ucs-2"
  | "ucs2"
  | "utf16le"
  | "binary";

export interface ReadFileOptions {
  readonly encoding?: FileEncoding;
}

export interface WriteFileOptions {
  readonly encoding?: FileEncoding;
  readonly mode?: number;
  readonly signal?: AbortSignal;
}

export interface JsonWriteOptions extends WriteFileOptions {
  readonly spaces?: number;
}

export interface CopyOptions {
  readonly overwrite?: boolean;
  readonly dereference?: boolean;
  readonly filter?: (path: string) => boolean | Promise<boolean>;
}

export interface RemoveOptions {
  readonly force?: boolean;
}

export interface ListFilesOptions {
  readonly extensions?: readonly string[];
  readonly followSymlinks?: boolean;
}

export interface EnsureSymlinkOptions {
  readonly type?: "file" | "dir" | "junction";
}

export interface ReaddirOptions {
  readonly withFileTypes?: boolean;
}

export interface EmptyDirOptions {
  readonly filter?: (path: string) => boolean | Promise<boolean>;
}

export interface SizeOfOptions {
  readonly followSymlinks?: boolean;
}

export interface TouchOptions {
  readonly mtime?: Date;
  readonly atime?: Date;
}

export interface ReadLinesOptions {
  readonly trim?: boolean;
  readonly skipEmpty?: boolean;
  readonly maxLines?: number;
}

export interface MoveOptions {
  readonly overwrite?: boolean;
}
