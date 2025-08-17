import path from "@reliverse/pathkit";
import {
  type FileTypeResult,
  fileTypeFromBuffer,
  fileTypeFromFile,
  fileTypeFromStream,
} from "file-type";

import { BINARY_SET } from "./b-exts";

/**
 * Detect file type from a file path
 */
export async function detectFileType(filePath: string): Promise<FileTypeResult | undefined> {
  try {
    // First try file-type library
    const result = await fileTypeFromFile(filePath);
    if (result) return result;

    // Fallback to extension check
    const ext = path.extname(filePath).slice(1).toLowerCase();
    if (BINARY_SET.has(ext)) {
      return {
        ext,
        mime: `application/${ext}`, // Generic MIME type as fallback
      };
    }

    return;
  } catch {
    // If file-type fails, fallback to extension check
    const ext = path.extname(filePath).slice(1).toLowerCase();
    if (BINARY_SET.has(ext)) {
      return {
        ext,
        mime: `application/${ext}`, // Generic MIME type as fallback
      };
    }
    return;
  }
}

/**
 * Detect file type from a buffer
 */
export async function detectBufferType(
  buffer: Uint8Array | ArrayBuffer,
): Promise<FileTypeResult | undefined> {
  try {
    const result = await fileTypeFromBuffer(buffer);
    if (result) return result;
    return;
  } catch {
    return;
  }
}

/**
 * Detect file type from a stream
 */
export async function detectStreamType(
  stream: ReadableStream<Uint8Array>,
): Promise<FileTypeResult | undefined> {
  try {
    const result = await fileTypeFromStream(stream);
    if (result) return result;
    return;
  } catch {
    return;
  }
}

/**
 * Check if a file is binary using both file-type and BINARY_EXTS
 */
export async function isBinary(filePath: string): Promise<boolean> {
  try {
    // First try file-type library
    const result = await fileTypeFromFile(filePath);
    if (result) return true;

    // Fallback to extension check
    const ext = path.extname(filePath).slice(1).toLowerCase();
    return BINARY_SET.has(ext);
  } catch {
    // If file-type fails, fallback to extension check
    const ext = path.extname(filePath).slice(1).toLowerCase();
    return BINARY_SET.has(ext);
  }
}

/**
 * Get MIME type for a file using both file-type and BINARY_EXTS
 */
export async function getMimeType(filePath: string): Promise<string | undefined> {
  try {
    // First try file-type library
    const result = await fileTypeFromFile(filePath);
    if (result?.mime) return result.mime;

    // Fallback to extension check
    const ext = path.extname(filePath).slice(1).toLowerCase();
    if (BINARY_SET.has(ext)) {
      return `application/${ext}`; // Generic MIME type as fallback
    }

    return;
  } catch {
    // If file-type fails, fallback to extension check
    const ext = path.extname(filePath).slice(1).toLowerCase();
    if (BINARY_SET.has(ext)) {
      return `application/${ext}`; // Generic MIME type as fallback
    }
    return;
  }
}
