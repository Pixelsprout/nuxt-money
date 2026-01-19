import { config } from "dotenv";
config();

import { betterAuth } from "better-auth";
import { createClient } from "@libsql/client";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely } from "kysely";

export const auth = betterAuth({
  database: new Kysely({
    dialect: new LibsqlDialect({
      client: createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!,
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
