import { createAuthClient } from "better-auth/vue";

export const authClient = createAuthClient({
  // baseURL is optional if running on the same domain
  // but you can explicitly set it if needed
});
export const signIn = async () => {
  const data = await authClient.signIn.social({
    provider: "google",
  });
};
