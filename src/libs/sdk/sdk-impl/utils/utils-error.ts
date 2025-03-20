import prettyMilliseconds from "pretty-ms";

import { relinka } from "./utils-logs.js";
import { getElapsedPerfTime, type PerfTimer } from "./utils-perf.js";

/**
 * Handles errors during the build process.
 */
export function handleRelidlerError(error: unknown, timer: PerfTimer): never {
  // Calculate elapsed time
  const elapsedTime = getElapsedPerfTime(timer);
  const transpileFormattedTime = prettyMilliseconds(elapsedTime, {
    verbose: true,
  });

  // Log detailed error intranspileFormation
  const errorStack =
    error instanceof Error ? error.stack : "No stack trace available";

  relinka(
    "error",
    `An unexpected error occurred after ${transpileFormattedTime}:`,
    error,
  );
  relinka("commonVerbose", `Error details: ${errorStack}`);

  // Exit with error code
  process.exit(1);
}
