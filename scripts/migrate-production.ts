#!/usr/bin/env tsx
/**
 * Production migration script
 *
 * Usage:
 *   npm run db:migrate:prod
 *
 * Or with environment variables:
 *   DATABASE_URL=postgresql://... npm run db:migrate:prod
 *
 * Or create a .env.production file with your credentials
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { env } from "node:process";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.production if it exists
const envPath = resolve(process.cwd(), ".env.production");
if (existsSync(envPath)) {
  console.log("📄 Loading environment from .env.production");
  config({ path: envPath });
}

async function main() {
  // Get connection details from environment
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL is required");
    console.error("Set it via environment variable or .env.production file");
    process.exit(1);
  }

  console.log("🔄 Connecting to production database...");
  console.log(`📍 Database: ${databaseUrl.replace(/:[^:]*@/, ":****@")}`); // Hide password

  // Create client
  const client = postgres(databaseUrl, { max: 1 });

  const db = drizzle(client);

  try {
    console.log("🚀 Running migrations...");

    await migrate(db, {
      migrationsFolder: "./db/migrations",
    });

    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
