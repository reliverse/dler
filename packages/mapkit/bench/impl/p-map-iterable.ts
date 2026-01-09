import { pMapIterable, pMapSkip } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

// Helper to create async delay
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to create sync mapper
const syncMapper = (x: number): number => x * 2;

// Helper to create async mapper
const asyncMapper = async (x: number): Promise<number> => {
  await delay(1);
  return x * 2;
};

export async function benchmarkPMapIterable(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number
  ) => Promise<BenchmarkResult>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const smallArray = Array.from({ length: 10 }, (_, i) => i);
  const mediumArray = Array.from({ length: 100 }, (_, i) => i);
  const largeArray = Array.from({ length: 1000 }, (_, i) => i);

  // Benchmark sync mapper with small array
  results.push(
    await benchmark("pMapIterable (sync, small array)", async () => {
      const iterable = pMapIterable(smallArray, syncMapper);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of iterable) {
        // Consume all items
      }
    })
  );

  // Benchmark sync mapper with medium array
  results.push(
    await benchmark("pMapIterable (sync, medium array)", async () => {
      const iterable = pMapIterable(mediumArray, syncMapper);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of iterable) {
        // Consume all items
      }
    })
  );

  // Benchmark sync mapper with large array
  results.push(
    await benchmark("pMapIterable (sync, large array)", async () => {
      const iterable = pMapIterable(largeArray, syncMapper);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of iterable) {
        // Consume all items
      }
    })
  );

  // Benchmark async mapper with concurrency limit
  results.push(
    await benchmark(
      "pMapIterable (async, concurrency=5)",
      async () => {
        const iterable = pMapIterable(mediumArray, asyncMapper, {
          concurrency: 5,
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of iterable) {
          // Consume all items
        }
      },
      100
    )
  );

  // Benchmark with backpressure
  results.push(
    await benchmark(
      "pMapIterable (backpressure)",
      async () => {
        const iterable = pMapIterable(mediumArray, asyncMapper, {
          concurrency: 10,
          backpressure: 20,
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of iterable) {
          // Consume all items
        }
      },
      100
    )
  );

  // Benchmark with skip functionality
  results.push(
    await benchmark("pMapIterable (with skip)", async () => {
      const iterable = pMapIterable(mediumArray, (x) => (x % 2 === 0 ? x * 2 : pMapSkip));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of iterable) {
        // Consume all items
      }
    })
  );

  // Benchmark with async iterable input
  results.push(
    await benchmark("pMapIterable (async iterable input)", async () => {
      const asyncIterable = (async function* () {
        for (const item of mediumArray) {
          yield item;
        }
      })();
      const iterable = pMapIterable(asyncIterable, syncMapper);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of iterable) {
        // Consume all items
      }
    })
  );

  return results;
}
