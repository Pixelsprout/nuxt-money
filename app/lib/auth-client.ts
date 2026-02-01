import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/vue";
import type { auth } from "#root/lib/auth";

// Lazy initialization to ensure plugin has run and set the base URL
let _authClient: ReturnType<typeof createAuthClient> | undefined;

function getAuthClient() {
  if (!_authClient) {
    // Get baseURL - plugin should have set this, otherwise fallback to window.location.origin
    const baseURL =
      typeof window !== "undefined"
        ? (window as any).__NUXT_AUTH_BASE_URL__ || window.location.origin
        : undefined;

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
