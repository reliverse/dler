import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import { killPort } from "./impl";

export default defineCommand({
  meta: {
    name: "port",
    description:
      "Manage processes on ports. Kill processes using a specific port or check port status.",
    examples: [
      "dler port --port 3000",
      "dler port --port 3000 --action kill",
      "dler port --port 8080 --action check",
      "dler port --port 1420",
    ],
  },
  args: defineArgs({
    port: {
      type: "number",
      description: "The port number to operate on (1-65535)",
    },
    action: {
      type: "string",
      description: "Action to perform: kill or check",
      default: "kill",
    },
  }),
  run: async ({ args }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      // Validate port is provided
      if (!args.port || args.port < 1 || args.port > 65535) {
        logger.error(
          "❌ Invalid port number. Please provide a valid port number (1-65535)",
        );
        process.exit(1);
      }

      // Handle different actions
      const action = args.action || "kill";
      switch (action) {
        case "kill":
          await killPort(args.port);
          break;
        case "check":
          logger.info("Port check functionality coming soon!");
          break;
        default:
          console.log("Usage: dler port --port <port> --action <action>");
          console.log("Example: dler port --port 3000 --action kill");
          break;
      }
    } catch (error) {
      logger.error(
        `❌ Port command failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  },
});
