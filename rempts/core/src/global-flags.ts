import { type } from "arktype";
import type { CLIOption } from "./types";

/**
 * Built-in global flags available to all commands
 * Enhanced with better descriptions and validation
 */
export const GLOBAL_FLAGS = {
  interactive: {
    schema: type("boolean").configure({
      description: "enable interactive terminal user interface mode",
    }),
    short: "i",
    description: "Run in interactive TUI mode",
  },
  tui: {
    schema: type("boolean").configure({
      description: "force terminal user interface mode",
    }),
    description: "Force TUI mode (same as --interactive)",
  },
  "no-tui": {
    schema: type("boolean").configure({
      description: "disable terminal user interface mode",
    }),
    description: "Disable TUI mode, use CLI handler instead",
  },
  help: {
    schema: type("boolean").configure({
      description: "display help information",
    }),
    short: "h",
    description: "Show help",
  },
  version: {
    schema: type("boolean").configure({
      description: "display version information",
    }),
    short: "v",
    description: "Show version",
  },
} satisfies Record<string, CLIOption>;

export type GlobalFlags = {
  interactive: boolean;
  tui: boolean;
  "no-tui": boolean;
  help: boolean;
  version: boolean;
};
