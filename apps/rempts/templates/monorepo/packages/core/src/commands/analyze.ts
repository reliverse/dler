import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { logger, formatTable } from "@{{name}}/utils";
import type { AnalyzeResult } from "../types";
import { relico } from "@reliverse/relico";

const analyzeCommand = defineCommand({
  name: "analyze",
  description: "Analyze files and generate reports",
  args: type("string[]", { minLength: 1 }),
  options: {
    detailed: option(type("boolean", "=", false), {
      short: "d",
      description: "Show detailed analysis",
    }),
  },
  handler: async ({ args, flags, colors }) => {
    logger.info("Starting analysis...");

    const results: AnalyzeResult[] = [];

    for (const file of args) {
      try {
        const result = await analyzeFile(file);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to analyze ${file}:`, error);
      }
    }

    // Display results
    console.log();
    console.log(relico.bold("Analysis Results:"));
    console.log();

    const tableData = results.map((r) => ({
      File: r.file,
      Lines: r.metrics.lines,
      Words: r.metrics.words,
      Issues: r.issues.length,
    }));

    console.log(formatTable(tableData));

    if (flags.detailed) {
      console.log();
      console.log(relico.bold("Detailed Issues:"));

      for (const result of results) {
        if (result.issues.length > 0) {
          console.log();
          console.log(relico.underline(result.file));

          for (const issue of result.issues) {
            const icon = issue.type === "error" ? "✗" : issue.type === "warning" ? "⚠" : "ℹ";
            const color =
              issue.type === "error"
                ? relico.red
                : issue.type === "warning"
                  ? relico.yellow
                  : relico.blue;

            console.log(color(`  ${icon} ${issue.line}:${issue.column} ${issue.message}`));
          }
        }
      }
    }
  },
});

async function analyzeFile(file: string): Promise<AnalyzeResult> {
  const content = await Bun.file(file).text();
  const lines = content.split("\n");
  const words = content.split(/\\s+/).filter((w) => w.length > 0);

  return {
    file,
    metrics: {
      lines: lines.length,
      characters: content.length,
      words: words.length,
    },
    issues: [],
  };
}

export default analyzeCommand;
