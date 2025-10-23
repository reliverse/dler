
import { defineCmd, defineCmdArgs, defineCmdCfg } from "@reliverse/dler-launcher";

const args = defineCmdArgs({
  verbose: {
    type: "boolean",
    description: "Enable verbose output",
    aliases: ["v"],
  },
  count: {
    type: "number",
    description: "Number of iterations",
    default: 1,
  },
});

const cfg = defineCmdCfg({
  name: "test-command",
  description: "A test command for benchmarking",
  aliases: ["test"],
  examples: ["test-command --verbose", "test-command --count 5"],
});

export default defineCmd(async (args) => {
  console.log("Test command executed with args:", args);
}, args, cfg);
