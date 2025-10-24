// packages/launcher/src/impl/launcher/errors.ts

export class LauncherError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "LauncherError";
  }
}

export class CommandNotFoundError extends LauncherError {
  constructor(cmdName: string, availableCmds: string[]) {
    super(
      `Command "${cmdName}" not found. Available commands: ${availableCmds.join(", ")}`,
      "CMD_NOT_FOUND",
    );
    this.name = "CommandNotFoundError";
  }
}

export class ArgumentValidationError extends LauncherError {
  constructor(
    public argName: string,
    public reason: string,
  ) {
    super(`Invalid argument "${argName}": ${reason}`, "ARG_VALIDATION_ERROR");
    this.name = "ArgumentValidationError";
  }
}

export class CommandLoadError extends LauncherError {
  constructor(cmdName: string, cause: unknown) {
    super(`Failed to load command "${cmdName}"`, "CMD_LOAD_ERROR");
    this.name = "CommandLoadError";
    this.cause = cause;
  }
}
