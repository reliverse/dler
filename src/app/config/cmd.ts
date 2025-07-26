import { defineArgs, defineCommand } from "@reliverse/rempts";

export default defineCommand({
  meta: {
    name: "config",
    description: "Manage project-level and device-global configurations",
  },
  args: defineArgs({}),
  run: async ({ args }) => {
    console.log(args);
  },
});
