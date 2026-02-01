import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/vue";
import type { auth } from "#root/lib/auth";

let _authClient: ReturnType<typeof createAuthClient> | null = null;

function getAuthClient() {
  if (!_authClient) {
    const config = useRuntimeConfig();
    _authClient = createAuthClient({
      baseURL: config.public.siteUrl,
      plugins: [inferAdditionalFields<typeof auth>()],
    });
  }
  return _authClient;
}

export const authClient = new Proxy({} as ReturnType<typeof createAuthClient>, {
  get(target, prop) {
    return getAuthClient()[prop as keyof ReturnType<typeof createAuthClient>];
  },
});

export const signIn = (
  ...args: Parameters<ReturnType<typeof createAuthClient>["signIn"]>
) => getAuthClient().signIn(...args);

export const signOut = (
  ...args: Parameters<ReturnType<typeof createAuthClient>["signOut"]>
) => getAuthClient().signOut(...args);

export const useSession = (
  ...args: Parameters<ReturnType<typeof createAuthClient>["useSession"]>
) => getAuthClient().useSession(...args);
