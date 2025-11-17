export type PathLike = string | URL;

export type FileInput =
  | string
  | ArrayBuffer
  | SharedArrayBuffer
  | NodeJS.ArrayBufferView
  | Blob;

export interface ReadFileOptions {
  readonly encoding?: "utf8";
}

export interface WriteFileOptions {
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
