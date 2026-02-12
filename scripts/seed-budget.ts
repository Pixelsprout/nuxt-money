#!/usr/bin/env tsx
/**
 * Seed budget script
 *
 * Usage:
 *   pnpm db:seed:budget --user-id=user123
 *   pnpm db:seed:budget --user-id=user123 --env=prod
 *   pnpm db:seed:budget --user-id=user123 --env=staging
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
import {
  budget,
  budgetIncome,
  fixedExpense,
  categoryAllocation,
  transactionCategory,
} from "../db/schema.js";
import { nanoid } from "nanoid";
import { env } from "node:process";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";

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

  // Get user ID from arguments
  const userId = args["user-id"];
  if (!userId) {
    console.error("❌ Error: --user-id is required");
    console.error("\nUsage:");
    console.error("  pnpm db:seed:budget --user-id=user123");
    console.error("  pnpm db:seed:budget --user-id=user123 --env=prod");
    console.error("  pnpm db:seed:budget --user-id=user123 --env=staging");
    console.error("\nEnvironments:");
    console.error("  --env=dev (default) - Local database");
    console.error("  --env=prod - Production database");
    console.error("  --env=staging - Staging database");
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
  console.log(`📍 Database: ${databaseUrl.replace(/:[^:]*@/, ":****@")}`);
  console.log(`👤 User ID: ${userId}`);

  // Create client
  const client = postgres(databaseUrl, { max: 1 });

  const db = drizzle(client);

  try {
    console.log("🌱 Creating budget...");

    // Calculate dates
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 10); // 10 days ago

    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 2); // 2 days from now

    // Create budget
    const budgetId = nanoid();
    const newBudget = await db
      .insert(budget)
      .values({
        id: budgetId,
        userId: userId,
        name: "Test Budget - Ending Soon",
        period: "MONTHLY",
        periodStart: periodStart,
        periodEnd: periodEnd,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log("✅ Budget created successfully!");
    console.log(`💰 Budget: ${newBudget[0].name}`);
    console.log(`🆔 Budget ID: ${newBudget[0].id}`);

    // Add income sources
    console.log("\n🌱 Adding income sources...");

    const incomeData = [
      { name: "Salary", amount: 500000, frequency: "MONTHLY" },
      { name: "Side Gig", amount: 50000, frequency: "FORTNIGHTLY" },
    ];

    const createdIncomes = await db
      .insert(budgetIncome)
      .values(
        incomeData.map((income) => ({
          id: nanoid(),
          budgetId: budgetId,
          userId: userId,
          name: income.name,
          amount: income.amount,
          frequency: income.frequency,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      )
      .returning();

    console.log(`✅ Created ${createdIncomes.length} income sources`);
    createdIncomes.forEach((income) => {
      console.log(`  • ${income.name}: $${(income.amount / 100).toFixed(2)}`);
    });

    // Add fixed expenses
    console.log("\n🌱 Adding fixed expenses...");

    const expenseData = [
      { name: "Rent", amount: 150000, frequency: "MONTHLY" },
      { name: "Internet", amount: 8000, frequency: "MONTHLY" },
    ];

    const createdExpenses = await db
      .insert(fixedExpense)
      .values(
        expenseData.map((expense) => ({
          id: nanoid(),
          budgetId: budgetId,
          userId: userId,
          name: expense.name,
          amount: expense.amount,
          frequency: expense.frequency,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      )
      .returning();

    console.log(`✅ Created ${createdExpenses.length} fixed expenses`);
    createdExpenses.forEach((expense) => {
      console.log(`  • ${expense.name}: $${(expense.amount / 100).toFixed(2)}`);
    });

    // Query for first category and add allocation
    console.log("\n🌱 Looking for categories to allocate...");

    const existingCategory = await db
      .select()
      .from(transactionCategory)
      .where(eq(transactionCategory.userId, userId))
      .limit(1);

    let allocationCount = 0;

    if (existingCategory.length > 0) {
      const category = existingCategory[0];
      const newAllocation = await db
        .insert(categoryAllocation)
        .values({
          id: nanoid(),
          budgetId: budgetId,
          categoryId: category.id,
          allocatedAmount: 50000, // $500
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      console.log("✅ Category allocation created");
      console.log(
        `  • ${category.name}: $${(newAllocation[0].allocatedAmount / 100).toFixed(2)}`,
      );
      allocationCount = 1;
    } else {
      console.log("ℹ️  No categories found for this user, skipping allocation");
    }

    // Summary
    console.log("\n📊 Summary:");
    console.log(`✅ Budget created with:`);
    console.log(`  • Income sources: ${createdIncomes.length}`);
    console.log(`  • Fixed expenses: ${createdExpenses.length}`);
    console.log(`  • Category allocations: ${allocationCount}`);
    console.log(
      `\n👁️  View at: http://localhost:3000/budgets/${newBudget[0].id}`,
    );
  } catch (error: any) {
    console.error("❌ Failed to create budget:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
