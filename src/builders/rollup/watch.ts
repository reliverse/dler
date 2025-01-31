import consola from "consola";
import { colors } from "consola/utils";
import { relative } from "pathe";
import { watch as _rollupWatch } from "rollup";

import type { RollupOptions } from "~/types.js";

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
  consola.info(
    `[relidler] [rollup] Starting watchers for entries: ${inputs.map((input) => `./${relative(process.cwd(), input)}`).join(", ")}`,
  );

  consola.warn(
    "[relidler] [rollup] Watch mode is experimental and may be unstable",
  );

  watcher.on("change", (id, { event }) => {
    consola.info(`${colors.cyan(relative(".", id))} was ${event}d`);
  });

  watcher.on("restart", () => {
    consola.info(colors.gray("[relidler] [rollup] Rebuilding bundle"));
  });

  watcher.on("event", (event) => {
    if (event.code === "END") {
      consola.success(colors.green("[relidler] [rollup] Rebuild finished\n"));
    }
  });
}
