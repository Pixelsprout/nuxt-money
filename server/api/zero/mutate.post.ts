// Mutate endpoint for zero-cache.
// Currently accounts are read-only from Zero's perspective — writes happen
// via the existing Akahu sync API routes which write directly to Postgres.
// This endpoint is required by zero-cache but returns an empty response.

export default defineEventHandler(async (event) => {
  // Return empty push response — no mutations are supported yet
  return [];
});
