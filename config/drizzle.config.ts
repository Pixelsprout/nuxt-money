import { defineConfig } from "drizzle-kit";
import { tursoConfig } from "./turso.config";

const isLocalFile = tursoConfig.url.startsWith("file:");

export default defineConfig({
  dialect: isLocalFile ? "sqlite" : "turso",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: isLocalFile
    ? { url: tursoConfig.url }
    : {
        url: tursoConfig.url,
        authToken: tursoConfig.authToken,
      },
});
