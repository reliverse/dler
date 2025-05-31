export function generateCommandTemplate(cmdName: string) {
  return `import { defineCommand, defineArgs } from "@reliverse/rempts";
  
  export default defineCommand({
    meta: {
      name: "${cmdName}",
      version: "1.0.0",
      description: "Describe what ${cmdName} command does.",
    },
    args: defineArgs({
      exampleArg: {
        type: "string",
        default: "defaultValue",
        description: "An example argument",
      },
    }),
    async run({ args }) {
      console.log("Command '${cmdName}' executed.");
      console.log("Received args:", args);
    },
  });
  `;
}

export const cliTemplate = `import { defineCommand, runMain } from "@reliverse/rempts";
  
  await runMain(
    defineCommand({
      // empty object activates file-based
      // commands in the src/app directory
    }),
  );
  `;
