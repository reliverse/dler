import { relinka } from "@reliverse/relinka";
import { prepareReliverseEnvironment } from "../config/prepare";
import type { CommonArgs } from "../types/mod";
import { showEndPrompt, showStartPrompt } from "./startEndPrompts";

export async function commonStartActions({
  strCwd,
  isCI,
  isDev,
  showRuntimeInfo,
  clearConsole,
  withStartPrompt,
}: CommonArgs & {
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

  if (!process.versions.bun) {
    relinka.warn(
      "Rse CLI is currently optimized for Bun only. Unexpected behavior may occur with other runtimes.",
    );
    relinka.warn("To avoid issues, it's strongly recommended to install Bun: https://bun.sh/get");
  }

  if (isCI) {
    relinka.warn(
      "To proceed in CI mode, use subcommands and their flags: rse --help OR rse <command> --help",
    );
    process.exit(0);
  }

  await prepareReliverseEnvironment(strCwd, isDev, "ts");
}

export async function commonEndActions({ withEndPrompt }: { withEndPrompt: boolean }) {
  if (withEndPrompt) {
    await showEndPrompt();
  }
  process.exit(0);
}
