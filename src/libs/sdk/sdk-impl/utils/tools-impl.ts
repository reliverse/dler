import { relinka } from "@reliverse/relinka";

/**
 * Prints usage examples based on whether dev mode or not.
 */
export function printUsage(isDev?: boolean) {
  relinka("log", "====================");
  relinka("log", "TOOLS USAGE EXAMPLES");
  relinka("log", "====================");
  relinka(
    "log",
    `${isDev ? "bun dev:agg" : "dler tools"} --tool agg --input <dir> --out <file> [options]`,
  );
  if (isDev) {
    relinka(
      "log",
      "bun dev:tools agg --input src/libs/sdk/sdk-impl --out src/libs/sdk/sdk-mod.ts --recursive --named --strip src/libs/sdk",
    );
  } else {
    relinka(
      "log",
      "dler tools --tool agg --input src/libs --out aggregator.ts --recursive --named",
    );
  }
}
