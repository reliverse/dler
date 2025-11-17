import { dirname } from "node:path";
import { ensureDir } from "./dir";
import { fsWriteFile } from "./internal/fs";
import { toPathString } from "./internal/path";
import type {
  FileInput,
  JsonWriteOptions,
  PathLike,
  ReadFileOptions,
  WriteFileOptions,
} from "./types";

type BunWritable = string | Uint8Array | Blob;

const toBunWritable = async (input: FileInput): Promise<BunWritable> => {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof Uint8Array) {
    return input;
  }

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }

  if (input instanceof Blob) {
    const buffer = await input.arrayBuffer();

    return new Uint8Array(buffer);
  }

  if (input instanceof SharedArrayBuffer) {
    return new Uint8Array(input);
  }

  return new Uint8Array(input);
};

const toNodeWritable = async (
  input: FileInput,
): Promise<string | NodeJS.ArrayBufferView> => {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof Blob) {
    const buffer = await input.arrayBuffer();

    return new Uint8Array(buffer);
  }

  if (input instanceof Uint8Array) {
    return input;
  }

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }

  if (input instanceof SharedArrayBuffer) {
    return new Uint8Array(input);
  }

  return new Uint8Array(input);
};

const ensureOutputDestination = async (path: PathLike): Promise<string> => {
  const resolved = toPathString(path);
  const directory = dirname(resolved);

  if (directory.length > 0) {
    await ensureDir(directory);
  }

  return resolved;
};

export function readFile(
  path: PathLike,
  options: ReadFileOptions & { readonly encoding: "utf8" },
): Promise<string>;
export function readFile(path: PathLike): Promise<Uint8Array>;
export async function readFile(
  path: PathLike,
  options?: ReadFileOptions,
): Promise<string | Uint8Array> {
  const file = Bun.file(toPathString(path));

  if (options?.encoding === "utf8") {
    return file.text();
  }

  const buffer = await file.arrayBuffer();

  return new Uint8Array(buffer);
}

export const readJson = async <T>(
  path: PathLike,
  options?: ReadFileOptions,
): Promise<T> => {
  const content = await readFile(path, { encoding: "utf8", ...options });

  return JSON.parse(content) as T;
};

export const writeFile = async (
  destination: PathLike,
  input: FileInput,
  options?: WriteFileOptions,
): Promise<void> => {
  if (
    !options ||
    (options.mode === undefined && options.signal === undefined)
  ) {
    const payload = await toBunWritable(input);
    await Bun.write(destination, payload);

    return;
  }

  const payload = await toNodeWritable(input);
  const path = toPathString(destination);

  await fsWriteFile(path, payload, {
    mode: options.mode,
    signal: options.signal,
  });
};

export const writeJson = async (
  destination: PathLike,
  data: unknown,
  options?: JsonWriteOptions,
): Promise<void> => {
  const spaces = options?.spaces ?? 2;
  const text = `${JSON.stringify(data, undefined, spaces)}\n`;

  await writeFile(destination, text, options);
};

export const outputFile = async (
  destination: PathLike,
  input: FileInput,
  options?: WriteFileOptions,
): Promise<void> => {
  const target = await ensureOutputDestination(destination);

  await writeFile(target, input, options);
};

export const outputJson = async (
  destination: PathLike,
  data: unknown,
  options?: JsonWriteOptions,
): Promise<void> => {
  const target = await ensureOutputDestination(destination);

  await writeJson(target, data, options);
};
