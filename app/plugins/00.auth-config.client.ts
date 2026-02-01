export default defineNuxtPlugin(() => {
  // Set the auth base URL from runtime config
  // This runs before the auth client module is loaded
  const config = useRuntimeConfig();
  if (typeof window !== "undefined") {
    (window as any).__NUXT_AUTH_BASE_URL__ = config.public.siteUrl;
  }
});
