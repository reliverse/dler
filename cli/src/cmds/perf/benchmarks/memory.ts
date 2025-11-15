// apps/dler/src/cmds/perf/benchmarks/memory.ts

import type { MemoryUsage } from "../types";

export interface MemoryProfile {
  timestamp: number;
  memory: MemoryUsage;
  label?: string;
}

export interface MemorySnapshot {
  before: MemoryUsage;
  after: MemoryUsage;
  peak: MemoryUsage;
  growth: number;
  duration: number;
}

export class MemoryProfiler {
  private snapshots: MemoryProfile[] = [];
  private startMemory: MemoryUsage | null = null;
  private peakMemory: MemoryUsage | null = null;

  start(label?: string): void {
    this.startMemory = process.memoryUsage();
    this.peakMemory = { ...this.startMemory };
    this.snapshots.push({
      timestamp: Date.now(),
      memory: this.startMemory,
      label: label ?? "start",
    });
  }

  snapshot(label?: string): void {
    const current = process.memoryUsage();
    this.snapshots.push({
      timestamp: Date.now(),
      memory: current,
      label: label ?? `snapshot-${this.snapshots.length}`,
    });

    // Update peak memory
    if (!this.peakMemory) {
      this.peakMemory = { ...current };
    } else {
      this.peakMemory = {
        rss: Math.max(this.peakMemory.rss, current.rss),
        heapTotal: Math.max(this.peakMemory.heapTotal, current.heapTotal),
        heapUsed: Math.max(this.peakMemory.heapUsed, current.heapUsed),
        external: Math.max(this.peakMemory.external, current.external),
        arrayBuffers: Math.max(
          this.peakMemory.arrayBuffers,
          current.arrayBuffers,
        ),
      };
    }
  }

  stop(): MemorySnapshot | null {
    if (!this.startMemory) {
      return null;
    }

    const endMemory = process.memoryUsage();
    const duration =
      this.snapshots.length > 0
        ? this.snapshots[this.snapshots.length - 1]!.timestamp -
          this.snapshots[0]!.timestamp
        : 0;

    const snapshot: MemorySnapshot = {
      before: this.startMemory,
      after: endMemory,
      peak: this.peakMemory ?? endMemory,
      growth: endMemory.rss - this.startMemory.rss,
      duration,
    };

    // Reset state
    this.startMemory = null;
    this.peakMemory = null;
    this.snapshots = [];

    return snapshot;
  }

  getSnapshots(): MemoryProfile[] {
    return [...this.snapshots];
  }

  getMemoryGrowth(): number {
    if (this.snapshots.length < 2) return 0;

    const first = this.snapshots[0]!.memory;
    const last = this.snapshots[this.snapshots.length - 1]!.memory;

    return last.rss - first.rss;
  }

  getPeakMemory(): MemoryUsage | null {
    return this.peakMemory;
  }

  getAverageMemory(): MemoryUsage | null {
    if (this.snapshots.length === 0) return null;

    const sum = this.snapshots.reduce(
      (acc, snapshot) => ({
        rss: acc.rss + snapshot.memory.rss,
        heapTotal: acc.heapTotal + snapshot.memory.heapTotal,
        heapUsed: acc.heapUsed + snapshot.memory.heapUsed,
        external: acc.external + snapshot.memory.external,
        arrayBuffers: acc.arrayBuffers + snapshot.memory.arrayBuffers,
      }),
      { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 },
    );

    const count = this.snapshots.length;
    return {
      rss: sum.rss / count,
      heapTotal: sum.heapTotal / count,
      heapUsed: sum.heapUsed / count,
      external: sum.external / count,
      arrayBuffers: sum.arrayBuffers / count,
    };
  }
}

export const createMemoryProfiler = (): MemoryProfiler => {
  return new MemoryProfiler();
};

export const measureMemoryUsage = (
  fn: () => void | Promise<void>,
): Promise<MemorySnapshot> => {
  return new Promise((resolve) => {
    const profiler = createMemoryProfiler();
    profiler.start("measurement");

    const executeFn = async () => {
      try {
        await fn();
      } finally {
        const snapshot = profiler.stop();
        resolve(snapshot!);
      }
    };

    executeFn();
  });
};

export const getCurrentMemoryUsage = (): MemoryUsage => {
  return process.memoryUsage();
};

export const getMemoryInfo = (): {
  total: number;
  free: number;
  used: number;
  percentage: number;
} => {
  const usage = process.memoryUsage();

  const total = usage.rss * 4; // Rough estimate
  const used = usage.rss;
  const free = total - used;
  const percentage = (used / total) * 100;

  return {
    total,
    free,
    used,
    percentage: Math.min(percentage, 100),
  };
};

export const formatMemoryUsage = (usage: MemoryUsage): string => {
  const format = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return `RSS: ${format(usage.rss)}, Heap: ${format(usage.heapUsed)}/${format(usage.heapTotal)}, External: ${format(usage.external)}`;
};

export const detectMemoryLeaks = (
  snapshots: MemoryProfile[],
): {
  hasLeak: boolean;
  severity: "low" | "medium" | "high";
  growthRate: number;
  suggestion: string;
} => {
  if (snapshots.length < 3) {
    return {
      hasLeak: false,
      severity: "low",
      growthRate: 0,
      suggestion: "Need more snapshots to detect leaks",
    };
  }

  const rssValues = snapshots.map((s) => s.memory.rss);
  const growthRate =
    (rssValues[rssValues.length - 1]! - rssValues[0]!) / snapshots.length;

  // Simple heuristic: if memory grows consistently, it might be a leak
  const isConsistentGrowth = rssValues.every(
    (val, i) => i === 0 || val >= rssValues[i - 1]! * 0.95,
  );

  const hasLeak = isConsistentGrowth && growthRate > 1024 * 1024; // 1MB per snapshot

  let severity: "low" | "medium" | "high" = "low";
  let suggestion = "";

  if (hasLeak) {
    if (growthRate > 10 * 1024 * 1024) {
      // 10MB per snapshot
      severity = "high";
      suggestion =
        "Critical memory leak detected. Check for unclosed resources, event listeners, or circular references.";
    } else if (growthRate > 5 * 1024 * 1024) {
      // 5MB per snapshot
      severity = "medium";
      suggestion =
        "Moderate memory leak detected. Monitor memory usage and consider garbage collection.";
    } else {
      severity = "low";
      suggestion =
        "Minor memory growth detected. Monitor for patterns over time.";
    }
  } else {
    suggestion = "No significant memory leaks detected.";
  }

  return {
    hasLeak,
    severity,
    growthRate,
    suggestion,
  };
};
