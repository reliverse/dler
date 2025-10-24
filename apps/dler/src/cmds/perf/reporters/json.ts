// apps/dler/src/cmds/perf/reporters/json.ts

import { writeFileSync } from "node:fs";
import { logger } from "@reliverse/dler-logger";
import type { PerfReport } from "../types";

export class JsonReporter {
  private outputPath?: string;

  constructor(outputPath?: string) {
    this.outputPath = outputPath;
  }

  report(report: PerfReport): void {
    const json = JSON.stringify(report, null, 2);

    if (this.outputPath) {
      try {
        writeFileSync(this.outputPath, json, "utf-8");
        logger.success(`📄 JSON report saved to: ${this.outputPath}`);
      } catch (error) {
        logger.error(`Failed to save JSON report: ${error}`);
      }
    } else {
      console.log(json);
    }
  }

  static save(report: PerfReport, outputPath: string): void {
    const reporter = new JsonReporter(outputPath);
    reporter.report(report);
  }

  static print(report: PerfReport): void {
    const reporter = new JsonReporter();
    reporter.report(report);
  }
}

export const createJsonReporter = (outputPath?: string): JsonReporter => {
  return new JsonReporter(outputPath);
};
