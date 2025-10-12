import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream";

export function copyFileWithStream(sourcePath: string, outPath: string) {
  const sourceStream = createReadStream(sourcePath);
  const outStream = createWriteStream(outPath);
  return new Promise((resolve, reject) => {
    pipeline(sourceStream, outStream, (error) => {
      if (error) {
        reject(error);
      } else {
        // @ts-expect-error TODO: fix ts
        resolve();
      }
    });
  });
}
