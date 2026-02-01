import { authClient } from "~/lib/auth-client";

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip on server to prevent hydration mismatches
  // Auth validation will happen on client where cookies are reliably available
  if (import.meta.server) {
    return;
  }

  const isLoginPage = to.path === "/login";
  const isErrorPage = to.path === "/error";

  const { data: session } = await authClient.useSession(useFetch);
  const isAuthenticated = !!session.value;

  // Authenticated users can't access login page
  if (isAuthenticated && isLoginPage) {
    return navigateTo("/");
  }

  // Unauthenticated users must go to login (except if already on login or error page)
  if (!isAuthenticated && !isLoginPage && !isErrorPage) {
    return navigateTo("/login");
  }
});
