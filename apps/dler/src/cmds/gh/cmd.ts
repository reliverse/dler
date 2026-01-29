// apps/dler/src/cmds/gh/cmd.ts

import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { analyzeRepository, formatOutput, getHeaders } from "./impl/count-gh-files";

type GhFormat = "text" | "json" | "csv";

const splitList = (value?: string): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length === 0) {
    return undefined;
  }

  return items;
};

export default defineCommand({
  description:
    "GitHub utilities. Currently supports counting files and generating repository statistics.",
  options: {
    repo: option(type("string | undefined"), {
      short: "r",
      description:
        "GitHub repository (owner/repo or full URL). Can also be provided as a positional argument.",
    }),
    url: option(type("string | undefined"), {
      description: "Alias for --repo",
    }),
    branch: option(type("string | undefined"), {
      short: "b",
      description: "Specify branch (default: repository default)",
    }),
    exclude: option(type("string | undefined"), {
      short: "e",
      description: 'Comma-separated patterns to exclude (e.g., "*.md,*.txt")',
    }),
    include: option(type("string | undefined"), {
      short: "i",
      description: 'Comma-separated patterns to include (e.g., "*.rs,*.ts")',
    }),
    format: option(type("string | undefined"), {
      short: "f",
      description: "Output format: text, json, csv (default: text)",
    }),
    stats: option(type("boolean | undefined"), {
      short: "s",
      description: "Show detailed file statistics",
    }),
    languages: option(type("boolean | undefined"), {
      short: "l",
      description: "Show programming language breakdown",
    }),
    output: option(type("string | undefined"), {
      short: "o",
      description: "Save results to file",
    }),
    quiet: option(type("boolean | undefined"), {
      short: "q",
      description: "Minimal output",
    }),
    verbose: option(type("boolean | undefined"), {
      short: "v",
      description: "Verbose output with progress",
    }),
  },
  handler: async ({ flags, positional }) => {
    try {
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime.");
        process.exit(1);
      }

      if (positional.length > 1) {
        logger.error("❌ Too many positional arguments.");
        logger.log("Usage: dler gh <owner/repo|url> [options]");
        process.exit(1);
      }

      const repo = positional[0] ?? flags.repo ?? flags.url;

      if (!repo) {
        logger.error("❌ Repository URL is required.");
        logger.log("Usage: dler gh <owner/repo|url> [options]");
        logger.log("");
        logger.log("Examples:");
        logger.log("  dler gh reliverse/relinter");
        logger.log("  dler gh microsoft/vscode --stats --languages");
        logger.log("  dler gh https://github.com/facebook/react --format json --output results.json");
        logger.log("  dler gh torvalds/linux --exclude \"*.md,*.txt\" --branch main");
        process.exit(1);
      }

      const rawFormat = flags.format ?? "text";
      if (rawFormat !== "text" && rawFormat !== "json" && rawFormat !== "csv") {
        logger.error(`❌ Invalid format: ${rawFormat}. Must be text, json, or csv.`);
        process.exit(1);
      }

      const format = rawFormat as GhFormat;
      const quiet = flags.quiet ?? false;
      const opts = {
        branch: flags.branch,
        exclude: splitList(flags.exclude),
        include: splitList(flags.include),
        format,
        stats: flags.stats ?? false,
        languages: flags.languages ?? false,
        output: flags.output,
        quiet,
        verbose: flags.verbose ?? false,
      };

      const token = process.env.GITHUB_TOKEN;
      const result = await analyzeRepository(repo, opts, token);
      const out = formatOutput(result, opts.format);

      if (opts.output) {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(opts.output, out, "utf8");

        if (!quiet) {
          console.log(`📄 Results saved to: ${opts.output}`);
        }
      }

      if (!opts.output) {
        console.log(out);
      }

      if (!token || quiet) {
        return;
      }

      try {
        const response = await fetch("https://api.github.com/rate_limit", {
          headers: getHeaders(token),
        });
        if (!response.ok) {
          return;
        }

        const rateLimit = await response.json();
        console.log(
          `📊 API calls remaining: ${rateLimit.rate.remaining}/${rateLimit.rate.limit}`
        );
      } catch {
        return;
      }
    } catch (error) {
      logger.error("❌ GitHub analysis failed:");

      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(String(error));
      }

      process.exit(1);
    }
  },
});
