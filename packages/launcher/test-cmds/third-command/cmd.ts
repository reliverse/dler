
import { defineCmd, defineCmdArgs, defineCmdCfg } from "@reliverse/dler-launcher";

const args = defineCmdArgs({});

const cfg = defineCmdCfg({
  name: "third-command",
  description: "A simple command with no arguments",
  category: "Utilities",
});

export default defineCmd(async () => {
  console.log("Third command executed");
}, args, cfg);
