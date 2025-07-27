import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";

import { collectFiles, generateAggregatorLines } from "./agg-3";

const AGGREGATOR_START = "// AUTO-GENERATED AGGREGATOR START (via `dler agg`)";
const AGGREGATOR_END = "// AUTO-GENERATED AGGREGATOR END";

/**
 * Aggregator supporting:
 * - --import or default export,
 * - star or named exports,
 * - separate "type" vs "value" for both import and export.
 *
 * Options:
 * - Option to ignore specific directories (default: node_modules, .git)
 * - Option to sort aggregated lines alphabetically.
 * - Option to add a header comment in the aggregator output.
 * - Option to enable verbose logging.
 * - Deduplicates overloaded export names.
 * - Skips files whose basenames start with an internal marker (default: "#")
 *   unless includeInternal is true or an alternative marker is provided.
 * - By default, updates only the auto-generated block in the aggregator file,
 *   leaving any other content intact. Pass `overrideFile: true` to rewrite the entire file.
 */
export async function useAggregator({
  inputDir,
  isRecursive,
  outFile,
  stripPrefix,
  useImport,
  useNamed,
  ignoreDirs = ["node_modules", ".git"],
  sortLines = false,
  headerComment = "",
  verbose = false,
  includeInternal = false,
  internalMarker = "#",
  overrideFile = false,
  fileExtensions = [".ts", ".js", ".mts", ".cts", ".mjs", ".cjs"],
  separateTypesFile = false,
  typesOutFile,
}: {
  inputDir: string;
  isRecursive: boolean;
  outFile: string;
  stripPrefix: string;
  useImport: boolean;
  useNamed: boolean;
  ignoreDirs?: string[];
  sortLines?: boolean;
  headerComment?: string;
  verbose?: boolean;
  includeInternal?: boolean;
  internalMarker?: string;
  overrideFile?: boolean;
  fileExtensions?: string[];
  separateTypesFile?: boolean;
  typesOutFile?: string;
}) {
  try {
    // Validate input directory
    const st = await fs.stat(inputDir).catch(() => null);
    if (!st?.isDirectory()) {
      relinka("error", `Error: --input is not a valid directory: ${inputDir}`);
      process.exit(1);
    }

    // Validate output file directory exists or can be created
    const outDir = path.dirname(outFile);
    try {
      await fs.ensureDir(outDir);
    } catch (error) {
      relinka("error", `Error: Cannot create output directory: ${outDir}\n${error}`);
      process.exit(1);
    }

    // Validate types output file directory if separateTypesFile is true
    if (separateTypesFile && typesOutFile) {
      const typesOutDir = path.dirname(typesOutFile);
      try {
        await fs.ensureDir(typesOutDir);
      } catch (error) {
        relinka("error", `Error: Cannot create types output directory: ${typesOutDir}\n${error}`);
        process.exit(1);
      }
    }

    // Validate output file extension matches input extensions
    const outExt = path.extname(outFile).toLowerCase();
    if (!fileExtensions.includes(outExt)) {
      relinka(
        "warn",
        `Warning: Output file extension (${outExt}) doesn't match any of the input extensions: ${fileExtensions.join(", ")}`,
      );
    }

    // Validate strip prefix is a valid directory if provided
    if (stripPrefix) {
      const stripSt = await fs.stat(stripPrefix).catch(() => null);
      if (!stripSt?.isDirectory()) {
        relinka("error", `Error: --strip is not a valid directory: ${stripPrefix}`);
        process.exit(1);
      }
    }

    // Collect files with specified extensions
    if (verbose)
      relinka(
        "log",
        `Scanning directory ${inputDir} for files with extensions: ${fileExtensions.join(", ")}`,
      );
    const filePaths = await collectFiles(
      inputDir,
      fileExtensions,
      isRecursive,
      ignoreDirs,
      verbose,
      includeInternal,
      internalMarker,
      outFile,
    );
    if (!filePaths.length) {
      relinka(
        "warn",
        `No matching files found in ${inputDir} with extensions: ${fileExtensions.join(", ")}`,
      );
      if (!overrideFile) {
        relinka("warn", "No changes will be made to the output file.");
        return;
      }
    }

    // Generate aggregator lines concurrently with unique star-import identifiers
    const usedIdentifiers = new Set<string>();
    const aggregatorLinesArrays = await Promise.all(
      filePaths.map((fp) =>
        generateAggregatorLines(
          fp,
          inputDir,
          stripPrefix,
          useImport,
          useNamed,
          usedIdentifiers,
        ).catch((error) => {
          relinka("error", `Error processing file ${fp}: ${error}`);
          return [];
        }),
      ),
    );

    // Separate type and value lines
    const allLines = aggregatorLinesArrays.flat();
    const typeLines: string[] = [];
    const valueLines: string[] = [];

    for (const line of allLines) {
      if (line.includes("type {")) {
        typeLines.push(line);
      } else {
        valueLines.push(line);
      }
    }

    // Optionally sort lines alphabetically
    if (sortLines) {
      typeLines.sort();
      valueLines.sort();
      if (verbose) relinka("log", "Sorted aggregator lines alphabetically.");
    }

    // Build the aggregator block content
    const buildAggregatorBlock = (lines: string[]) =>
      `${headerComment ? `${headerComment}\n` : ""}${AGGREGATOR_START}\n${lines.join("\n")}\n${AGGREGATOR_END}\n`;

    if (separateTypesFile && typesOutFile) {
      // Write type exports to separate file
      const typeBlock = buildAggregatorBlock(typeLines);
      await fs.ensureFile(typesOutFile);
      await fs.writeFile(typesOutFile, typeBlock, "utf8");

      // Write value exports to main file, including type file import
      const valueBlock = buildAggregatorBlock([
        ...valueLines,
        `export * from "${path.relative(path.dirname(outFile), typesOutFile).replace(/\\/g, "/")}";`,
      ]);
      await fs.ensureFile(outFile);
      await fs.writeFile(outFile, valueBlock, "utf8");

      relinka(
        "success",
        `Aggregator done: processed ${typeLines.length} type lines in: ${typesOutFile} and ${valueLines.length} value lines in: ${outFile}`,
      );
    } else {
      // Write all lines to single file
      const aggregatorBlock = buildAggregatorBlock(allLines);
      await fs.ensureFile(outFile);
      await fs.writeFile(outFile, aggregatorBlock, "utf8");

      relinka("success", `Aggregator done: processed ${allLines.length} lines in: ${outFile}`);
    }
  } catch (error) {
    relinka("error", `Aggregator failed: ${error}`);
    process.exit(1);
  }
}
