import { relinka } from "@reliverse/relinka";
import prettyMilliseconds from "pretty-ms";

import type { PerfTimer } from "~/libs/sdk/sdk-types";

import { getElapsedPerfTime } from "./utils-perf";

/**
 * Handles errors during the build process.
 */
export function handleDlerError(error: unknown, timer: PerfTimer): never {
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
  relinka("verbose", `Error details: ${errorStack}`);

  // Exit with error code
  process.exit(1);
}
