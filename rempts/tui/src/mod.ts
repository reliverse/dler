// Export TUI renderer registration

// Re-export useful OpenTUI core types and utilities
export type { CliRendererConfig, KeyEvent, SelectOption } from "@opentui/core";
// Re-export text styling utilities
export { bold, fg, italic, TextAttributes, t } from "@opentui/core";

// Re-export useful OpenTUI React hooks and types
export {
  useKeyboard,
  useOnResize,
  useRenderer,
  useTerminalDimensions,
  useTimeline,
} from "@opentui/react";
// Export component library
export * from "./components/mod";
export { registerTuiRenderer } from "./renderer";
