import { re } from "@reliverse/relico";
import fs from "fs-extra";
import path from "pathe";

// ========================================
// Logger (TODO: Move to a separate repo)
// ========================================

/**
 * Logger configuration options
 */
type RelinkaConfig = {
  /** Whether to enable verbose logging */
  debug?: boolean;
  /** Directory-specific configuration */
  dirs?: {
    /** Whether to create separate log files for each day */
    dailyLogs?: boolean;
    /** Log directory path */
    logDir?: string;
    /** Maximum number of log files to keep (0 = unlimited) */
    maxLogFiles?: number;
    /** Special directory handling */
    specialDirs?: {
      /** List of directory names considered as dist folders */
      distDirNames?: string[];
      /** Whether to look for config in parent directory when in dist folders */
      useParentConfigInDist?: boolean;
    };
  };
  /** Whether to disable colors in console output */
  disableColors?: boolean;
  /** Path to the log file (relative to process.cwd()) */
  logFilePath?: string;
  /** Whether to save logs to a file */
  saveLogsToFile?: boolean;
  /** Whether to include timestamps in logs */
  withTimestamp?: boolean;
};

/**
 * Default logger configuration
 */
const DEFAULT_RELINKA_CONFIG: RelinkaConfig = {
  debug: false,
  dirs: {
    dailyLogs: false,
    logDir: ".",
    maxLogFiles: 0,
    specialDirs: {
      distDirNames: ["dist-jsr", "dist-npm", "dist-libs", "dist"],
      useParentConfigInDist: true,
    },
  },
  disableColors: false,
  logFilePath: "relinka.log",
  saveLogsToFile: true,
  withTimestamp: false,
};

/**
 * Define a configuration for relinka
 */
export const defineConfig = (config: Partial<RelinkaConfig> = {}) => {
  return { ...DEFAULT_RELINKA_CONFIG, ...config };
};

/**
 * Current logger configuration
 */
let config: RelinkaConfig = { ...DEFAULT_RELINKA_CONFIG };

/**
 * Load configuration from environment variables
 */
const loadEnvConfig = (): Partial<RelinkaConfig> => {
  const envConfig: Partial<RelinkaConfig> = {
    dirs: {},
  };

  // RELINKA_DEBUG - Whether to enable verbose logging
  if (process.env.RELINKA_DEBUG !== undefined) {
    const value = process.env.RELINKA_DEBUG.toLowerCase().trim();
    envConfig.debug = !["", "0", "false"].includes(value);
  }

  // RELINKA_TIMESTAMP - Whether to include timestamps in logs
  if (process.env.RELINKA_TIMESTAMP !== undefined) {
    const value = process.env.RELINKA_TIMESTAMP.toLowerCase().trim();
    envConfig.withTimestamp = !["", "0", "false"].includes(value);
  }

  // RELINKA_DISABLE_COLORS - Whether to disable colors in console output
  if (process.env.RELINKA_DISABLE_COLORS !== undefined) {
    const value = process.env.RELINKA_DISABLE_COLORS.toLowerCase().trim();
    envConfig.disableColors = !["", "0", "false"].includes(value);
  }

  // RELINKA_SAVE_LOGS - Whether to save logs to a file
  if (process.env.RELINKA_SAVE_LOGS !== undefined) {
    const value = process.env.RELINKA_SAVE_LOGS.toLowerCase().trim();
    envConfig.saveLogsToFile = !["", "0", "false"].includes(value);
  }

  // RELINKA_LOG_FILE - Path to the log file
  if (process.env.RELINKA_LOG_FILE) {
    envConfig.logFilePath = process.env.RELINKA_LOG_FILE;
  }

  // RELINKA_LOG_DIR - Directory to store log files
  if (process.env.RELINKA_LOG_DIR) {
    envConfig.dirs!.logDir = process.env.RELINKA_LOG_DIR;
  }

  // RELINKA_DAILY_LOGS - Whether to create separate log files for each day
  if (process.env.RELINKA_DAILY_LOGS !== undefined) {
    const value = process.env.RELINKA_DAILY_LOGS.toLowerCase().trim();
    envConfig.dirs!.dailyLogs = !["", "0", "false"].includes(value);
  }

  // RELINKA_MAX_LOG_FILES - Maximum number of log files to keep
  if (process.env.RELINKA_MAX_LOG_FILES) {
    const value = Number.parseInt(process.env.RELINKA_MAX_LOG_FILES, 10);
    if (!Number.isNaN(value)) {
      envConfig.dirs!.maxLogFiles = value;
    }
  }

  // RELINKA_USE_PARENT_CONFIG - Whether to look for config in parent directory when in dist folders
  if (process.env.RELINKA_USE_PARENT_CONFIG !== undefined) {
    const value = process.env.RELINKA_USE_PARENT_CONFIG.toLowerCase().trim();
    if (!envConfig.dirs!.specialDirs) {
      envConfig.dirs!.specialDirs = {};
    }
    envConfig.dirs!.specialDirs.useParentConfigInDist = ![
      "",
      "0",
      "false",
    ].includes(value);
  }

  return envConfig;
};

