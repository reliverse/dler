import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { relico } from "@reliverse/relico";

const helloCommand = defineCommand({
  name: "hello",
  description: "Say hello to someone",
  options: {
    name: option(type("string", "=", "World"), {
      description: "Name to greet",
      short: "n",
    }),
    excited: option(type("boolean", "=", false), {
      description: "Add excitement!",
      short: "e",
    }),
  },
  handler: async ({ flags, colors }) => {
    const greeting = `Hello, ${flags.name}`;
    const message = flags.excited ? `${greeting}!` : `${greeting}.`;

    console.log(relico.green(message));
  },
});

export default helloCommand;
