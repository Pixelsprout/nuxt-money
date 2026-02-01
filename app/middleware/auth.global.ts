import { authClient } from "~/lib/auth-client";

export default defineNuxtRouteMiddleware(async (to, from) => {
  const isLoginPage = to.path === "/login";
  const isErrorPage = to.path === "/error";

  let isAuthenticated = false;
  let sessionData = null;

  // Server-side: validate session using Better Auth server API
  if (import.meta.server) {
    const event = useRequestEvent();
    if (event) {
      try {
        // Dynamic import to prevent bundling server code in client
        const { auth } = await import("#root/lib/auth");
        const session = await auth.api.getSession({
          headers: event.node.req.headers,
        });
        sessionData = session;
        isAuthenticated = !!session?.user;
        console.log(
          "[SERVER] Path:",
          to.path,
          "Session:",
          !!session?.user,
          "Cookies:",
          event.node.req.headers.cookie?.substring(0, 50),
        );
      } catch (error) {
        console.error("[SERVER] Session check error:", error);
        isAuthenticated = false;
      }
    }
  }
  // Client-side: check session via direct API call
  else {
    try {
      // Make direct fetch to session endpoint with credentials
      const session = await $fetch("/api/auth/get-session", {
        credentials: "include",
      });
      sessionData = session;
      isAuthenticated = !!session?.user;
      console.log(
        "[CLIENT] Path:",
        to.path,
        "Session:",
        !!session?.user,
        "Session data:",
        session,
      );
      console.log("[CLIENT] All cookies:", document.cookie);
    } catch (error) {
      console.error("[CLIENT] Session check error:", error);
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
