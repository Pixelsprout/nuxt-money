#!/usr/bin/env tsx
/**
 * Seed invite script
 *
 * Usage:
 *   pnpm db:seed:invite --email=user@example.com
 *   pnpm db:seed:invite --email=user@example.com --env=prod
 *   pnpm db:seed:invite --email=user@example.com --env=staging
 *
 * Environments:
 *   --env=dev (default) - Uses local database (file:local.db)
 *   --env=prod - Uses production database from .env.production
 *   --env=staging - Uses staging database from .env.staging
 *
 * You can override with --db_url if needed
 */

import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { invite } from "../db/schema.js";
import { nanoid } from "nanoid";
import { env } from "node:process";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Parse command line arguments
function parseArgs() {
  const args: Record<string, string> = {};

  process.argv.slice(2).forEach((arg) => {
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) {
      args[match[1]] = match[2];
    }
  });

  return args;
}

// Get parsed args early
const parsedArgs = parseArgs();
const environment = parsedArgs.env || "dev";

// Load appropriate environment file
const envFileMap: Record<string, string> = {
  dev: ".env",
  staging: ".env.staging",
  prod: ".env.production",
};

const envFile = envFileMap[environment];
const envPath = resolve(process.cwd(), envFile);

if (existsSync(envPath)) {
  console.log(`📄 Loading environment from ${envFile}`);
  config({ path: envPath });
} else if (environment !== "dev") {
  console.warn(`⚠️  ${envFile} not found, using current environment variables`);
}

async function main() {
  const args = parseArgs();

  // Get email from arguments
  const email = args.email;
  if (!email) {
    console.error("❌ Error: --email is required");
    console.error("\nUsage:");
    console.error("  pnpm db:seed:invite --email=user@example.com");
    console.error("  pnpm db:seed:invite --email=user@example.com --env=prod");
    console.error(
      "  pnpm db:seed:invite --email=user@example.com --env=staging",
    );
    console.error("\nEnvironments:");
    console.error("  --env=dev (default) - Local database");
    console.error("  --env=prod - Production database");
    console.error("  --env=staging - Staging database");
    process.exit(1);
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error("❌ Error: Invalid email format");
    process.exit(1);
  }

  // Get database URL based on environment
  let databaseUrl: string | undefined;

  if (args.db_url) {
    // Explicit --db_url overrides everything
    databaseUrl = args.db_url;
  } else if (environment === "dev") {
    // Default to local file for dev
    databaseUrl = "file:local.db";
  } else {
    // Load from environment variables for prod/staging
    databaseUrl = env.TURSO_DATABASE_URL || env.NUXT_TURSO_DATABASE_URL;
  }

  if (!databaseUrl) {
    console.error("❌ Error: Database URL is required");
    console.error(
      `\nFor ${environment} environment, set TURSO_DATABASE_URL in ${envFile}`,
    );
    console.error("Or provide it via: --db_url=libsql://your-db.turso.io");
    process.exit(1);
  }

  // Get auth token from environment (required for remote databases)
  const authToken = env.TURSO_AUTH_TOKEN || env.NUXT_TURSO_AUTH_TOKEN;
  const isLocalFile = databaseUrl.startsWith("file:");

  if (!isLocalFile && !authToken) {
    console.error(
      "❌ Error: TURSO_AUTH_TOKEN is required for remote databases",
    );
    console.error(`Set it in ${envFile} or as an environment variable`);
    process.exit(1);
  }

  console.log(`🌍 Environment: ${environment}`);
  console.log(`🔄 Connecting to database...`);
  console.log(`📍 Database: ${databaseUrl}`);
  console.log(`📧 Email: ${email}`);

  // Create client
  const client = createClient({
    url: databaseUrl,
    authToken: authToken,
  });

  const db = drizzle(client);

  try {
    console.log("🌱 Creating invite...");

    const newInvite = await db
      .insert(invite)
      .values({
        id: nanoid(),
        email: email.toLowerCase(),
        invitedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log("✅ Invite created successfully!");
    console.log(`📧 Invited: ${newInvite[0].email}`);
    console.log(`🆔 Invite ID: ${newInvite[0].id}`);
    console.log(`📅 Invited at: ${newInvite[0].invitedAt}`);
  } catch (error: any) {
    // Handle unique constraint violation
    if (
      error.message?.includes("UNIQUE") ||
      error.message?.includes("unique constraint")
    ) {
      console.log("⚠️  An invite already exists for this email");
      process.exit(0);
    }

    console.error("❌ Failed to create invite:", error.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
