export function checkEnv(env: NodeJS.ProcessEnv) {
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

  // NUXT_TURSO_AUTH_TOKEN is only required for remote Turso, not for file:local.db
  const isLocalFile = env.NUXT_TURSO_DATABASE_URL?.startsWith("file:");
  if (!isLocalFile && !env.NUXT_TURSO_AUTH_TOKEN) {
    throw new Error(
      "Missing required environment variable: NUXT_TURSO_AUTH_TOKEN (required for remote Turso)",
    );
  }
}
