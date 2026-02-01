import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/vue";
import type { auth } from "#root/lib/auth";

// Get baseURL from environment variable if available, otherwise use window.location.origin
// This is set by the plugin at runtime
let baseURL: string | undefined;
if (typeof window !== "undefined") {
  baseURL = (window as any).__NUXT_AUTH_BASE_URL__ || window.location.origin;
}

export const authClient = createAuthClient({
  baseURL,
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signOut, useSession } = authClient;
