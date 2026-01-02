import { dlopen, FFIType, suffix } from "bun:ffi";
import { existsSync } from "node:fs";
import path from "node:path";

const { platform, arch } = process;

function getBinaryLocation(): string {
  let filename: string;

  if (arch === "x64") {
    filename = `../release/rempts-${platform}-amd64.${suffix}`;
  } else {
    filename = `../release/rempts-${platform}-${arch}.${suffix}`;
  }

  return Bun.fileURLToPath(new URL(filename, import.meta.url));
}

let cachedSymbols: any;

function loadSymbols(): any {
  if (cachedSymbols) {
    return cachedSymbols;
  }

  const location = getBinaryLocation();

  // Check if the file exists before trying to load it
  if (!existsSync(location)) {
    const releaseDir = path.dirname(location);
    const expectedFile = path.basename(location);

    let errorMessage = `\n❌ Native binary not found! (Did you have Docker launched?)\n\n`;
    errorMessage += `Expected file: ${location}\n\n`;

    if (!existsSync(releaseDir)) {
      errorMessage += `The release directory does not exist: ${releaseDir}\n\n`;
    } else {
      errorMessage += `The release directory exists but the binary is missing.\n`;
      errorMessage += `Expected: ${expectedFile}\n\n`;
    }

    errorMessage += `To fix this, run:\n`;
    errorMessage += `  bun run build\n\n`;
    errorMessage += `Or use native build (no Docker):\n`;
    errorMessage += `  bun run build --provider native\n`;

    throw new Error(errorMessage);
  }

  try {
    cachedSymbols = dlopen(location, {
      CreateSelection: {
        args: [
          FFIType.ptr,
          FFIType.ptr,
          FFIType.ptr,
          FFIType.int,
          FFIType.bool,
          FFIType.ptr,
          FFIType.ptr,
        ],
        returns: FFIType.ptr,
      },
      CreatePrompt: {
        args: [
          FFIType.ptr,
          FFIType.ptr,
          FFIType.ptr,
          FFIType.ptr,
          FFIType.ptr,
          FFIType.ptr,
          FFIType.bool,
          FFIType.int,
        ],
        returns: FFIType.ptr,
      },
      CreateMultiselect: {
        args: [
          FFIType.ptr,
          FFIType.ptr,
          FFIType.ptr,
          FFIType.int,
          FFIType.bool,
          FFIType.ptr,
          FFIType.ptr,
        ],
        returns: FFIType.ptr,
      },
      CreateConfirm: {
        args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr],
        returns: FFIType.ptr,
      },
      CreateGroupMultiselect: {
        args: [
          FFIType.ptr,
          FFIType.ptr,
          FFIType.ptr,
          FFIType.int,
          FFIType.bool,
          FFIType.bool,
          FFIType.ptr,
          FFIType.ptr,
          FFIType.int,
        ],
        returns: FFIType.ptr,
      },
      FreeString: {
        args: [FFIType.ptr],
        returns: FFIType.void,
      },
    }).symbols;
  } catch (error: any) {
    let errorMessage = `\n❌ Failed to load native binary!\n\n`;
    errorMessage += `File: ${location}\n`;
    errorMessage += `Error: ${error.message || error}\n\n`;

    if (error.code === "ERR_DLOPEN_FAILED" || error.errno === 126) {
      errorMessage += `This usually means:\n`;
      errorMessage += `  • The binary is corrupted or incomplete\n`;
      errorMessage += `  • Missing dependencies (DLLs, shared libraries)\n`;
      errorMessage += `  • Architecture mismatch\n\n`;
      errorMessage += `Try rebuilding:\n`;
      errorMessage += `  bun run build\n`;
    } else {
      errorMessage += `Please rebuild the native binaries:\n`;
      errorMessage += `  bun run build\n`;
    }

    throw new Error(errorMessage);
  }

  return cachedSymbols;
}

// Export a getter object that loads symbols lazily
export const symbols = new Proxy({} as any, {
  get(_target, prop) {
    const symbols = loadSymbols();
    return symbols[prop];
  },
  has(_target, prop) {
    const symbols = loadSymbols();
    return prop in symbols;
  },
  ownKeys(_target) {
    const symbols = loadSymbols();
    return Object.keys(symbols);
  },
  getOwnPropertyDescriptor(_target, prop) {
    const symbols = loadSymbols();
    return Object.getOwnPropertyDescriptor(symbols, prop);
  },
});
