/**
 * Custom error class for prompt cancellations
 */
export class PromptCancelledError extends Error {
  constructor(message = "Cancelled") {
    super(message);
    this.name = "PromptCancelledError";
  }
}

/**
 * Throws a PromptCancelledError to signal that user cancelled the prompt
 * @param message - Optional custom cancellation message
 */
export function cancel(message = "Cancelled"): never {
  throw new PromptCancelledError(message);
}

/**
 * Checks if an error is a cancellation error from a prompt
 * @param error - The error to check
 * @returns `true` if the error is a cancellation, `false` otherwise
 */
export function isCancel(error: unknown): error is PromptCancelledError {
  return error instanceof PromptCancelledError;
}

/**
 * Exits the process with exit code 0 after logging a cancellation message
 * @param message - The message to log before exiting (default: "Operation cancelled")
 */
export function exitCancelled(message = "Operation cancelled"): never {
  console.log(message);
  process.exit(0);
}

/**
 * Sets up a global handler for unhandled PromptCancelledError
 * This ensures that if a developer doesn't explicitly handle cancellations,
 * the app will exit cleanly instead of crashing.
 *
 * Call this once at the start of your application if you want automatic
 * cancellation handling.
 */
export function setupAutoCancelHandler(): void {
  // Handle unhandled promise rejections (async cancellations)
  process.on("unhandledRejection", (reason) => {
    if (reason instanceof PromptCancelledError) {
      exitCancelled("Operation cancelled");
    }
  });

  // Handle synchronous cancellations (though prompts are async, this is a safety net)
  process.on("uncaughtException", (error) => {
    if (error instanceof PromptCancelledError) {
      exitCancelled("Operation cancelled");
    }
  });
}
