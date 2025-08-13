/**
 * Simple console spinner utility for showing progress when displayBuildPubLogs is false
 */

export class SimpleSpinner {
  private interval?: NodeJS.Timeout;
  private message: string;
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private currentFrame = 0;
  private isSpinning = false;

  constructor(message: string) {
    this.message = message;
  }

  start(): this {
    if (this.isSpinning || !process.stdout.isTTY) {
      return this;
    }

    this.isSpinning = true;

    // Hide cursor
    process.stdout.write("\x1B[?25l");

    this.interval = setInterval(() => {
      const frame = this.frames[this.currentFrame];
      process.stdout.write(`\r${frame} ${this.message}`);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);

    return this;
  }

  stop(finalMessage?: string): this {
    if (!this.isSpinning) {
      return this;
    }

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }

    this.isSpinning = false;

    // Clear current line and show cursor
    process.stdout.write("\r\x1B[K");
    process.stdout.write("\x1B[?25h");

    if (finalMessage) {
      process.stdout.write(`${finalMessage}\n`);
    }

    return this;
  }

  updateMessage(message: string): this {
    this.message = message;
    return this;
  }

  succeed(message?: string): this {
    return this.stop(message ? `✅ ${message}` : `✅ ${this.message}`);
  }

  fail(message?: string): this {
    return this.stop(message ? `❌ ${message}` : `❌ ${this.message}`);
  }
}

export function createSpinner(message: string): SimpleSpinner {
  return new SimpleSpinner(message);
}
