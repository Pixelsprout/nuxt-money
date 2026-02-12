export function checkEnv(env: NodeJS.ProcessEnv) {
  // Skip env checks during typecheck
  if (process.argv.some((arg) => arg.includes("typecheck"))) {
    return;
  }

  const required = [
    "DATABASE_URL",
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

  // Validate DATABASE_URL format
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl && !databaseUrl.startsWith("postgresql://")) {
    throw new Error(
      "DATABASE_URL must be a PostgreSQL connection string (postgresql://...)",
    );
  }
}
