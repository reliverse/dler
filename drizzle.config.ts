import { defineConfig } from "drizzle-kit";

import { memoryPath } from "./src-ts/impl/config/constants";

export default defineConfig({
  out: "./drizzle",
  dialect: "sqlite",
  schema: "./src-ts/impl/db/schema.ts",
  dbCredentials: { url: `file:${memoryPath}` },
});
