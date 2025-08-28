import { createCli, defineCommand } from "@reliverse/rempts";

const main = defineCommand({
  meta: {
    name: "dler",
    description: "",
  },
});

await createCli(main);
