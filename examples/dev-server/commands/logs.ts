import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { relico } from "@reliverse/relico";

const logsCommand = defineCommand({
  name: "logs",
  description: "View server logs",
  options: {
    follow: option(type("boolean").default(false), {
      description: "Follow log output in real-time",
      short: "f",
    }),
    lines: option(type("number").min(1).max(1000).default(50), {
      description: "Number of lines to show",
      short: "n",
    }),
    level: option(type("'error'|'warn'|'info'|'debug'").default("info"), {
      description: "Minimum log level",
      short: "l",
    }),
    service: option(type("string?"), {
      description: "Filter by service name",
      short: "s",
    }),
  },
  handler: async ({ flags, spinner, colors, context }) => {
    const { follow, lines, level, service } = flags;

    if (follow) {
      console.log(relico.cyan("Following logs (Press Ctrl+C to stop)..."));
      console.log(relico.dim("Simulating real-time log output:\n"));

      // Simulate log streaming
      const logLevels = ["info", "warn", "error", "debug"] as const;
      const services = ["server", "database", "cache", "auth"];
      const messages = [
        "Server started on port 3000",
        "Database connection established",
        "Cache miss for key: user:123",
        "Authentication successful",
        "Request processed in 45ms",
        "Cache hit for key: config:app",
        "Database query completed",
        "Server shutting down gracefully",
      ];

      let count = 0;
      const interval = setInterval(() => {
        const timestamp = new Date().toISOString();
        const logLevel = logLevels[Math.floor(Math.random() * logLevels.length)];
        const serviceName = service || services[Math.floor(Math.random() * services.length)];
        const message = messages[Math.floor(Math.random() * messages.length)];

        const levelColor = {
          error: relico.red,
          warn: relico.yellow,
          info: relico.blue,
          debug: relico.gray,
        }[logLevel!];

        console.log(
          `${relico.dim(timestamp)} ${levelColor(`[${logLevel!.toUpperCase()}]`)} ${relico.cyan(`[${serviceName}]`)} ${message}`,
        );

        count++;
        if (count >= 20) {
          clearInterval(interval);
          console.log(relico.dim("\nLog streaming stopped"));
        }
      }, 1000);

      // Handle Ctrl+C
      process.on("SIGINT", () => {
        clearInterval(interval);
        console.log(relico.yellow("\nStopped following logs"));
        process.exit(0);
      });
    } else {
      const logsSpinner = spinner(`Loading last ${lines} log entries...`);
      await new Promise((resolve) => setTimeout(resolve, 800));
      logsSpinner.succeed("Logs loaded");

      // Simulate log entries
      const logEntries = [
        {
          timestamp: "2024-01-15T10:30:15.123Z",
          level: "info",
          service: "server",
          message: "Server started on port 3000",
        },
        {
          timestamp: "2024-01-15T10:30:16.456Z",
          level: "info",
          service: "database",
          message: "Database connection established",
        },
        {
          timestamp: "2024-01-15T10:30:17.789Z",
          level: "warn",
          service: "cache",
          message: "Cache miss for key: user:123",
        },
        {
          timestamp: "2024-01-15T10:30:18.012Z",
          level: "info",
          service: "auth",
          message: "Authentication successful",
        },
        {
          timestamp: "2024-01-15T10:30:19.345Z",
          level: "debug",
          service: "server",
          message: "Request processed in 45ms",
        },
        {
          timestamp: "2024-01-15T10:30:20.678Z",
          level: "info",
          service: "cache",
          message: "Cache hit for key: config:app",
        },
        {
          timestamp: "2024-01-15T10:30:21.901Z",
          level: "error",
          service: "database",
          message: "Connection timeout after 30s",
        },
        {
          timestamp: "2024-01-15T10:30:22.234Z",
          level: "info",
          service: "server",
          message: "Server shutting down gracefully",
        },
      ];

      const filteredLogs = logEntries
        .filter((log) => !service || log.service === service)
        .slice(-lines);

      if (filteredLogs.length === 0) {
        console.log(relico.yellow("No logs found"));
        return;
      }

      console.log(relico.cyan(`\nLast ${filteredLogs.length} log entries:`));
      console.log(relico.dim("─".repeat(80)));

      filteredLogs.forEach((log) => {
        const levelColor = {
          error: relico.red,
          warn: relico.yellow,
          info: relico.blue,
          debug: relico.gray,
        }[log.level];

        console.log(
          `${relico.dim(log.timestamp)} ${levelColor?.(`[${log.level.toUpperCase()}]`) || relico.gray(`[${log.level.toUpperCase()}]`)} ${relico.cyan(`[${log.service}]`)} ${log.message}`,
        );
      });
    }

    // Access plugin context
    if (context?.store) {
      // Type-safe access to plugin stores
      if ("metrics" in context.store) {
        context.store.metrics.recordEvent("logs_viewed", { follow, lines, level, service });
      }
    }
  },
});

export default logsCommand;
