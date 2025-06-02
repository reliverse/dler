import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import ts from "typescript";

/**
 * 1) Reads all *.ts or *.js files from the given directory (recursively).
 * 2) Returns their file paths.
 */
export function getAllSourceFiles(dir: string): string[] {
  const results: string[] = [];

  function searchDirectory(directory: string) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
      const fullPath = path.join(directory, file);
      if (fs.statSync(fullPath).isDirectory()) {
        searchDirectory(fullPath);
      } else if (/\.(ts|js)$/.test(file)) {
        results.push(fullPath);
      }
    }
  }

  searchDirectory(dir);
  return results;
}

/**
 * Splits a file by line threshold. For instance, if a file has 1000 lines and threshold=300,
 * it will generate multiple chunks (e.g., 300 lines, 300 lines, 300 lines, 100 lines).
 * Returns the new file paths after splitting.
 */
export function splitLargeFileByLines(filePath: string, threshold: number): string[] {
  const originalContent = fs.readFileSync(filePath, "utf8");
  const lines = originalContent.split("\n");
  if (lines.length <= threshold) {
    // No need to split
    return [filePath];
  }

  console.log(`File "${filePath}" exceeds ${threshold} lines. Splitting...`);

  // Example naming: myFile.ts -> myFile.part1.ts, myFile.part2.ts, ...
  const baseName = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);
  const dirName = path.dirname(filePath);

  const newFilePaths: string[] = [];
  let chunkIndex = 0;
  let i = 0;

  while (i < lines.length) {
    chunkIndex++;
    const chunkLines = lines.slice(i, i + threshold);
    const newFileName = `${baseName}.part${chunkIndex}${ext}`;
    const newFileFullPath = path.join(dirName, newFileName);

    fs.writeFileSync(newFileFullPath, chunkLines.join("\n"), "utf8");
    newFilePaths.push(newFileFullPath);

    i += threshold;
  }

  // TODO: if requested by a library user, remove
  // TODO: original large file or rename it, etc.
  // fs.unlinkSync(filePath);
  return newFilePaths;
}

/**
 * Splits large functions found in the source file into smaller helper functions.
 * - Parse the file with TypeScript to find function declarations and line counts.
 * - If a function is over a threshold, attempt to break it into two smaller functions.
 * - Currently this is naive. It basically splits the function body roughly in the middle.
 */
export function splitLargeFunctions(filePath: string, funcLineThreshold: number): void {
  const sourceCode = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.ESNext, true);

  // We'll build a new source string that includes rewritten large functions.
  let newSource = sourceCode; // naive approach modifies code textually

  // A helper function to locate line/char positions in original source
  const getLineOfPosition = (pos: number): number => {
    return sourceFile.getLineAndCharacterOfPosition(pos).line;
  };

  // We want to discover all function-like declarations
  // This includes "function foo() {}", potentially arrow functions, etc.
  // Currently, we'll just handle FunctionDeclaration nodes.
  const largeFunctions: {
    name: string;
    startPos: number;
    endPos: number;
    lineCount: number;
  }[] = [];

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.body) {
      const startLine = getLineOfPosition(node.body.pos);
      const endLine = getLineOfPosition(node.body.end);
      const lineCount = endLine - startLine;

      if (lineCount > funcLineThreshold) {
        const name = node.name?.text || "<anonymous>";
        largeFunctions.push({
          name,
          startPos: node.body.pos,
          endPos: node.body.end,
          lineCount,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  if (largeFunctions.length === 0) {
    return; // No large functions found, nothing to do.
  }

  console.log(
    `File "${filePath}" has ${largeFunctions.length} function(s) above ${funcLineThreshold} lines. Attempting to split...`,
  );

  // We'll apply splits from the bottom of the file upward, so we don't mess up earlier indices.
  // biome-ignore lint/complexity/noForEach: <explanation>
  largeFunctions
    .sort((a, b) => b.startPos - a.startPos)
    .forEach((fn) => {
      // Very naive approach: break the function body in half and create a helper function.
      // In the future, logic may require AST transformations with reprinting, ts-morph, or codegen, etc.
      const bodyText = sourceCode.slice(fn.startPos, fn.endPos);
      const midIndex = Math.floor(bodyText.length / 2);

      // Insert a simple "helper function" in the middle.
      // A future approach may figure out statements boundaries, variable scoping, etc.
      const helperFunctionName = `${fn.name}HelperAutoGen`;
      const replacementText = `{\n  // Original function was split automatically
  ${bodyText.slice(0, midIndex)}
}

function ${helperFunctionName}() {
  // auto-generated second half
  ${bodyText.slice(midIndex)}
`;

      // Replace the old function body with the new text
      newSource = newSource.slice(0, fn.startPos) + replacementText + newSource.slice(fn.endPos);
    });

  // Overwrite the file with our naive splits
  fs.writeFileSync(filePath, newSource, "utf8");
}
