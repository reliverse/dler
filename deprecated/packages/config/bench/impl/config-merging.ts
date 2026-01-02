import { mergeConfig } from "../../src/impl/core";
import type { BenchmarkResult } from "../perf";

const cliOptions = {
  enable: true,
  option1: "cli",
  option2: "cli-value",
  nested: {
    prop1: "cli-nested",
  },
};

const configOptions = {
  enable: false,
  option1: "config",
  option3: "config-only",
  nested: {
    prop2: "config-nested",
  },
};

const largeConfig = {
  prop1: "value1",
  prop2: "value2",
  prop3: "value3",
  prop4: "value4",
  prop5: "value5",
  nested: {
    deep1: { value: 1 },
    deep2: { value: 2 },
    deep3: { value: 3 },
  },
};

const largeCliOptions = {
  prop1: "cli1",
  prop6: "cli6",
  prop7: "cli7",
  nested: {
    deep1: { value: 10 },
    deep4: { value: 4 },
  },
};

export async function benchmarkConfigMerging(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark basic merging
  results.push(
    await benchmark("mergeConfig (basic)", () => {
      mergeConfig(cliOptions, configOptions);
    }),
  );

  // Benchmark null config
  results.push(
    await benchmark("mergeConfig (null config)", () => {
      mergeConfig(cliOptions, undefined);
    }),
  );

  // Benchmark large configs
  results.push(
    await benchmark("mergeConfig (large configs)", () => {
      mergeConfig(largeCliOptions, largeConfig);
    }),
  );

  // Benchmark empty config
  results.push(
    await benchmark("mergeConfig (empty config)", () => {
      mergeConfig(cliOptions, {});
    }),
  );

  return results;
}
