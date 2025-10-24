#!/usr/bin/env bun

// Simple console logger for the example
const logger = {
  log: (message: string) => console.log(message),
  info: (message: string) => console.log(`ℹ️  ${message}`),
  success: (message: string) => console.log(`✅ ${message}`),
  warn: (message: string) => console.warn(`⚠️  ${message}`),
  error: (message: string) => console.error(`❌ ${message}`),
};

interface AppOptions {
  name?: string;
  version?: boolean;
  help?: boolean;
  verbose?: boolean;
  output?: string;
}

class NativeApp {
  private options: AppOptions = {};

  constructor() {
    this.parseArgs();
  }

  private parseArgs(): void {
    const args = process.argv.slice(2);

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case "--name":
        case "-n":
          this.options.name = args[++i];
          break;
        case "--version":
        case "-v":
          this.options.version = true;
          break;
        case "--help":
        case "-h":
          this.options.help = true;
          break;
        case "--verbose":
          this.options.verbose = true;
          break;
        case "--output":
        case "-o":
          this.options.output = args[++i];
          break;
        default:
          if (arg !== undefined && arg.startsWith("-")) {
            logger.warn(`Unknown option: ${arg}`);
          }
          break;
      }
    }
  }

  private showHelp(): void {
    logger.log(`
🚀 Native App Example - Built with Dler

USAGE:
  native-app [OPTIONS]

OPTIONS:
  -n, --name <name>     Set the application name
  -v, --version         Show version information
  -h, --help            Show this help message
  --verbose             Enable verbose logging
  -o, --output <file>   Set output file path

EXAMPLES:
  native-app --name "My App" --verbose
  native-app --version
  native-app --help
  native-app --output result.txt

This is a demonstration of building standalone executables with Dler.
The executable includes the Bun runtime and all dependencies.
    `);
  }

  private showVersion(): void {
    logger.log(`
Native App Example v1.0.0
Built with @reliverse/dler
Runtime: ${process.versions.bun ? "Bun" : "Node.js"} ${process.versions.bun || process.versions.node}
Platform: ${process.platform} ${process.arch}
    `);
  }

  private async runApp(): Promise<void> {
    if (this.options.verbose) {
      logger.info("🔍 Verbose mode enabled");
      logger.info(`📦 Package: ${process.env.npm_package_name || "unknown"}`);
      logger.info(
        `🏷️  Version: ${process.env.npm_package_version || "unknown"}`,
      );
      logger.info(`📁 Working directory: ${process.cwd()}`);
      logger.info(`🔧 Node.js version: ${process.version}`);
      if (process.versions.bun) {
        logger.info(`🍞 Bun version: ${process.versions.bun}`);
      }
    }

    const appName = this.options.name || "Native App";

    logger.success(`🎉 Welcome to ${appName}!`);
    logger.info("This is a native CLI application built with Dler.");
    logger.info("It demonstrates standalone executable building capabilities.");

    // Simulate some work
    logger.info("⏳ Processing...");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result = {
      appName,
      timestamp: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      runtime: process.versions.bun ? "Bun" : "Node.js",
      version: process.versions.bun || process.versions.node,
    };

    if (this.options.output) {
      const fs = await import("node:fs");
      await fs.promises.writeFile(
        this.options.output,
        JSON.stringify(result, null, 2),
      );
      logger.success(`📄 Result saved to: ${this.options.output}`);
    } else {
      logger.log("\n📊 Application Info:");
      logger.log(JSON.stringify(result, null, 2));
    }

    logger.success("✅ Application completed successfully!");
  }

  public async run(): Promise<void> {
    try {
      if (this.options.help) {
        this.showHelp();
        return;
      }

      if (this.options.version) {
        this.showVersion();
        return;
      }

      await this.runApp();
    } catch (error) {
      logger.error(
        `❌ Application failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  }
}

// Run the application
const app = new NativeApp();
app.run().catch((error) => {
  logger.error(
    `💥 Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
