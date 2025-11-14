// Simple test to verify the DLL loads
import { dlopen, FFIType, suffix } from 'bun:ffi';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dllPath = path.join(__dirname, 'release', 'dler-prompt-win32-amd64.dll');

console.log('Loading DLL from:', dllPath);

try {
  const { symbols } = dlopen(dllPath, {
    FreeString: {
      args: [FFIType.ptr],
      returns: FFIType.void
    },
    CreatePrompt: {
      args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.bool, FFIType.int],
      returns: FFIType.ptr
    },
    CreateSelection: {
      args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.int],
      returns: FFIType.ptr
    }
  });
  
  console.log('✓ DLL loaded successfully!');
  console.log('Available symbols:', Object.keys(symbols));
} catch (error) {
  console.error('✗ Failed to load DLL:', error.message);
}

