import type { InferSelectModel } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export * from "./auth/auth";
import { user } from "./auth/auth";

/***
 * Custom table here
 **/

export const akahuAccount = sqliteTable("akahu_account", {
  id: text("id").primaryKey(), // nanoid()
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  akahuId: text("akahu_id").notNull().unique(), // Akahu's _id
  name: text("name").notNull(),
  type: text("type").notNull(), // DEPOSITORY, CREDIT_CARD, LOAN
  formattedAccount: text("formatted_account"),
  balance: text("balance", { mode: "json" }).$type<{
    current: number;
    available?: number;
    limit?: number;
  }>(),
  syncedAt: integer("synced_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type AkahuAccount = InferSelectModel<typeof akahuAccount>;

export const transactionCategory = sqliteTable("transaction_category", {
  id: text("id").primaryKey(), // nanoid()
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // Category metadata
  name: text("name").notNull(),
  color: text("color").default("#64748b"), // Hex color value (default: neutral gray)
  description: text("description"),

  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type TransactionCategory = InferSelectModel<typeof transactionCategory>;

export const akahuTransaction = sqliteTable("akahu_transaction", {
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
  date: integer("date", { mode: "timestamp" }).notNull(),
  description: text("description").notNull(),
  amount: text("amount", { mode: "json" })
    .$type<{
      value: number;
      currency: string;
    }>()
    .notNull(),

  // Balance and enriched data
  balance: text("balance", { mode: "json" }).$type<{
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

  // Sync tracking
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type AkahuTransaction = InferSelectModel<typeof akahuTransaction>;

// ==========================================
// BUDGETING TABLES
// ==========================================

export const budget = sqliteTable("budget", {
  id: text("id").primaryKey(), // nanoid()
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  period: text("period").notNull(), // MONTHLY, QUARTERLY, YEARLY
  periodStart: integer("period_start", { mode: "timestamp" }).notNull(),
  periodEnd: integer("period_end", { mode: "timestamp" }).notNull(),
  status: text("status").default("ACTIVE"), // DRAFT, ACTIVE, ARCHIVED
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type Budget = InferSelectModel<typeof budget>;

export const budgetIncome = sqliteTable("budget_income", {
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type BudgetIncome = InferSelectModel<typeof budgetIncome>;

export const fixedExpense = sqliteTable("fixed_expense", {
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
  matchPattern: text("match_pattern", { mode: "json" }).$type<{
    merchant?: string;
    description?: string;
  }>(),
  nextDueDate: integer("next_due_date", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type FixedExpense = InferSelectModel<typeof fixedExpense>;

export const fixedExpenseTransaction = sqliteTable(
  "fixed_expense_transaction",
  {
    id: text("id").primaryKey(), // nanoid()
    fixedExpenseId: text("fixed_expense_id")
      .notNull()
      .references(() => fixedExpense.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => akahuTransaction.id, { onDelete: "cascade" }),
    linkedAt: integer("linked_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
);

export type FixedExpenseTransaction = InferSelectModel<
  typeof fixedExpenseTransaction
>;

export const categoryAllocation = sqliteTable("category_allocation", {
  id: text("id").primaryKey(), // nanoid()
  budgetId: text("budget_id")
    .notNull()
    .references(() => budget.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => transactionCategory.id, { onDelete: "cascade" }),
  allocatedAmount: integer("allocated_amount").notNull(), // cents
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type CategoryAllocation = InferSelectModel<typeof categoryAllocation>;
