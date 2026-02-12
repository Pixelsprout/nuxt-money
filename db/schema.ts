import type { InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
export * from "./auth/auth";
import { user } from "./auth/auth";

/***
 * Custom table here
 **/

export const akahuAccount = pgTable("akahu_account", {
  id: text("id").primaryKey(), // nanoid()
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  akahuId: text("akahu_id").notNull().unique(), // Akahu's _id
  name: text("name").notNull(),
  type: text("type").notNull(), // DEPOSITORY, CREDIT_CARD, LOAN
  formattedAccount: text("formatted_account"),
  balance: jsonb("balance").$type<{
    current: number;
    available?: number;
    limit?: number;
  }>(),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AkahuAccount = InferSelectModel<typeof akahuAccount>;

export const transactionCategory = pgTable("transaction_category", {
  id: text("id").primaryKey(), // nanoid()
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // Category metadata
  name: text("name").notNull(),
  color: text("color").default("#64748b"), // Hex color value (default: neutral gray)
  description: text("description"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TransactionCategory = InferSelectModel<typeof transactionCategory>;

export const akahuTransaction = pgTable("akahu_transaction", {
  id: text("id").primaryKey(), // nanoid()

  // Foreign Keys
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id")
    .notNull()
    .references(() => akahuAccount.id, { onDelete: "cascade" }),

  // Akahu-specific
  akahuId: text("akahu_id").notNull(), // Akahu's _id

  // Transaction Data
  date: timestamp("date").notNull(),
  description: text("description").notNull(),
  amount: jsonb("amount")
    .$type<{
      value: number;
      currency: string;
    }>()
    .notNull(),

  // Balance and enriched data
  balance: jsonb("balance").$type<{
    current: number;
    currency: string;
  }>(),

  // Transaction metadata
  type: text("type"), // DEBIT, CREDIT, etc.
  category: text("category"), // Akahu's raw category
  merchant: text("merchant"),

  // User-assigned category
  categoryId: text("category_id").references(() => transactionCategory.id, {
    onDelete: "set null",
  }),

  // Transaction metadata from Akahu
  meta: jsonb("meta").$type<{
    other_account?: string; // "00-0000-0000000-00"
    particulars?: string;
    code?: string;
    reference?: string;
    conversion?: Record<string, unknown>;
    card_suffix?: string;
    logo?: string;
  }>(),

  // Sync tracking
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AkahuTransaction = InferSelectModel<typeof akahuTransaction>;

// ==========================================
// BUDGETING TABLES
// ==========================================

export const budget = pgTable("budget", {
  id: text("id").primaryKey(), // nanoid()
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  period: text("period").notNull(), // MONTHLY, QUARTERLY, YEARLY
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  status: text("status").default("ACTIVE"), // DRAFT, ACTIVE, ARCHIVED
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Budget = InferSelectModel<typeof budget>;

export const budgetIncome = pgTable("budget_income", {
  id: text("id").primaryKey(), // nanoid()
  budgetId: text("budget_id")
    .notNull()
    .references(() => budget.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: integer("amount").notNull(), // cents
  frequency: text("frequency").notNull(), // WEEKLY, FORTNIGHTLY, MONTHLY
  notes: text("notes"),

  // Payday scheduling (user-configurable or auto-inferred)
  referenceDatePayday: timestamp("reference_date_payday"), // First/reference payday
  adjustForWeekends: boolean("adjust_for_weekends").default(true),

  // Auto-calculated next payday (updates after tagging transactions)
  nextPaydayDate: timestamp("next_payday_date"),

  // Optional: Track expected source account for auto-tagging
  expectedFromAccount: text("expected_from_account"),

  // Enable/disable auto-tagging for this income item
  autoTagEnabled: boolean("auto_tag_enabled").default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BudgetIncome = InferSelectModel<typeof budgetIncome>;

export const budgetIncomeTransaction = pgTable("budget_income_transaction", {
  id: text("id").primaryKey(), // nanoid()

  incomeId: text("income_id")
    .notNull()
    .references(() => budgetIncome.id, { onDelete: "cascade" }),

  transactionId: text("transaction_id")
    .notNull()
    .references(() => akahuTransaction.id, { onDelete: "cascade" }),

  fromAccount: text("from_account"), // Captured from transaction.meta.other_account
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
  autoTagged: boolean("auto_tagged").default(false).notNull(), // Track if auto or manually tagged
});

export type BudgetIncomeTransaction = InferSelectModel<
  typeof budgetIncomeTransaction
>;

export const fixedExpense = pgTable("fixed_expense", {
  id: text("id").primaryKey(), // nanoid()
  budgetId: text("budget_id")
    .notNull()
    .references(() => budget.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => transactionCategory.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  description: text("description"),
  amount: integer("amount").notNull(), // cents
  frequency: text("frequency").notNull(), // WEEKLY, FORTNIGHTLY, MONTHLY, QUARTERLY, YEARLY
  matchPattern: jsonb("match_pattern").$type<{
    merchant?: string;
    description?: string;
  }>(),
  nextDueDate: timestamp("next_due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type FixedExpense = InferSelectModel<typeof fixedExpense>;

export const fixedExpenseTransaction = pgTable("fixed_expense_transaction", {
  id: text("id").primaryKey(), // nanoid()
  fixedExpenseId: text("fixed_expense_id")
    .notNull()
    .references(() => fixedExpense.id, { onDelete: "cascade" }),
  transactionId: text("transaction_id")
    .notNull()
    .references(() => akahuTransaction.id, { onDelete: "cascade" }),
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
});

export type FixedExpenseTransaction = InferSelectModel<
  typeof fixedExpenseTransaction
>;

export const categoryAllocation = pgTable("category_allocation", {
  id: text("id").primaryKey(), // nanoid()
  budgetId: text("budget_id")
    .notNull()
    .references(() => budget.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => transactionCategory.id, { onDelete: "cascade" }),
  allocatedAmount: integer("allocated_amount").notNull(), // cents
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CategoryAllocation = InferSelectModel<typeof categoryAllocation>;
