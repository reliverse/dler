import { defineArgs, defineCommand } from "@reliverse/rempts";

import { dlerPub } from "~/app/pub/impl";
import { ensureDlerConfig } from "~/libs/sdk/sdk-impl/config/init";
import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";
import { removeDistFolders } from "~/libs/sdk/sdk-mod";

export default defineCommand({
  meta: {
    name: "build",
    description: "Build the project",
  },
  args: defineArgs({
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
    },
  }),
  async run({ args }) {
    await ensureDlerConfig(args.dev);

    const config = await getConfigDler();

    await removeDistFolders(
      config.distNpmDirName,
      config.distJsrDirName,
      config.libsDirDist,
      config.libsList,
    );

    await dlerPub(args.dev, config);
  },
});
