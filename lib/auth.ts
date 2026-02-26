import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "#db/schema";
import { useDrizzle } from "#utils/drizzle";
import { inviteOnlyPlugin } from "./invite-only-plugin";

// Get base URL from environment or runtime config
function getBaseURL() {
  // Server-side can use process.env directly
  if (typeof process !== "undefined") {
    return (
      process.env.BETTER_AUTH_URL ||
      process.env.NUXT_PUBLIC_SITE_URL ||
      "http://localhost:3000"
    );
  }
  return "http://localhost:3000";
}

export const auth = betterAuth({
  database: drizzleAdapter(useDrizzle(), {
    provider: "postgresql",
    schema: {
      ...schema,
    },
  }),
  baseURL: getBaseURL(),
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
    crossSubDomainCookies: {
      enabled: true,
      domain: ".pixelsprout.dev",
    },
  },
  onAPIError: {
    errorURL: "/error",
  },
  plugins: [inviteOnlyPlugin()],
});
