import { relinka } from "@reliverse/relinka";
import { relative } from "pathe";
import { watch as _rollupWatch } from "rollup";

import type { RollupOptions } from "~/libs/sdk/sdk-impl/build/bundlers/unified/types.js";

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
    "info",
    `[relidler] [rollup] Starting watchers for entries: ${inputs.map((input) => `./${relative(process.cwd(), input)}`).join(", ")}`,
  );

  relinka(
    "warn",
    "[relidler] [rollup] Watch mode is experimental and may be unstable",
  );

  transpileWatcher.on("change", (id, { event }) => {
    relinka("info", `${relative(".", id)} was ${event}d`);
  });

  transpileWatcher.on("restart", () => {
    relinka("info", "[relidler] [rollup] Rebuilding bundle");
  });

  transpileWatcher.on("event", (event) => {
    if (event.code === "END") {
      relinka("success", "[relidler] [rollup] Rebuild finished\n");
    }
  });
}
