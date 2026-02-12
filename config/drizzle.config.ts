import { defineConfig } from "drizzle-kit";
import { postgresConfig } from "./postgres.config";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: postgresConfig.url,
  },
});
