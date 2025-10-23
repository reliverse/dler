import { defineCmd, defineCmdArgs, defineCmdCfg } from "@reliverse/dler-launcher";

const args = defineCmdArgs({
  tag: {
    type: "string",
    description: "Tag for the built image",
    required: true,
    aliases: ["t"],
  },
  file: {
    type: "string",
    description: "Path to Dockerfile",
    aliases: ["f"],
  },
  context: {
    type: "string",
    description: "Build context path",
    default: ".",
  },
});

const cfg = defineCmdCfg({
  name: "build",
  description: "Build a Docker image",
  examples: ["docker build --tag myapp", "docker build --tag myapp --file Dockerfile.prod"],
});

export default defineCmd(async (args, parentArgs) => {
  console.log("Docker build command executed with args:", args);
  console.log("Parent args (inherited):", parentArgs);
  
  if (parentArgs?.verbose) {
    console.log("Verbose mode enabled from parent command");
  }
  
  if (parentArgs?.config) {
    console.log(`Using config file: ${parentArgs.config}`);
  }
  
  console.log(`Building image with tag: ${args.tag}`);
  console.log(`Build context: ${args.context}`);
  if (args.file) {
    console.log(`Using Dockerfile: ${args.file}`);
  }
}, args, cfg);
