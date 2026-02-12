import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { akahuTransaction } from "#db/schema";
import { eq, and, desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  // Validate session
  const session = await auth.api.getSession({
    headers: event.node.req.headers,
  });

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  // Get query parameters
  const query = getQuery(event);
  const type = query.type as string | undefined; // Filter by type (DEBIT, CREDIT, etc.)

  const db = useDrizzle();

  try {
    // Build where conditions
    const conditions = [eq(akahuTransaction.userId, session.user.id)];

    if (type) {
      conditions.push(eq(akahuTransaction.type, type));
    }

    // Fetch all transactions for the user
    const transactions = await db
      .select()
      .from(akahuTransaction)
      .where(and(...conditions))
      .orderBy(desc(akahuTransaction.date))
      .limit(500); // Limit to recent 500 transactions for performance

    return {
      success: true,
      transactions: transactions,
      total: transactions.length,
    };
  } catch (error: any) {
    console.error("[transactions] Error fetching all transactions:", error);
    throw createError({
      statusCode: 500,
      message: error.message || "Failed to fetch transactions",
    });
  }
});
