#!/usr/bin/env bun
import { createCLI, defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { create } from "./create";

// Custom run to support default behavior
async function run() {
  const args = process.argv.slice(2);

  // If no arguments or only flags, inject "create" command
  if (args.length === 0 || args[0]?.startsWith("-")) {
    process.argv.splice(2, 0, "create");
  }
  // If first arg is not a flag and not "create", it's a project name
  else if (args[0] && !args[0].startsWith("-") && args[0] !== "create") {
    process.argv.splice(2, 0, "create");
  }

  const cli = await createCLI({
    name: "rempts",
    version: "0.1.0",
    description: "Scaffold new Rempts CLI projects",
  });

  cli.command(
    defineCommand({
      name: "create",
      description: "Create a new Rempts CLI project",
      options: {
        name: option(type("string | undefined"), { description: "Project name" }),
        template: option(type("string"), {
          short: "t",
          description: "Project template (basic, advanced, monorepo, or github:user/repo)",
        }),
        dir: option(type("string | undefined"), {
          short: "d",
          description: "Directory to create project in",
        }),
        git: option(type("boolean"), {
          short: "g",
          description: "Initialize git repository",
        }),
        install: option(type("boolean"), {
          short: "i",
          description: "Install dependencies",
        }),
        offline: option(type("boolean"), {
          description: "Use cached templates when available",
        }),
      },
      handler: async (context) => {
        // Apply defaults
        const options = {
          name: context.flags.name,
          template: context.flags.template ?? "basic",
          dir: context.flags.dir,
          git: context.flags.git ?? true,
          install: context.flags.install ?? true,
          offline: context.flags.offline ?? false,
        } as {
          name: string | undefined;
          template: string;
          dir: string | undefined;
          git: boolean;
          install: boolean;
          offline: boolean;
        };
        return create({ ...context, flags: options });
      },
    }),
  );

  await cli.run();
}

await run();