/**
 * Check if current directory is a dist directory
 */
const isInDistDir = (): boolean => {
  const currentDir = path.basename(process.cwd());
  return config.dirs?.specialDirs?.distDirNames?.includes(currentDir) || false;
};

/**
 * Get possible config file paths to try
 */
const getConfigPaths = (): string[] => {
  const paths: string[] = [];
  const currentDir = process.cwd();

  // Add current directory config path
  paths.push(path.join(currentDir, "relinka.cfg.ts"));
  paths.push(path.join(currentDir, "relinka.cfg.js"));

  // If in dist directory and useParentConfigInDist is enabled, add parent directory config path
  if (isInDistDir() && config.dirs?.specialDirs?.useParentConfigInDist) {
    const parentDir = path.dirname(currentDir);
    paths.push(path.join(parentDir, "relinka.cfg.ts"));
    paths.push(path.join(parentDir, "relinka.cfg.js"));
  }

  return paths;
};

/**
 * Load configuration from relinka.cfg.ts if it exists
 */
const loadRelinkaConfigFile = async (): Promise<void> => {
  try {
    // First load environment variables
    const envConfig = loadEnvConfig();

    // Apply environment config
    config = { ...config, ...envConfig };

    // Get possible config file paths
    const configPaths = getConfigPaths();

    // Try each config path
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          // For ESM imports in TypeScript
          const configModule = await import(
            /* @vite-ignore */ `file://${configPath}`
          );
          const userConfig = configModule.default;

          if (userConfig) {
            // Config file overrides environment variables
            config = { ...config, ...userConfig };
            break; // Stop after first successful config load
          }
        } catch (importErr) {
          console.error(
            `Failed to import ${configPath}: ${importErr instanceof Error ? importErr.message : String(importErr)}`,
          );
        }
      }
    }
  } catch (err) {
    console.error(
      `Failed to load relinka config: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

// Try to load config file immediately
loadRelinkaConfigFile().catch((err) => {
  console.error(
    `Failed to initialize relinka config: ${err instanceof Error ? err.message : String(err)}`,
  );
});

/**
 * Configure the logger
 */
const configureLogger = (newConfig: Partial<RelinkaConfig>): void => {
  config = { ...config, ...newConfig };
};

/**
 * Reset logger to default configuration
 */
const resetConfig = (): void => {
  config = { ...DEFAULT_RELINKA_CONFIG };
};

/**
 * Get transpileFormatted timestamp based on configuration
 */
const getTimestamp = (): string => {
  if (!config.withTimestamp) return "";

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
};

/**
 * Get the full path to the log file
 */
const getLogFilePath = (): string => {
  // Use config value or default
  let logFilePath = config.logFilePath || DEFAULT_RELINKA_CONFIG.logFilePath!;

  // If daily logs are enabled, add date to filename
  if (config.dirs?.dailyLogs) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    // Add date prefix to filename
    const datePrefix = `${year}-${month}-${day}-`;
    const fileName = path.basename(logFilePath);
    const dirName = path.dirname(logFilePath);

    logFilePath = path.join(dirName, datePrefix + fileName);
  }

  // If log directory is specified, use it
  if (config.dirs?.logDir) {
    const fileName = path.basename(logFilePath);
    logFilePath = path.join(config.dirs.logDir, fileName);
  }

  return path.join(process.cwd(), logFilePath);
};

/**
 * Clean up old log files if maxLogFiles is set
 */
const cleanupOldLogFiles = (): void => {
  if (
    !config.saveLogsToFile ||
    !config.dirs?.maxLogFiles ||
    config.dirs.maxLogFiles <= 0
  ) {
    return;
  }

  try {
    const logDir = config.dirs.logDir
      ? path.join(process.cwd(), config.dirs.logDir)
      : path.dirname(getLogFilePath());

    // Ensure directory exists
    if (!fs.existsSync(logDir)) {
      return;
    }

    // Get all log files
    const files = fs
      .readdirSync(logDir)
      .filter((file) => file.endsWith(".log"))
      .map((file) => ({
        name: file,
        path: path.join(logDir, file),
        stats: fs.statSync(path.join(logDir, file)),
      }))
      .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()); // Sort by modification time, newest first

    // Delete old files if we have more than maxLogFiles
    if (files.length > config.dirs.maxLogFiles) {
      const filesToDelete = files.slice(config.dirs.maxLogFiles);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch (err) {
    console.error(
      `Failed to clean up old log files: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

/**
 * Write a message to the log file
 */
const writeToLogFile = (logMessage: string): void => {
  if (!config.saveLogsToFile) return;

  try {
    const logFilePath = getLogFilePath();
    fs.ensureDirSync(path.dirname(logFilePath));
    fs.appendFileSync(logFilePath, `${logMessage}\n`);

    // Clean up old log files if needed
    cleanupOldLogFiles();
  } catch (err) {
    console.error(
      `Failed to write to log file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

/**
 * Format a log message with timestamp and emoji
 */
const transpileFormatLogMessage = (
  level: string,
  msg: string,
  details?: unknown,
): string => {
  const timestamp = getTimestamp();
  const detailsStr = details
    ? ` ${details instanceof Error ? details.message : String(details)}`
    : "";

  // Pad the log level to ensure consistent spacing
  const paddedLevel = level.padEnd(7, " ");

  return timestamp
    ? `[${timestamp}]  ${paddedLevel} ${msg}${detailsStr}`
    : `${paddedLevel} ${msg}${detailsStr}`;
};

/**
 * Check if verbose logging should be enabled
 */
const isVerboseEnabled = (): boolean => {
  // Check config.debug (already includes environment variable check)
  return config.debug === true;
};

/**
 * Unified logging function
 *
 * @param level - Log type ('verbose', 'info', 'success', 'warn', 'error')
 * @param message - Main message to log
 * @param args - Additional arguments to include in the log
 */
export const relinka = (
  type: "error" | "info" | "success" | "verbose" | "warn",
  message: string,
  ...args: any[]
): void => {
  // If message is empty, just print a blank line
  if (message === "") {
    console.log();
    return;
  }

  // Convert level to uppercase for consistency
  const upperType = type.toUpperCase();

  // Skip verbose logs unless debug is enabled
  if (upperType === "VERBOSE" && !isVerboseEnabled()) {
    return;
  }

  // Format the log message
  const details = args.length > 0 ? args.join(" ") : undefined;
  const displayType = upperType === "VERBOSE" ? "DEBUG" : (upperType as string);
  const logMessage = transpileFormatLogMessage(displayType, message, details);

  // Check if colors should be disabled
  const useColors = !config.disableColors;

  // Output to console with appropriate color
  switch (upperType) {
    case "ERROR":
      console.error(useColors ? re.redBright(logMessage) : logMessage);
      break;
    case "INFO":
      console.log(useColors ? re.cyanBright(logMessage) : logMessage);
      break;
    case "SUCCESS":
      console.log(useColors ? re.greenBright(logMessage) : logMessage);
      break;
    case "VERBOSE":
      console.log(useColors ? re.dim(logMessage) : logMessage);
      break;
    case "WARN":
      console.warn(useColors ? re.yellowBright(logMessage) : logMessage);
      break;
    default:
      console.log(logMessage);
  }

  // Write to log file
  writeToLogFile(logMessage);
};

// Attach configuration methods to relinka
relinka.configure = configureLogger;
relinka.resetConfig = resetConfig;
relinka.defineConfig = defineConfig;
