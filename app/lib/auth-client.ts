import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/vue";
import type { auth } from "#root/lib/auth";

const config = useRuntimeConfig();

export const authClient = createAuthClient({
  baseURL: config.public.siteUrl,
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signOut, useSession } = authClient;
