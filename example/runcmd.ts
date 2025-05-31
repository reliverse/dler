// `bun example/runcmd.ts`

import { runCmd } from "@reliverse/rempts";

import { getRemptsCmd } from "~/app/cmds";

async function main() {
  try {
    // Run the command with test arguments
    await runCmd(await getRemptsCmd(), ["--init=cmd1 cmd2"]);
  } catch (error) {
    console.error("Error running command:", error);
  }
}

await main();
