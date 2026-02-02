import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { akahuAccount, akahuTransaction } from "#db/schema";
import { getAkahuClient, getAkahuUserToken } from "#root/server/utils/akahu";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

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

  // Get request body
  const body = await readBody(event);
  const { accountId, startDate, endDate } = body;

  if (!accountId || !startDate || !endDate) {
    throw createError({
      statusCode: 400,
      message: "accountId, startDate, and endDate are required",
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

    // Fetch transactions from Akahu API
    const akahuClient = getAkahuClient();
    const userToken = getAkahuUserToken();

    const transactionsResponse = await akahuClient.transactions.list(userToken, {
      start: startDate,
      end: endDate,
    });

    // Filter transactions for this specific account
    const accountTransactions = transactionsResponse.items.filter(
      (t: any) => t._account === account.akahuId
    );

    // Upsert transactions in database
    const syncedTransactions = [];
    for (const transaction of accountTransactions) {
      const existingTransaction = await db
        .select()
        .from(akahuTransaction)
        .where(eq(akahuTransaction.akahuId, transaction._id))
        .limit(1);

      const transactionData = {
        userId: session.user.id,
        accountId: accountId,
        akahuId: transaction._id,
        date: new Date(transaction.date),
        description: transaction.description,
        amount: {
          value: transaction.amount,
          currency: transaction.balance?.currency || "NZD",
        },
        balance: transaction.balance
          ? {
              current: transaction.balance.current,
              currency: transaction.balance.currency,
            }
          : null,
        type: transaction.type || null,
        category: transaction.category?.name || null,
        merchant: transaction.merchant?.name || null,
        updatedAt: new Date(),
      };

      if (existingTransaction.length > 0) {
        // Update existing transaction
        const updated = await db
          .update(akahuTransaction)
          .set(transactionData)
          .where(eq(akahuTransaction.id, existingTransaction[0].id))
          .returning();

        syncedTransactions.push(updated[0]);
      } else {
        // Insert new transaction
        const inserted = await db
          .insert(akahuTransaction)
          .values({
            id: nanoid(),
            ...transactionData,
            createdAt: new Date(),
          })
          .returning();

        syncedTransactions.push(inserted[0]);
      }
    }

    return {
      success: true,
      syncedCount: syncedTransactions.length,
      transactions: syncedTransactions,
    };
  } catch (error: any) {
    console.error("[akahu] Error syncing transactions:", error);
    throw createError({
      statusCode: 500,
      message: error.message || "Failed to sync transactions",
    });
  }
});
