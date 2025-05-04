import { relinka } from "@reliverse/relinka";

/**
 * Prints usage examples based on whether dev mode or not.
 */
export function printUsage(isDev?: boolean) {
  relinka("info", "====================");
  relinka("info", "TOOLS USAGE EXAMPLES");
  relinka("info", "====================");
  relinka(
    "info",
    `${isDev ? "bun dev:agg" : "dler tools"} --tool agg --input <dir> --out <file> [options]`,
  );
  if (isDev) {
    relinka(
      "info",
      "bun dev:tools agg --input src/libs/sdk/sdk-impl --out src/libs/sdk/sdk-main.ts --recursive --named --strip src/libs/sdk",
    );
  } else {
    relinka(
      "info",
      "dler tools --tool agg --input src/libs --out aggregator.ts --recursive --named",
    );
  }
}
