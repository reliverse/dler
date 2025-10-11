import fs from "node:fs";
import shebangCommand from "shebang-command";

export function readShebang(command: string): string | null {
  const size = 150;
  const buffer = Buffer.alloc(size);
  let fd: number | undefined;
  try {
    fd = fs.openSync(command, "r");
    fs.readSync(fd, buffer, 0, size, 0);
    fs.closeSync(fd);
  } catch {
    // Ignore error
  }
  return shebangCommand(buffer.toString());
}
