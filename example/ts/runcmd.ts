// `bun example/callCmd.ts`

// import { callCmd } from "@reliverse/rempts";
// import { default as remptsCmd } from "~/app/rempts/cmd";

async function main() {
  try {
    // Run the command with test arguments
    // await callCmd(remptsCmd, { init: "cmd1 cmd2" });
  } catch (error) {
    console.error("Error running command:", error);
  }
}

await main();
