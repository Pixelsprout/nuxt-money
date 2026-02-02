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
  category: text("category"),
  merchant: text("merchant"),

  // Sync tracking
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type AkahuTransaction = InferSelectModel<typeof akahuTransaction>;
