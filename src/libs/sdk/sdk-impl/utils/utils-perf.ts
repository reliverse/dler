// ========================================
// Timer (TODO: Move to a separate repo)
// ========================================

import type { PerfTimer } from "~/libs/sdk/sdk-types";

export function createPerfTimer(): PerfTimer {
  return {
    pausedAt: null,
    pausedDuration: 0,
    startTime: performance.now(),
  };
}

export function getElapsedPerfTime(timer: PerfTimer): number {
  const currentPausedTime =
    timer.pausedAt !== null ? performance.now() - timer.pausedAt : 0;
  return (
    performance.now() -
    timer.startTime -
    timer.pausedDuration -
    currentPausedTime
  );
}

export function pausePerfTimer(timer: PerfTimer): void {
  if (timer.pausedAt === null) {
    timer.pausedAt = performance.now();
  }
}

export function resumePerfTimer(timer: PerfTimer): void {
  if (timer.pausedAt !== null) {
    timer.pausedDuration += performance.now() - timer.pausedAt;
    timer.pausedAt = null;
  }
}
