// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    "@nuxt/eslint",
    "@nuxt/ui",
    "@nuxt/hints",
    "@nuxt/image",
    "@nuxt/test-utils",
  ],

  runtimeConfig: {
    tursoDbUrl: process.env.TURSO_DATABASE_URL,
    tursoAuthToken: process.env.TURSO_AUTH_TOKEN,
    vercelClientId: process.env.VERCEL_CLIENT_ID,
    vercelClientSecret: process.env.VERCEL_CLIENT_SECRET,
    betterAuthSecret: process.env.BETTER_AUTH_SECRET,
    public: {
      betterAuthUrl: process.env.BETTER_AUTH_URL,
    },
  },

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  routeRules: {
    "/": { prerender: true },
  },

  compatibilityDate: "2025-01-15",

  eslint: {
    config: {
      stylistic: {
        commaDangle: "never",
        braceStyle: "1tbs",
        quotes: "double",
      },
    },
  },
});
