import { relinka } from "@reliverse/relinka";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream";

// Step 1: Copy file using streams
export function copyFileWithStream(sourcePath: string, outPath: string) {
  relinka("info", "Step 1: Copying file using streams");
  relinka("verbose", `Copying from ${sourcePath} to ${outPath}`);

  const sourceStream = createReadStream(sourcePath);
  const outStream = createWriteStream(outPath);

  return new Promise<void>((resolve, reject) => {
    pipeline(sourceStream, outStream, (error) => {
      if (error) {
        relinka("error", `Failed to copy file: ${error.message}`);
        reject(error);
      } else {
        relinka("verbose", "File copied successfully");
        resolve();
      }
    });
  });
}
