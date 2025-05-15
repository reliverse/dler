/**
 * This script:
 * 1) Reads all *.ts or *.js files from a directory.
 * 2) Splits files larger than a specified line threshold.
 * 3) Splits functions larger than a specified line threshold into smaller helpers.
 *
 * Usage:
 *   bun src/split-large-files.ts --dir ./example --file-threshold 30 --func-threshold 20
 *
 * Warning: This script is experimental and might break code. A more stable version will be available in the future.
 */

/* import fs from "fs-extra";

import {
  getAllSourceFiles,
  parseCommandLineArgs,
  splitLargeFileByLines,
  splitLargeFunctions,
} from "./impl.js";

async function main() {
  const { directory, fileLineThreshold, funcLineThreshold } =
    parseCommandLineArgs();
  const allFiles = getAllSourceFiles(directory);

  for (const filePath of allFiles) {
    // 1) Split entire file if it’s too large:
    const lineCount = fs.readFileSync(filePath, "utf8").split("\n").length;
    if (lineCount > fileLineThreshold) {
      // This returns an array of newly created file paths
      const newSplits = splitLargeFileByLines(filePath, fileLineThreshold);
      // Run "splitLargeFunctions" on each chunk
      // biome-ignore lint/complexity/noForEach: <explanation>
      newSplits.forEach((splitFilePath) => {
        splitLargeFunctions(splitFilePath, funcLineThreshold);
      });
    } else {
      // 2) Split large functions in the original file
      splitLargeFunctions(filePath, funcLineThreshold);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); */
