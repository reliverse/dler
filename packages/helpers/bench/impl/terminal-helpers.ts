import { getCurrentWorkingDirectory, handleError } from "../../src/impl/terminal-helpers";
import type { BenchmarkResult } from "../perf";

// Mock error objects
const createMockError = (message: string): Error => {
  return new Error(message);
};

const createMockNonError = (): { message: string } => {
  return { message: "Unknown error" };
};

export async function benchmarkTerminalHelpers(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number
  ) => Promise<BenchmarkResult>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark getCurrentWorkingDirectory (with cache)
  results.push(
    await benchmark("getCurrentWorkingDirectory (cached)", () => {
      getCurrentWorkingDirectory(true);
    })
  );

  // Benchmark getCurrentWorkingDirectory (without cache)
  results.push(
    await benchmark("getCurrentWorkingDirectory (uncached)", () => {
      getCurrentWorkingDirectory(false);
    })
  );

  // Benchmark handleError with Error instance
  const errorInstance = createMockError("Test error");
  results.push(
    await benchmark("handleError (Error instance)", () => {
      handleError(errorInstance);
    })
  );

  // Benchmark handleError with non-Error
  const nonError = createMockNonError();
  results.push(
    await benchmark("handleError (non-Error)", () => {
      handleError(nonError);
    })
  );

  // Benchmark handleError with string
  results.push(
    await benchmark("handleError (string)", () => {
      handleError("String error");
    })
  );

  // Benchmark handleError with null/undefined
  results.push(
    await benchmark("handleError (null)", () => {
      handleError(null);
    })
  );

  // Benchmark combined operations
  results.push(
    await benchmark("terminal helpers (combined)", () => {
      getCurrentWorkingDirectory(true);
      handleError(errorInstance);
      handleError("String error");
      getCurrentWorkingDirectory(false);
    })
  );

  return results;
}
