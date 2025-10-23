
import { defineCmd, defineCmdArgs, defineCmdCfg } from "@reliverse/dler-launcher";

const args = defineCmdArgs({
  input: {
    type: "string",
    description: "Input file path",
    required: true,
  },
  output: {
    type: "string",
    description: "Output file path",
    aliases: ["o"],
  },
});

const cfg = defineCmdCfg({
  name: "another-command",
  description: "Another test command",
  version: "1.0.0",
});

export default defineCmd(async (args) => {
  console.log("Another command executed with args:", args);
}, args, cfg);
