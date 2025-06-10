import ora, { type Ora, type Color, type Options as OraOptions } from "ora";

interface SpinnerOptions {
  text: string;
  color?: Color;
  spinner?: OraOptions["spinner"];
  successText?: string;
  failText?: string;
  prefixText?: string;
  silent?: boolean;
  hideCursor?: boolean;
}

interface ProgressOptions {
  current: number;
  total: number;
  format?: "percentage" | "count" | "both";
}

interface SpinnerControls {
  start: (text?: string) => SpinnerControls;
  stop: () => void;
  setText: (text: string) => void;
  setProgress: (progress: ProgressOptions) => void;
  succeed: (text?: string) => void;
  fail: (text?: string) => void;
  warn: (text?: string) => void;
  info: (text?: string) => void;
  isSpinning: () => boolean;
  clear: () => void;
  getElapsedTime: () => number;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
}

interface SpinnerState {
  isActive: boolean;
  isPaused: boolean;
  startTime: number | null;
  pausedTime: number;
  text: string;
}

/**
 * Detects if the environment supports interactive spinners
 */
function isInteractive(): boolean {
  return (
    process.stdout.isTTY &&
    !process.env.CI &&
    !process.env.GITHUB_ACTIONS &&
    !process.env.GITLAB_CI &&
    !process.env.BUILDKITE &&
    process.env.TERM !== "dumb"
  );
}

/**
 * Formats progress information
 */
function formatProgress(options: ProgressOptions): string {
  const { current, total, format = "both" } = options;
  const percentage = Math.round((current / total) * 100);

  switch (format) {
    case "percentage":
      return `${percentage}%`;
    case "count":
      return `${current}/${total}`;
    case "both":
      return `${current}/${total} (${percentage}%)`;
    default:
      return `${current}/${total}`;
  }
}

/**
 * Creates a terminal spinner with enhanced controls and styling options.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const spinner = useSpinner({ text: "Loading..." }).start();
 * spinner.stop();
 *
 * // With progress tracking
 * const spinner = useSpinner({ text: "Processing files..." }).start();
 * for (let i = 0; i < files.length; i++) {
 *   spinner.setProgress({ current: i + 1, total: files.length });
 *   await processFile(files[i]);
 * }
 * spinner.succeed();
 *
 * // With custom color and spinner
 * const spinner = useSpinner({
 *   text: "Processing...",
 *   color: "cyan",
 *   spinner: "dots"
 * }).start();
 *
 * // With success/failure states
 * const spinner = useSpinner({
 *   text: "Uploading...",
 *   successText: "Upload complete!",
 *   failText: "Upload failed!"
 * }).start();
 * try {
 *   await uploadFile();
 *   spinner.succeed();
 * } catch (error) {
 *   spinner.fail();
 * }
 *
 * // Using the wrapper for async operations
 * await useSpinner.promise(
 *   async (spinner) => {
 *     await longOperation();
 *     spinner.setProgress({ current: 50, total: 100 });
 *   },
 *   {
 *     text: "Working...",
 *     successText: "Done!",
 *     failText: "Failed!"
 *   }
 * );
 * ```
 */
