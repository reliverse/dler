import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { ensureDir } from "./dir";
import { fsAppendFile, fsWriteFile } from "./internal/fs";
import { toPathString } from "./internal/path";
import type {
  FileEncoding,
  FileInput,
  JsonWriteOptions,
  PathLike,
  ReadFileOptions,
  WriteFileOptions,
} from "./types";

type BunWritable = string | Uint8Array | Blob;

const toBunWritable = async (input: FileInput): Promise<BunWritable> => {
  if (typeof input === "string" || input instanceof Uint8Array) {
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

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  // Fallback: should never reach here, but TypeScript needs this
  return new Uint8Array(input as unknown as ArrayBuffer);
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
  options: ReadFileOptions & { readonly encoding: FileEncoding },
): Promise<string>;
export function readFile(path: PathLike): Promise<Uint8Array>;
export async function readFile(
  path: PathLike,
  options?: ReadFileOptions,
): Promise<string | Uint8Array> {
  const file = Bun.file(toPathString(path));
  const encoding = options?.encoding;

  // No encoding or binary: return Uint8Array
  if (!encoding || encoding === "binary") {
    return file.bytes();
  }

  // UTF-8: use Bun's native text() method (fastest)
  if (encoding === "utf8" || encoding === "utf-8") {
    return file.text();
  }

  // For other encodings, read as bytes and convert using Buffer
  const bytes = await file.bytes();
  const buffer = Buffer.from(bytes);

  switch (encoding) {
    case "ascii":
      return buffer.toString("ascii");
    case "base64":
      return buffer.toString("base64");
    case "hex":
      return buffer.toString("hex");
    case "latin1":
      return buffer.toString("latin1");
    case "ucs-2":
    case "ucs2":
      return buffer.toString("ucs2");
    case "utf16le":
      return buffer.toString("utf16le");
    default:
      // Fallback to utf8 for unknown encodings
      return buffer.toString("utf8");
  }
}

export const readJson = async <T>(
  path: PathLike,
  _options?: ReadFileOptions,
): Promise<T> => {
  // Use Bun.file().json() for optimal performance (native JSON parsing)
  // Options are ignored as Bun.file().json() doesn't support them
  const file = Bun.file(toPathString(path));

  return file.json() as Promise<T>;
};

export const readJSONSync = <T>(path: PathLike): T => {
  // Synchronous version using node:fs readFileSync
  const pathStr = toPathString(path);
  const content = readFileSync(pathStr, "utf8");

  return JSON.parse(content) as T;
};

export const writeFile = async (
  destination: PathLike,
  input: FileInput,
  options?: WriteFileOptions,
): Promise<void> => {
  const encoding = options?.encoding;
  const hasSpecialOptions =
    options?.mode !== undefined || options?.signal !== undefined;

  // Handle encoding conversion for string input
  // UTF-8 is the default and handled by Bun.write() directly (fastest)
  if (
    typeof input === "string" &&
    encoding &&
    encoding !== "utf8" &&
    encoding !== "utf-8" &&
    encoding !== "binary"
  ) {
    // Convert string to Buffer with specified encoding, then to Uint8Array
    const buffer = Buffer.from(input, encoding);
    const bytes = new Uint8Array(buffer);

    if (!hasSpecialOptions) {
      // Fast path: use Bun.write() directly
      await Bun.write(destination, bytes);
      return;
    }

    // Slow path: use node:fs when mode or signal is needed
    const path = toPathString(destination);
    await fsWriteFile(path, bytes, {
      mode: options.mode,
      signal: options.signal,
    });
    return;
  }

  // No encoding conversion needed
  if (!hasSpecialOptions) {
    // Fast path: Bun.write() accepts these types directly and uses optimized syscalls
    if (
      typeof input === "string" ||
      input instanceof Uint8Array ||
      input instanceof Blob
    ) {
      await Bun.write(destination, input);
      return;
    }

    // Convert other types to Uint8Array
    const payload = await toBunWritable(input);
    await Bun.write(destination, payload);
    return;
  }

  // Slow path: when mode or signal options are needed, use node:fs
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

export const appendFile = async (
  file: PathLike,
  data: FileInput,
  options?: WriteFileOptions,
): Promise<void> => {
  const pathStr = toPathString(file);
  const encoding = options?.encoding;

  // Ensure parent directory exists
  const dir = dirname(pathStr);
  if (dir.length > 0) {
    await ensureDir(dir);
  }

  // Handle encoding conversion for string input
  if (
    typeof data === "string" &&
    encoding &&
    encoding !== "utf8" &&
    encoding !== "utf-8" &&
    encoding !== "binary"
  ) {
    // Convert string to Buffer with specified encoding
    const buffer = Buffer.from(data, encoding);
    await fsAppendFile(pathStr, buffer, {
      mode: options?.mode,
    });
    return;
  }

  // Convert input to appropriate format for appendFile
  let payload: string | Uint8Array;

  if (typeof data === "string") {
    // String data - appendFile will handle UTF-8 encoding
    payload = data;
  } else if (data instanceof Uint8Array) {
    payload = data;
  } else if (data instanceof Blob) {
    const buffer = await data.arrayBuffer();
    payload = new Uint8Array(buffer);
  } else if (ArrayBuffer.isView(data)) {
    payload = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else if (data instanceof SharedArrayBuffer) {
    payload = new Uint8Array(data);
  } else {
    payload = new Uint8Array(data);
  }

  // Note: fs.appendFile doesn't support signal option
  await fsAppendFile(pathStr, payload, {
    mode: options?.mode,
  });
};
