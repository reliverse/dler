import { relico } from "@reliverse/relico";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";

const greetCommand = defineCommand({
  name: "greet" as const,
  description: "A minimal greeting CLI",
  options: {
    // Simple string with default
    name: option(
      type("string | undefined").pipe((s) => s ?? "world"),
      {
        description: "Name to greet",
      }
    ),

    // Boolean with short flag
    loud: option(
      type("boolean | undefined").pipe((b) => b ?? false),
      {
        short: "l",
        description: "Shout the greeting",
      }
    ),

    // Number with validation
    times: option(
      type("number.integer > 0 | undefined").pipe((n) => n ?? 1),
      {
        short: "t",
        description: "Number of times to greet",
      }
    ),
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
