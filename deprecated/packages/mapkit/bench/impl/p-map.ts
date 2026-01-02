import pMap, { pMapSkip } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

// Helper to create async delay
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Helper to create sync mapper
const syncMapper = (x: number): number => x * 2;

// Helper to create async mapper
const asyncMapper = async (x: number): Promise<number> => {
  await delay(1);
  return x * 2;
};

export async function benchmarkPMap(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const smallArray = Array.from({ length: 10 }, (_, i) => i);
  const mediumArray = Array.from({ length: 100 }, (_, i) => i);
  const largeArray = Array.from({ length: 1000 }, (_, i) => i);

  // Benchmark sync mapper with small array
  results.push(
    await benchmark("pMap (sync, small array)", async () => {
      await pMap(smallArray, syncMapper);
    }),
  );

  // Benchmark sync mapper with medium array
  results.push(
    await benchmark("pMap (sync, medium array)", async () => {
      await pMap(mediumArray, syncMapper);
    }),
  );

  // Benchmark sync mapper with large array
  results.push(
    await benchmark("pMap (sync, large array)", async () => {
      await pMap(largeArray, syncMapper);
    }),
  );

  // Benchmark async mapper with concurrency limit
  results.push(
    await benchmark(
      "pMap (async, concurrency=5)",
      async () => {
        await pMap(mediumArray, asyncMapper, { concurrency: 5 });
      },
      100,
    ),
  );

  // Benchmark async mapper with unlimited concurrency
  results.push(
    await benchmark(
      "pMap (async, unlimited)",
      async () => {
        await pMap(mediumArray, asyncMapper, {
          concurrency: Number.POSITIVE_INFINITY,
        });
      },
      100,
    ),
  );

  // Benchmark with skip functionality
  results.push(
    await benchmark("pMap (with skip)", async () => {
      await pMap(mediumArray, (x) => (x % 2 === 0 ? x * 2 : pMapSkip));
    }),
  );

  // Benchmark with async iterable
  results.push(
    await benchmark("pMap (async iterable)", async () => {
      const asyncIterable = (async function* () {
        for (const item of mediumArray) {
          yield item;
        }
      })();
      await pMap(asyncIterable, syncMapper);
    }),
  );

  // Benchmark with promise values
  results.push(
    await benchmark("pMap (promise values)", async () => {
      const promiseArray = mediumArray.map((x) => Promise.resolve(x));
      await pMap(promiseArray, syncMapper);
    }),
  );

  return results;
}
