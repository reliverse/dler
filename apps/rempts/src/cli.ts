#!/usr/bin/env bun
import { createApp, defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";
import { create } from "./create";

const cli = await createApp({
  config: {
    name: "rempts",
    version: "0.1.0",
    description: "Scaffold new Rempts CLI projects",
  },
  defaultCommand: "create",
});

// Use type assertion to access internal command() method
// This is needed for the @reliverse/rempts CLI itself which registers commands programmatically
(cli as any).command(
  defineCommand({
    description: "Create a new Rempts CLI project",
    options: {
      name: option(type("string | undefined"), { description: "Project name" }),
      template: option(type("string | undefined"), {
        short: "t",
        description: "Project template (basic, advanced, monorepo, or github:user/repo)",
      }),
      dir: option(type("string | undefined"), {
        short: "d",
        description: "Directory to create project in",
      }),
      git: option(type("boolean | undefined"), {
        short: "g",
        description: "Initialize git repository",
      }),
      install: option(type("boolean | undefined"), {
        short: "i",
        description: "Install dependencies",
      }),
      offline: option(type("boolean | undefined"), {
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
  })
);

await cli.run();
