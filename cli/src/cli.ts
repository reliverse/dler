// 👉 bun dler <cmd> <args>
// 💡 dler === apps/dler/src/cli.ts

import { runLauncher } from "@reliverse/rempts";

await runLauncher(import.meta.url, { verbose: false });
