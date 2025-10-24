import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";

const args = defineCmdArgs({
  image: {
    type: "string",
    description: "Docker image to run",
    required: true,
    aliases: ["i"],
  },
  port: {
    type: "string",
    description: "Port mapping (host:container)",
    aliases: ["p"],
  },
  detach: {
    type: "boolean",
    description: "Run container in background",
    aliases: ["d"],
  },
});

const cfg = defineCmdCfg({
  name: "run",
  description: "Run a Docker container",
  examples: [
    "docker run --image nginx",
    "docker run --image nginx --port 80:80",
  ],
});

export default defineCmd(
  async (args, parentArgs) => {
    console.log("Docker run command executed with args:", args);
    console.log("Parent args (inherited):", parentArgs);

    if (parentArgs?.verbose) {
      console.log("Verbose mode enabled from parent command");
    }

    if (parentArgs?.config) {
      console.log(`Using config file: ${parentArgs.config}`);
    }

    console.log(`Running container with image: ${args.image}`);
    if (args.port) {
      console.log(`Port mapping: ${args.port}`);
    }
    if (args.detach) {
      console.log("Running in detached mode");
    }
  },
  args,
  cfg,
);
