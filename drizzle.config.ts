import { defineConfig } from "drizzle-kit";

import { memoryPath } from "./src/impl/config/constants";

export default defineConfig({
  out: "./drizzle",
  dialect: "sqlite",
  schema: "./src/impl/db/schema.ts",
  dbCredentials: { url: `file:${memoryPath}` },
});
