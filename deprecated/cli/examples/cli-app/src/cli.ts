import { runLauncher } from "@reliverse/rempts";

await runLauncher(import.meta.url, {
  cmdsDir: "./cmds",
  verbose: false,
});
