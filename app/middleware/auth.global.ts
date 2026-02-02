import type { User } from "#db/schema";

export default defineNuxtRouteMiddleware(async (to, from) => {
  const isLoginPage = to.path === "/login";
  const isErrorPage = to.path === "/error";

  let isAuthenticated = false;

  // Server-side: validate session using Better Auth server API
  if (import.meta.server) {
    const event = useRequestEvent();
    if (event) {
      try {
        // Dynamic import to prevent bundling server code in client
        const { auth } = await import("#root/lib/auth");
        const session = await auth.api.getSession({
          headers: event.node.req.headers as Record<string, string>,
        });
        isAuthenticated = !!session?.user;
      } catch (error) {
        console.error("Server-side session check error:", error);
        isAuthenticated = false;
      }
    }
  }
  // Client-side: check session via direct API call
  else {
    try {
      // Make direct fetch to session endpoint with credentials
      const session = await $fetch<{
        user?: User;
      }>("/api/auth/get-session", {
        credentials: "include",
      });
      isAuthenticated = !!session?.user;
    } catch (error) {
      console.error("Client-side session check error:", error);
      isAuthenticated = false;
    }
  }

  // Authenticated users can't access login page
  if (isAuthenticated && isLoginPage) {
    return navigateTo("/");
  }

  // Unauthenticated users must go to login (except if already on login or error page)
  if (!isAuthenticated && !isLoginPage && !isErrorPage) {
    return navigateTo("/login");
  }
});
