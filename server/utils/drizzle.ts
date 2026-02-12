import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { postgresConfig } from "../../config/postgres.config";
import * as schema from "../../db/schema";

const queryClient = postgres(postgresConfig.url);

export const useDrizzle = () => {
  return drizzle(queryClient, { schema });
};

export const tables = schema;

export const UserInsert = schema.user.$inferInsert;
export type UserRegisterType = Omit<
  typeof UserInsert,
  "createdAt" | "updatedAt" | "id" | "emailVerified"
>;
