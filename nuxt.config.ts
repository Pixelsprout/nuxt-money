import { checkEnv } from "./config/env.config";
import { env } from "node:process";
import { fileURLToPath } from "node:url";

checkEnv(env);

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ui: {
    dashboardPanel: {
      ui: {
        body: "pb-20 sm:pb-0",
      },
    },
  },
  modules: [
    "@nuxt/eslint",
    "@nuxt/ui",
    "@nuxt/hints",
    "@nuxt/image",
    "@nuxt/test-utils",
  ],

  alias: {
    "#root": fileURLToPath(new URL(".", import.meta.url)),
    "#db": fileURLToPath(new URL("./db", import.meta.url)),
    "#utils": fileURLToPath(new URL("./server/utils", import.meta.url)),
    "#config": fileURLToPath(new URL("./config", import.meta.url)),
  },

  runtimeConfig: {
    turso: {
      databaseUrl: process.env.TURSO_DATABASE_URL,
      authToken: import.meta.env.PROD ? process.env.TURSO_AUTH_TOKEN : "",
    },
    AKAHU_APP_TOKEN: process.env.AKAHU_APP_TOKEN,
    AKAHU_USER_TOKEN: process.env.AKAHU_USER_TOKEN,
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3000",
    },
  },

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  routeRules: {
    "/": { prerender: false },
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