export function useSpinner(options: SpinnerOptions): SpinnerControls {
  let spinnerInstance: Ora | null = null;
  const interactive = isInteractive();

  const state: SpinnerState = {
    isActive: false,
    isPaused: false,
    startTime: null,
    pausedTime: 0,
    text: options.text,
  };

  const controls: SpinnerControls = {
    start: (text?: string) => {
      if (text) {
        options.text = text;
        state.text = text;
      }

      if (options.silent || !interactive) {
        console.log(options.prefixText ? `${options.prefixText} ${options.text}` : options.text);
        state.isActive = true;
        state.startTime = Date.now();
        return controls;
      }

      if (!spinnerInstance) {
        spinnerInstance = ora({
          text: options.text,
          color: options.color,
          spinner: options.spinner,
          hideCursor: options.hideCursor,
          prefixText: options.prefixText,
        });
      } else {
        spinnerInstance.text = options.text;
      }

      spinnerInstance.start();
      state.isActive = true;
      state.startTime = Date.now();
      return controls;
    },

    stop: () => {
      if (spinnerInstance) {
        spinnerInstance.stop();
      }
      state.isActive = false;
    },

    setText: (text: string) => {
      state.text = text;
      if (spinnerInstance && !state.isPaused) {
        spinnerInstance.text = text;
      } else if (options.silent || !interactive) {
        // In non-interactive mode, log the text change
        console.log(options.prefixText ? `${options.prefixText} ${text}` : text);
      }
      options.text = text;
    },

    setProgress: (progress: ProgressOptions) => {
      const progressText = formatProgress(progress);
      const newText = `${state.text} [${progressText}]`;

      if (spinnerInstance && !state.isPaused) {
        spinnerInstance.text = newText;
      } else if (options.silent || !interactive) {
        console.log(options.prefixText ? `${options.prefixText} ${newText}` : newText);
      }
    },

    succeed: (text?: string) => {
      const successText = text ?? options.successText ?? state.text;
      if (spinnerInstance) {
        spinnerInstance.succeed(successText);
      } else {
        console.log(`✓ ${successText}`);
      }
      state.isActive = false;
    },

    fail: (text?: string) => {
      const failText = text ?? options.failText ?? state.text;
      if (spinnerInstance) {
        spinnerInstance.fail(failText);
      } else {
        console.error(`✗ ${failText}`);
      }
      state.isActive = false;
    },

    warn: (text?: string) => {
      const warnText = text ?? state.text;
      if (spinnerInstance) {
        spinnerInstance.warn(warnText);
      } else {
        console.warn(`⚠ ${warnText}`);
      }
    },

    info: (text?: string) => {
      const infoText = text ?? state.text;
      if (spinnerInstance) {
        spinnerInstance.info(infoText);
      } else {
        console.info(`ℹ ${infoText}`);
      }
    },

    isSpinning: () => {
      return state.isActive && !state.isPaused;
    },

    clear: () => {
      if (spinnerInstance) {
        spinnerInstance.clear();
      }
    },

    getElapsedTime: () => {
      if (!state.startTime) return 0;
      const currentTime = Date.now();
      return currentTime - state.startTime - state.pausedTime;
    },

    pause: () => {
      if (state.isActive && !state.isPaused) {
        if (spinnerInstance) {
          spinnerInstance.stop();
        }
        state.isPaused = true;
      }
    },

    resume: () => {
      if (state.isActive && state.isPaused) {
        if (spinnerInstance) {
          spinnerInstance.start();
        }
        state.isPaused = false;
      }
    },

    dispose: () => {
      if (spinnerInstance) {
        spinnerInstance.stop();
        spinnerInstance = null;
      }
      state.isActive = false;
      state.isPaused = false;
    },
  };

  return controls;
}

/**
 * A wrapper for async operations that manages spinner state automatically.
 *
 * @param operation - The async operation to perform (receives spinner controls as parameter)
 * @param options - Spinner options
 * @returns The result of the operation
 */
useSpinner.promise = async <T>(
  operation: (spinner: SpinnerControls) => Promise<T>,
  options: SpinnerOptions,
): Promise<T> => {
  const spinner = useSpinner(options).start();

  try {
    const result = await operation(spinner);
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  } finally {
    spinner.dispose();
  }
};

/**
 * Creates a hierarchical spinner that can manage multiple child operations
 */
useSpinner.nested = (parentOptions: SpinnerOptions) => {
  const parentSpinner = useSpinner({
    ...parentOptions,
    silent: true, // Parent is silent, children will show progress
  });

  return {
    start: () => {
      parentSpinner.start();
      return {
        child: (childOptions: SpinnerOptions) => useSpinner(childOptions),
        finish: (success: boolean, text?: string) => {
          if (success) {
            parentSpinner.succeed(text);
          } else {
            parentSpinner.fail(text);
          }
        },
        dispose: () => parentSpinner.dispose(),
      };
    },
  };
};

/**
 * Utility for measuring operation performance with spinner
 */
useSpinner.withTiming = async <T>(
  operation: (spinner: SpinnerControls) => Promise<T>,
  options: SpinnerOptions,
): Promise<{ result: T; duration: number }> => {
  const spinner = useSpinner(options).start();
  const startTime = Date.now();

  try {
    const result = await operation(spinner);
    const duration = Date.now() - startTime;
    spinner.succeed(`${options.successText || options.text} (${duration}ms)`);
    return { result, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    spinner.fail(`${options.failText || options.text} (failed after ${duration}ms)`);
    throw error;
  } finally {
    spinner.dispose();
  }
};
