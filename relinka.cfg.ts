import { defineConfig, LogLevel } from "./src/utils.js";

/**
 * Relinka Logger Configuration
 *
 * This configuration can also be set using environment variables:
 * - RELINKA_TIMESTAMP: Whether to include timestamps in logs (true/false)
 * - RELINKA_SAVE_LOGS: Whether to save logs to a file (true/false)
 * - RELINKA_LOGFILE: Path to the log file
 * - RELINKA_LOG_LEVEL: Minimum log level to display (VERBOSE, INFO, SUCCESS, WARN, ERROR, NONE)
 * - RELINKA_DEBUG: Whether to enable verbose logging (true/false)
 * - RELINKA_LOG_DIR: Directory to store log files
 * - RELINKA_DAILY_LOGS: Whether to create separate log files for each day (true/false)
 * - RELINKA_MAX_LOG_FILES: Maximum number of log files to keep (0 = unlimited)
 * - RELINKA_USE_PARENT_CONFIG: Whether to look for config in parent directory when in dist folders (true/false)
 *
 * @see https://github.com/reliverse/relinka
 */
export default defineConfig({
  // Whether to include timestamps in logs
  withTimestamp: false,

  // Whether to save logs to a file
  saveLogsToFile: true,

  // Path to the log file (relative to process.cwd())
  logFilePath: "relinka.log",

  // Minimum log level to display
  logLevel: LogLevel.INFO,

  // Whether to enable verbose logging regardless of log level
  debug: false,

  // Directory-specific configuration
  dirs: {
    // Log directory path
    logDir: ".",

    // Whether to create separate log files for each day
    dailyLogs: false,

    // Maximum number of log files to keep (0 = unlimited)
    maxLogFiles: 10,

    // Special directory handling
    specialDirs: {
      // Whether to look for config in parent directory when in dist folders
      useParentConfigInDist: true,

      // List of directory names considered as dist folders
      distDirNames: ["dist-jsr", "dist-npm", "dist-libs", "dist"],
    },
  },
});
