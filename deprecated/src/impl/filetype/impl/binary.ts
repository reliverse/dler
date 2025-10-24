import path from "@reliverse/pathkit";

import { BINARY_SET } from "./b-exts";
import { isBinary } from "./file-type";

/**
 * Check if a file is binary using both file-type library and BINARY_EXTS fallback
 */
export const isBinaryExt = async (file: string): Promise<boolean> => {
  try {
    return await isBinary(file);
  } catch {
    // Fallback to extension check if file-type fails
    const ext = path.extname(file).slice(1).toLowerCase();
    return BINARY_SET.has(ext);
  }
};
