import { defineConfig } from "drizzle-kit";

import { memoryPath } from "./src-ts/app/config/constants";

export default defineConfig({
  out: "./drizzle",
  dialect: "sqlite",
  schema: "./src-ts/app/db/schema.ts",
  dbCredentials: { url: `file:${memoryPath}` },
});
