export type SpinnerIndicator = "timer" | "dots";

export interface SpinnerOptions {
  text?: string;
  indicator?: SpinnerIndicator;
  frames?: string[];
  delay?: number;
  onCancel?: () => void;
  cancelMessage?: string;
  errorMessage?: string;
  successText?: string;
  failText?: string;
  prefixText?: string;
  color?: string;
  hideCursor?: boolean;
  silent?: boolean;
  signal?: AbortSignal;
}

export interface SpinnerInstance {
  start(): SpinnerInstance;
  stop(): SpinnerInstance;
  succeed(text?: string): SpinnerInstance;
  fail(text?: string): SpinnerInstance;
  updateText(text: string): SpinnerInstance;
}

const DEFAULT_FRAMES = ["◒", "◐", "◓", "◑"];
const DEFAULT_DELAY = 80;

function hideCursor(): void {
  process.stdout.write("\u001B[?25l");
}

function showCursor(): void {
  process.stdout.write("\u001B[?25h");
}

function clearLine(): void {
  process.stdout.write("\r\u001B[K");
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function spinnerPrompt(options: SpinnerOptions = {}): SpinnerInstance {
  return createSpinner(options);
}

export function createSpinner(options: SpinnerOptions = {}): SpinnerInstance {
  const {
    text = "",
    indicator = "dots",
    frames = DEFAULT_FRAMES,
    delay = DEFAULT_DELAY,
    onCancel,
    cancelMessage = "Operation cancelled by user",
    errorMessage = "Operation failed",
    successText,
    failText,
    prefixText,
    hideCursor: shouldHideCursor = true,
    silent = false,
    signal,
  } = options;

  let frameIndex = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let startTime: number | null = null;
  let isRunning = false;
  let currentText = text;

  const render = (): void => {
    if (silent || !isRunning) {
      return;
    }

    clearLine();

    const frame = frames[frameIndex % frames.length];
    let output = `${frame}  ${currentText}`;

    if (indicator === "timer" && startTime !== null) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      output += ` [${formatTime(elapsed)}]`;
    }

    if (prefixText) {
      output = `${prefixText}${output}`;
    }

    process.stdout.write(output);
    frameIndex += 1;
  };

  const start = (): SpinnerInstance => {
    if (isRunning) {
      return spinner;
    }

    isRunning = true;
    startTime = Date.now();

    if (shouldHideCursor && !silent) {
      hideCursor();
    }

    if (signal) {
      signal.addEventListener("abort", () => {
        stop();
        if (onCancel) {
          onCancel();
        }
        if (!silent) {
          clearLine();
          process.stdout.write(`✗  ${cancelMessage}\n`);
        }
      });
    }

    if (!silent) {
      render();
      intervalId = setInterval(() => {
        render();
      }, delay);
    }

    return spinner;
  };

  const stop = (): SpinnerInstance => {
    if (!isRunning) {
      return spinner;
    }

    isRunning = false;

    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }

    if (shouldHideCursor && !silent) {
      showCursor();
    }

    if (!silent) {
      clearLine();
    }

    return spinner;
  };

  const succeed = (customText?: string): SpinnerInstance => {
    stop();
    if (!silent) {
      const displayText = customText ?? successText ?? currentText;
      process.stdout.write(`✓  ${displayText}\n`);
    }
    return spinner;
  };

  const fail = (customText?: string): SpinnerInstance => {
    stop();
    if (!silent) {
      const displayText = customText ?? failText ?? errorMessage;
      process.stdout.write(`✗  ${displayText}\n`);
    }
    return spinner;
  };

  const updateText = (newText: string): SpinnerInstance => {
    currentText = newText;
    if (isRunning && !silent) {
      render();
    }
    return spinner;
  };

  const spinner: SpinnerInstance = {
    start,
    stop,
    succeed,
    fail,
    updateText,
  };

  return spinner;
}
