import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { akahuAccount, akahuTransaction } from "#db/schema";
import { eq, desc } from "drizzle-orm";

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

  // Get account ID from route params
  const accountId = event.context.params?.accountId;

  if (!accountId) {
    throw createError({
      statusCode: 400,
      message: "Account ID is required",
    });
  }

  const db = useDrizzle();

  try {
    // Verify account ownership
    const accounts = await db
      .select()
      .from(akahuAccount)
      .where(eq(akahuAccount.id, accountId))
      .limit(1);

    if (accounts.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Account not found",
      });
    }

    const account = accounts[0];

    if (account.userId !== session.user.id) {
      throw createError({
        statusCode: 403,
        message: "Forbidden: You do not own this account",
      });
    }

    // Fetch ALL transactions for this account, ordered by date (desc)
    const transactions = await db
      .select()
      .from(akahuTransaction)
      .where(eq(akahuTransaction.accountId, accountId))
      .orderBy(desc(akahuTransaction.date));

    return {
      success: true,
      transactions,
      total: transactions.length,
    };
  } catch (error: any) {
    console.error("[transactions] Error fetching transactions:", error);
    throw createError({
      statusCode: 500,
      message: error.message || "Failed to fetch transactions",
    });
  }
});
