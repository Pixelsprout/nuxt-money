import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/vue";
import type { auth } from "#root/lib/auth";

// Lazy initialization to ensure plugin has run and set the base URL
let _authClient: ReturnType<typeof createAuthClient> | undefined;

function getAuthClient() {
  if (!_authClient) {
    let baseURL: string;

    // Server-side: use runtime config directly
    if (typeof window === "undefined") {
      try {
        const config = useRuntimeConfig();
        baseURL = config.public.siteUrl;
      } catch {
        // Fallback if runtime config not available
        baseURL = process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3000";
      }
    }
    // Client-side: use window variable set by plugin, or fallback to window.location.origin
    else {
      baseURL =
        (window as any).__NUXT_AUTH_BASE_URL__ || window.location.origin;
    }

    console.log("[AUTH CLIENT] Initializing with baseURL:", baseURL);

    _authClient = createAuthClient({
      baseURL,
      plugins: [inferAdditionalFields<typeof auth>()],
    });
  }
  return _authClient;
}

// Export a proxy that lazily initializes the client
export const authClient = new Proxy({} as ReturnType<typeof createAuthClient>, {
  get(target, prop) {
    return getAuthClient()[prop as keyof ReturnType<typeof createAuthClient>];
  },
});

// Export methods as getters from the lazy client
export const signIn = new Proxy(
  {} as ReturnType<typeof createAuthClient>["signIn"],
  {
    get(target, prop) {
      return getAuthClient().signIn[
        prop as keyof ReturnType<typeof createAuthClient>["signIn"]
      ];
    },
  },
);

export const signOut = new Proxy(
  {} as ReturnType<typeof createAuthClient>["signOut"],
  {
    get(target, prop) {
      return getAuthClient().signOut[
        prop as keyof ReturnType<typeof createAuthClient>["signOut"]
      ];
    },
  },
);

export const useSession = new Proxy(
  {} as ReturnType<typeof createAuthClient>["useSession"],
  {
    get(target, prop) {
      return getAuthClient().useSession[
        prop as keyof ReturnType<typeof createAuthClient>["useSession"]
      ];
    },
  },
);
