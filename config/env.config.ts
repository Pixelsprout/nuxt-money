export function checkEnv(env: NodeJS.ProcessEnv) {
  // Skip env checks during typecheck
  if (process.argv.some((arg) => arg.includes("typecheck"))) {
    return;
  }

  const required = [
    "NUXT_TURSO_DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ];

  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  // Check if we're in production or staging
  const environment = env.NODE_ENV || "development";
  const isProduction = environment === "production";
  const isStaging = environment === "staging";

  // NUXT_TURSO_AUTH_TOKEN is required in production and staging
  if ((isProduction || isStaging) && !env.NUXT_TURSO_AUTH_TOKEN) {
    throw new Error(
      `Missing required environment variable: NUXT_TURSO_AUTH_TOKEN (required in ${environment} environment)`,
    );
  }

  // In development, check if using remote Turso (not local file)
  if (environment === "development") {
    const isLocalFile = env.NUXT_TURSO_DATABASE_URL?.startsWith("file:");
    if (!isLocalFile && !env.NUXT_TURSO_AUTH_TOKEN) {
      throw new Error(
        "Missing required environment variable: NUXT_TURSO_AUTH_TOKEN (required for remote Turso)",
      );
    }
  }
}
