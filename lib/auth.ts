import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "#db/schema";
import { useDrizzle } from "#utils/drizzle";
import { inviteOnlyPlugin } from "./invite-only-plugin";

export const auth = betterAuth({
  database: drizzleAdapter(useDrizzle(), {
    provider: "sqlite",
    schema: {
      ...schema,
    },
  }),
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  onAPIError: {
    errorURL: "/error",
  },
  plugins: [inviteOnlyPlugin()],
});
