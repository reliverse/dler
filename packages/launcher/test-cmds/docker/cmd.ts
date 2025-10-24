import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";

const args = defineCmdArgs({
  verbose: {
    type: "boolean",
    description: "Enable verbose output",
    aliases: ["v"],
  },
  config: {
    type: "string",
    description: "Path to config file",
    aliases: ["c"],
  },
});

const cfg = defineCmdCfg({
  name: "docker",
  description: "Docker container management",
  aliases: ["dk"],
  examples: ["docker run --image nginx", "docker build --tag myapp"],
});

export default defineCmd(
  async (args) => {
    console.log("Docker parent command executed with args:", args);
    console.log("Available sub-commands: run, build");
  },
  args,
  cfg,
);
