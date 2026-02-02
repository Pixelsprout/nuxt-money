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
