import { relico } from "@reliverse/relico";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";

export default defineCommand({
  name: "test" as const,
  description: "Run tests with complex validation patterns",
  options: {
    // Test pattern with regex validation
    pattern: option(
      type("string")
        .narrow((s, ctx) => {
          if (typeof s !== "string") {
            return ctx.reject("Expected string");
          }
          return (
            /^[a-zA-Z0-9._-]+$/.test(s) ||
            ctx.reject(
              "Pattern must contain only alphanumeric characters, dots, underscores, and hyphens"
            )
          );
        })
        .pipe((s) => s || "**/*.test.ts"),
      {
        short: "p",
        description: "Test file pattern",
      }
    ),

    // Coverage threshold with range validation
    coverage: option(
      type("number.integer >= 0 & number.integer <= 100").pipe((n) => n ?? 80),
      {
        short: "c",
        description: "Minimum coverage percentage",
      }
    ),

    // Timeout with custom validation
    timeout: option(
      type("number.integer >= 1000 & number.integer <= 300000").pipe((n) => n ?? 30_000),
      {
        short: "t",
        description: "Test timeout in milliseconds",
      }
    ),

    // Environment variables with validation and transformation
    env: option(
      type("string | undefined")
        .narrow((s, ctx) => {
          if (!s) {
            return true;
          }
          const vars = s.split(",");
          return (
            vars.every((v) => v.includes("=") && v.split("=").length === 2) ||
            ctx.reject(`Environment variables must be in format KEY=VALUE,KEY2=VALUE2 (was "${s}")`)
          );
        })
        .pipe((s) => {
          if (!s) {
            return undefined;
          }
          const vars: Record<string, string> = {};
          s.split(",").forEach((pair) => {
            const [key, value] = pair.split("=");
            if (key && value) {
              vars[key.trim()] = value.trim();
            }
          });
          return vars;
        }),
      {
        short: "e",
        description: "Environment variables (KEY=VALUE,KEY2=VALUE2)",
      }
    ),

    // Retry count with validation
    retries: option(
      type("number.integer >= 0 & number.integer <= 5").pipe((n) => n ?? 0),
      {
        short: "r",
        description: "Number of retries for failed tests",
      }
    ),

    // Watch mode
    watch: option(
      type("boolean").pipe((v) => v ?? false),
      {
        short: "w",
        description: "Watch for changes",
      }
    ),

    // Verbose output
    verbose: option(
      type("boolean").pipe((v) => v ?? false),
      {
        short: "v",
        description: "Verbose output",
      }
    ),
  },

  handler: async ({ flags, spinner }) => {
    const spin = spinner("Running tests...");

    try {
      // Simulate test discovery
      spin.update("Discovering test files...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      const testFiles = ["src/utils.test.ts", "src/api.test.ts", "src/components.test.ts"];

      spin.update(`Found ${testFiles.length} test files`);
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Simulate test execution
      let passed = 0;
      let failed = 0;

      for (const file of testFiles) {
        spin.update(`Running ${file}...`);
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Simulate some tests failing
        if (file.includes("api")) {
          failed++;
          if (flags.verbose) {
            console.log(relico.red(`  ❌ ${file}: API endpoint test failed`));
          }
        } else {
          passed++;
          if (flags.verbose) {
            console.log(relico.green(`  ✅ ${file}: All tests passed`));
          }
        }
      }

      // Simulate coverage calculation
      spin.update("Calculating coverage...");
      await new Promise((resolve) => setTimeout(resolve, 600));

      const coverage = 85.5; // Simulated coverage

      if (coverage >= flags.coverage) {
        spin.succeed(`Tests completed! ${passed} passed, ${failed} failed`);
      } else {
        spin.fail(
          `Tests completed but coverage ${coverage}% is below threshold ${flags.coverage}%`
        );
      }

      console.log(relico.bold("\nTest Results:"));
      console.log(`  Pattern: ${relico.cyan(flags.pattern)}`);
      console.log(`  Passed: ${relico.green(String(passed))}`);
      console.log(`  Failed: ${relico.red(String(failed))}`);
      console.log(`  Coverage: ${relico.cyan(coverage.toFixed(1))}%`);
      console.log(`  Timeout: ${relico.cyan(String(flags.timeout))}ms`);

      if (flags.env) {
        console.log(
          `  Environment: ${relico.cyan(String(Object.keys(flags.env).length))} variables`
        );
      }

      if (flags.retries > 0) {
        console.log(`  Retries: ${relico.cyan(String(flags.retries))}`);
      }

      if (flags.watch) {
        console.log(relico.yellow("\n👀 Watching for changes..."));
      }
    } catch (error) {
      spin.fail("Tests failed");
      console.error(relico.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  },
});
