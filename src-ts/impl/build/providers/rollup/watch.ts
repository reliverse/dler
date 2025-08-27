import { relative } from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import { watch as _rollupWatch } from "rollup";

import type { RollupOptions } from "~/impl/types/mod";

export function rollupWatch(rollupOptions: RollupOptions): void {
  const transpileWatcher = _rollupWatch(rollupOptions);

  let inputs: string[];
  if (Array.isArray(rollupOptions.input)) {
    inputs = rollupOptions.input;
  } else if (typeof rollupOptions.input === "string") {
    inputs = [rollupOptions.input];
  } else {
    inputs = Object.keys(rollupOptions.input || {});
  }
  relinka(
    "log",
    `[dler] [rollup] Starting watchers for entries: ${inputs.map((input) => `./${relative(process.cwd(), input)}`).join(", ")}`,
  );

  relinka("warn", "[dler] [rollup] Watch mode is experimental and may be unstable");

  transpileWatcher.on("change", (id, { event }) => {
    relinka("verbose", `${relative(".", id)} was ${event}d`);
  });

  transpileWatcher.on("restart", () => {
    relinka("verbose", "[dler] [rollup] Rebuilding bundle");
  });

  transpileWatcher.on("event", (event) => {
    if (event.code === "END") {
      relinka("success", "[dler] [rollup] Rebuild finished\n");
    }
  });
}
