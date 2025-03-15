import { re } from "@reliverse/relico";
import { relative } from "pathe";
import { watch as _rollupWatch } from "rollup";

import type { RollupOptions } from "~/libs/sdk/sdk-utils/types.js";

import { relinka } from "~/utils.js";

export function rollupWatch(rollupOptions: RollupOptions): void {
  const watcher = _rollupWatch(rollupOptions);

  let inputs: string[];
  if (Array.isArray(rollupOptions.input)) {
    inputs = rollupOptions.input;
  } else if (typeof rollupOptions.input === "string") {
    inputs = [rollupOptions.input];
  } else {
    inputs = Object.keys(rollupOptions.input || {});
  }
  relinka(
    "info",
    `[relidler] [rollup] Starting watchers for entries: ${inputs.map((input) => `./${relative(process.cwd(), input)}`).join(", ")}`,
  );

  relinka(
    "warn",
    "[relidler] [rollup] Watch mode is experimental and may be unstable",
  );

  watcher.on("change", (id, { event }) => {
    relinka("info", `${re.cyan(relative(".", id))} was ${event}d`);
  });

  watcher.on("restart", () => {
    relinka("info", re.gray("[relidler] [rollup] Rebuilding bundle"));
  });

  watcher.on("event", (event) => {
    if (event.code === "END") {
      relinka("success", "[relidler] [rollup] Rebuild finished\n");
    }
  });
}
