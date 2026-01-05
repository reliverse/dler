export { testCommand, testCLI } from "./test-command";
export { expectCommand, createMatchers } from "./matchers";
export {
  mockPromptResponses,
  mockShellCommands,
  mockInteractive,
  mockValidationAttempts,
  mergeTestOptions,
} from "./helpers";
export type {
  TestOptions,
  TestResult,
  MockHandlerArgs,
  MockShell,
  ShellPromise,
  Matchers,
} from "./types";
