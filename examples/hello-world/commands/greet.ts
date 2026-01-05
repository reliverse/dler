import { defineCommand, option } from "@reliverse/rempts-core";
import { z } from "zod";
import { relico } from "@reliverse/relico";

const greetCommand = defineCommand({
  name: "greet" as const,
  description: "A minimal greeting CLI",
  options: {
    // Simple string with default
    name: option(z.string().default("world")),

    // Boolean with short flag
    loud: option(z.coerce.boolean().default(false), {
      short: "l",
      description: "Shout the greeting",
    }),

    // Number with validation
    times: option(z.coerce.number().int().positive().default(1), {
      short: "t",
      description: "Number of times to greet",
    }),
  },
  handler: async ({ flags, colors }) => {
    const greeting = `Hello, ${flags.name}!`;
    const message = flags.loud ? greeting.toUpperCase() : greeting;

    for (let i = 0; i < flags.times; i++) {
      console.log(relico.cyan(message));
    }
  },
});

export default greetCommand;
