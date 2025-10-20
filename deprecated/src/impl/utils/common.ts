import { relinka } from "@reliverse/relinka";
import { prepareReliverseEnvironment } from "../config/prepare";
import type { CommonCliArgs } from "../types/mod";
import { showEndPrompt, showStartPrompt } from "./startEndPrompts";

export async function commonStartActions({
  cwdStr,
  isCI,
  isDev,
  showRuntimeInfo,
  clearConsole,
  withStartPrompt,
}: CommonCliArgs & {
  showRuntimeInfo: boolean;
  clearConsole: boolean;
  withStartPrompt: boolean;
}) {
  if (!isCI && withStartPrompt) {
    await showStartPrompt(isDev, showRuntimeInfo, clearConsole);
  }

  if (isDev) {
    relinka.log("Running the CLI in dev mode.");
  }

  await prepareReliverseEnvironment(cwdStr, isDev, "ts");
}

export async function commonEndActions({ withEndPrompt }: { withEndPrompt: boolean }) {
  if (withEndPrompt) {
    await showEndPrompt();
  }
  process.exit(0);
}
