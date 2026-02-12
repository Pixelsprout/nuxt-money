import { config } from "dotenv";
config();

import { betterAuth } from "better-auth";
import { PostgresDialect } from "kysely";
import { Kysely } from "kysely";
import { Pool } from "pg";

export const auth = betterAuth({
  database: new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    }),
  }),
  socialProviders: {
    vercel: {
      clientId: process.env.VERCEL_CLIENT_ID as string,
      clientSecret: process.env.VERCEL_CLIENT_SECRET as string,
    },
  },
});
