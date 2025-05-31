import { runCmd } from "@reliverse/rempts";

import { getCmdRemptsCmd } from "~/app/cmds";

async function main() {
  try {
    // Run the command with test arguments
    await runCmd(await getCmdRemptsCmd(), ["--init=cmd1 cmd2"]);
  } catch (error) {
    console.error("Error running command:", error);
  }
}

await main();
