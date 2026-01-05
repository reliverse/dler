// packages/build/src/impl/utils/log-extraction.ts

/**
 * Bun build log entry - matches the structure from Bun.build().logs
 */
interface BunLogEntry {
  level: "error" | "warning" | "info" | "debug" | "verbose";
  message: string;
  position?: {
    file: string;
    line: number;
    column: number;
  } | null;
}

/**
 * Extract error messages from Bun build logs
 */
export function extractErrors(logs: BunLogEntry[]): string[] {
  return logs
    .filter((log) => log.level === "error")
    .map((log) => {
      if (log.position) {
        return `${log.message} (${log.position.file}:${log.position.line}:${log.position.column})`;
      }
      return log.message;
    });
}

/**
 * Extract warning messages from Bun build logs
 */
export function extractWarnings(logs: BunLogEntry[]): string[] {
  return logs
    .filter((log) => log.level === "warning")
    .map((log) => {
      if (log.position) {
        return `${log.message} (${log.position.file}:${log.position.line}:${log.position.column})`;
      }
      return log.message;
    });
}

/**
 * Format all log messages into a single string
 */
export function formatLogMessages(logs: BunLogEntry[]): string {
  return logs
    .map((log) => {
      if (log.position) {
        return `${log.message} (${log.position.file}:${log.position.line}:${log.position.column})`;
      }
      return log.message;
    })
    .join("\n");
}
