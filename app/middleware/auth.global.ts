import { authClient } from "~/lib/auth-client";

export default defineNuxtRouteMiddleware(async (to, from) => {
  const { data: session } = await authClient.useSession(useFetch);

  const isAuthenticated = !!session.value;
  const isLoginPage = to.path === "/login";
  const isErrorPage = to.path === "/error";

  // Authenticated users can't access login page
  if (isAuthenticated && isLoginPage) {
    return navigateTo("/");
  }

  // Unauthenticated users must go to login (except if already on login or error page)
  if (!isAuthenticated && !isLoginPage && !isErrorPage) {
    return navigateTo("/login");
  }
});
