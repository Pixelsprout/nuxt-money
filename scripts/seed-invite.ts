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
 *   --env=dev (default) - Uses local PostgreSQL database
 *   --env=prod - Uses production database from .env.production
 *   --env=staging - Uses staging database from .env.staging
 *
 * You can override with --db_url if needed
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
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
  } else {
    // Load from environment variables
    databaseUrl = env.DATABASE_URL;
  }

  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL is required");
    console.error(
      `\nFor ${environment} environment, set DATABASE_URL in ${envFile}`,
    );
    console.error("Or provide it via: --db_url=postgresql://...");
    process.exit(1);
  }

  console.log(`🌍 Environment: ${environment}`);
  console.log(`🔄 Connecting to database...`);
  console.log(`📍 Database: ${databaseUrl.replace(/:[^:]*@/, ":****@")}`); // Hide password
  console.log(`📧 Email: ${email}`);

  // Create client
  const client = postgres(databaseUrl, { max: 1 });

  const db = drizzle(client, { schema: { invite } });

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
    await client.end();
  }
}

main();
