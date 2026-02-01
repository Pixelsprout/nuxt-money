import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/vue";
import type { auth } from "#root/lib/auth";

export const authClient = createAuthClient({
  baseURL: process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3000",
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signOut, useSession } = authClient;
