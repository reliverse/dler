// apps/dler/src/cmds/perf/utils/stats.ts

import type { Statistics } from "../types";

export const calculateStatistics = (values: number[]): Statistics => {
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
      p99: 0,
      variance: 0,
      standardDeviation: 0,
      coefficientOfVariation: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;

  const first = sorted[0];
  const last = sorted[n - 1];
  if (first === undefined || last === undefined) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
      p99: 0,
      variance: 0,
      standardDeviation: 0,
      coefficientOfVariation: 0,
    };
  }

  const min = first;
  const max = last;
  const mean = values.reduce((sum, val) => sum + val, 0) / n;

  const medianValue =
    n % 2 === 0
      ? (() => {
          const lower = sorted[n / 2 - 1];
          const upper = sorted[n / 2];
          if (lower === undefined || upper === undefined) return 0;
          return (lower + upper) / 2;
        })()
      : (() => {
          const mid = sorted[Math.floor(n / 2)];
          return mid ?? 0;
        })();
  const median = medianValue;

  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);

  const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / n;
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = mean === 0 ? 0 : standardDeviation / mean;

  return {
    min,
    max,
    mean,
    median,
    p95,
    p99,
    variance,
    standardDeviation,
    coefficientOfVariation,
  };
};

export const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const first = sorted[0];
  if (sorted.length === 1) return first ?? 0;
  if (first === undefined) return 0;

  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  const lowerValue = sorted[lower];
  if (lowerValue === undefined) return 0;

  if (lower === upper) {
    return lowerValue;
  }

  const upperValue = sorted[upper];
  if (upperValue === undefined) return lowerValue;

  const weight = index - lower;
  return lowerValue * (1 - weight) + upperValue * weight;
};

export const calculateMemoryGrowth = (
  initial: number,
  final: number,
): number => {
  return final - initial;
};

export const calculateMemoryAverage = (measurements: number[]): number => {
  if (measurements.length === 0) return 0;
  return measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
};

export const findPeakMemory = (measurements: number[]): number => {
  return measurements.length === 0 ? 0 : Math.max(...measurements);
};

export const calculateImprovement = (
  baseline: number,
  current: number,
): number => {
  if (baseline === 0) return 0;
  return ((baseline - current) / baseline) * 100;
};

export const calculateRegression = (
  baseline: number,
  current: number,
): number => {
  if (baseline === 0) return 0;
  return ((current - baseline) / baseline) * 100;
};

export const isSignificantChange = (
  baseline: number,
  current: number,
  threshold = 5,
): boolean => {
  const change = Math.abs(calculateImprovement(baseline, current));
  return change >= threshold;
};

export const calculateConfidenceInterval = (
  values: number[],
  confidence = 0.95,
): { lower: number; upper: number } => {
  if (values.length < 2) {
    return { lower: values[0] ?? 0, upper: values[0] ?? 0 };
  }

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
    (values.length - 1);
  const standardError = Math.sqrt(variance / values.length);

  // Using t-distribution approximation for small samples
  const tValue = confidence === 0.95 ? 1.96 : 2.576; // 95% or 99%
  const margin = tValue * standardError;

  return {
    lower: mean - margin,
    upper: mean + margin,
  };
};

export const detectOutliers = (values: number[], threshold = 2): number[] => {
  if (values.length < 3) return [];

  const stats = calculateStatistics(values);
  const outliers: number[] = [];

  for (const value of values) {
    const zScore = Math.abs((value - stats.mean) / stats.standardDeviation);
    if (zScore > threshold) {
      outliers.push(value);
    }
  }

  return outliers;
};

export const removeOutliers = (values: number[], threshold = 2): number[] => {
  const outliers = detectOutliers(values, threshold);
  return values.filter((val) => !outliers.includes(val));
};
