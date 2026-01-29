// apps/dler/src/cmds/rempts/cmd.ts

import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { create } from "./impl/create";

export default defineCommand({
  description: "Create a new Rempts CLI project",
  options: {
    name: option(type("string | undefined"), {
      description: "Project name",
    }),
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
  handler: async ({ flags, positional, prompt, spinner, colors, shell }) => {
    try {
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      const options = {
        name: flags.name,
        template: flags.template ?? "basic",
        dir: flags.dir,
        git: flags.git ?? true,
        install: flags.install ?? true,
        offline: flags.offline ?? false,
      } as {
        name: string | undefined;
        template: string;
        dir: string | undefined;
        git: boolean;
        install: boolean;
        offline: boolean;
      };

      return await create({
        flags: options,
        positional,
        prompt,
        spinner,
        colors,
        shell,
      });
    } catch (error) {
      logger.error("❌ Rempts create failed:");

      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(String(error));
      }

      process.exit(1);
    }
  },
});
