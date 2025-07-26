import { defineCommand } from "@reliverse/rempts";

import { generatorsExample } from "./gen/generators-example";

export default defineCommand({
  async run() {
    await generatorsExample();
    // await typedGenerators();
    // await highLevelGenerators();
    // await typedCmdsExample();
  },
});
