import pMap, { pMapIterable, pMapSkip } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

// Helper to create async delay
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function benchmarkEdgeCases(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number
  ) => Promise<BenchmarkResult>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const array = Array.from({ length: 50 }, (_, i) => i);

  // Benchmark empty array
  results.push(
    await benchmark("pMap (empty array)", async () => {
      await pMap([], (x) => x);
    })
  );

  // Benchmark single item
  results.push(
    await benchmark("pMap (single item)", async () => {
      await pMap([1], (x) => x * 2);
    })
  );

  // Benchmark concurrency=1 (sequential)
  results.push(
    await benchmark(
      "pMap (concurrency=1)",
      async () => {
        await pMap(
          array,
          async (x) => {
            await delay(1);
            return x * 2;
          },
          { concurrency: 1 }
        );
      },
      50
    )
  );

  // Benchmark all items skipped
  results.push(
    await benchmark("pMap (all skipped)", async () => {
      await pMap(array, () => pMapSkip);
    })
  );

  // Benchmark stopOnError=false
  results.push(
    await benchmark("pMap (stopOnError=false)", async () => {
      await pMap(
        array,
        async (x) => {
          if (x === 10) {
            throw new Error("test error");
          }
          return x * 2;
        },
        { stopOnError: false }
      ).catch(() => {
        // Expected to reject
      });
    })
  );

  // Benchmark with AbortSignal (aborted immediately)
  results.push(
    await benchmark("pMap (aborted)", async () => {
      const controller = new AbortController();
      controller.abort();
      await pMap(array, (x) => x * 2, { signal: controller.signal }).catch(() => {
        // Expected to reject
      });
    })
  );

  // Benchmark pMapIterable with early termination
  results.push(
    await benchmark("pMapIterable (early termination)", async () => {
      const iterable = pMapIterable(array, (x) => x * 2);
      let count = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of iterable) {
        count++;
        if (count >= 10) {
          break;
        }
      }
    })
  );

  return results;
}
