export const postgresConfig = {
  url:
    process.env.DATABASE_URL ||
    "postgresql://postgres:password@localhost:5432/nuxt_money",
};
