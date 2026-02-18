import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  akahuAccount,
  akahuTransaction,
  budgetIncome,
  budgetIncomeTransaction,
} from "#db/schema";
import { getAkahuClient, getAkahuUserToken } from "#root/server/utils/akahu";
import { lookupTransactionReference } from "#root/server/utils/transaction-reference";
import { updateNextPayday } from "#root/server/utils/payday-calculator";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";

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

    console.log("[akahu] Syncing transactions:", {
      accountId,
      accountAkahuId: account.akahuId,
      startDate,
      endDate,
    });

    // Fetch ALL transactions using pagination
    let allTransactions: any[] = [];
    let cursor: string | undefined = undefined;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(
        `[akahu] Fetching page ${pageCount}${cursor ? ` (cursor: ${cursor.substring(0, 20)}...)` : ""}`,
      );

      const transactionsResponse = await akahuClient.transactions.list(
        userToken,
        {
          start: startDate,
          end: endDate,
          cursor: cursor,
        },
      );

      allTransactions = allTransactions.concat(transactionsResponse.items);
      cursor = transactionsResponse.cursor?.next;

      console.log(
        `[akahu] Page ${pageCount}: ${transactionsResponse.items.length} transactions, total so far: ${allTransactions.length}`,
      );
    } while (cursor);

    console.log("[akahu] Received total transactions:", allTransactions.length);

    // Log first and last transaction dates from Akahu
    if (allTransactions.length > 0) {
      const sortedByDate = [...allTransactions].sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      console.log("[akahu] Date range from API:", {
        earliest: sortedByDate[0]?.date,
        latest: sortedByDate[sortedByDate.length - 1]?.date,
      });
    }

    // Filter transactions for this specific account
    const accountTransactions = allTransactions.filter(
      (t: any) => t._account === account.akahuId,
    );

    console.log(
      "[akahu] Filtered to account:",
      account.akahuId,
      "->",
      accountTransactions.length,
      "transactions",
    );

    // Log date range of filtered transactions
    if (accountTransactions.length > 0) {
      const sortedFiltered = [...accountTransactions].sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      console.log("[akahu] Account transaction date range:", {
        earliest: sortedFiltered[0]?.date,
        latest: sortedFiltered[sortedFiltered.length - 1]?.date,
      });
    }

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
        meta: transaction.meta
          ? {
              other_account: transaction.meta.other_account || undefined,
              particulars: transaction.meta.particulars || undefined,
              code: transaction.meta.code || undefined,
              reference: transaction.meta.reference || undefined,
              conversion: transaction.meta.conversion || undefined,
              card_suffix: transaction.meta.card_suffix || undefined,
              logo: transaction.meta.logo || undefined,
            }
          : null,
        updatedAt: new Date(),
      };

      let syncedTransaction;

      if (existingTransaction.length > 0) {
        // Update existing transaction
        const updated = await db
          .update(akahuTransaction)
          .set(transactionData)
          .where(eq(akahuTransaction.id, existingTransaction[0].id))
          .returning();

        syncedTransaction = updated[0];
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

        syncedTransaction = inserted[0];
      }

      // Auto-categorize based on transaction references
      if (!syncedTransaction.categoryId && syncedTransaction.description) {
        const reference = await lookupTransactionReference(
          session.user.id,
          syncedTransaction.merchant,
          syncedTransaction.description,
          syncedTransaction.meta?.other_account,
          syncedTransaction.amount?.value,
        );

        if (reference) {
          const categorized = await db
            .update(akahuTransaction)
            .set({ categoryId: reference.categoryId, updatedAt: new Date() })
            .where(eq(akahuTransaction.id, syncedTransaction.id))
            .returning();

          syncedTransaction = categorized[0];
        }
      }

      // Auto-tag income transactions
      if (
        syncedTransaction.meta &&
        typeof syncedTransaction.meta === "object" &&
        "other_account" in syncedTransaction.meta &&
        syncedTransaction.meta.other_account
      ) {
        const matchingIncomes = await db
          .select()
          .from(budgetIncome)
          .where(
            and(
              eq(budgetIncome.userId, session.user.id),
              eq(
                budgetIncome.expectedFromAccount,
                syncedTransaction.meta.other_account,
              ),
              eq(budgetIncome.autoTagEnabled, true),
            ),
          );

        for (const income of matchingIncomes) {
          // Check if already tagged (avoid duplicates)
          const existingLink = await db
            .select()
            .from(budgetIncomeTransaction)
            .where(
              and(
                eq(budgetIncomeTransaction.incomeId, income.id),
                eq(budgetIncomeTransaction.transactionId, syncedTransaction.id),
              ),
            )
            .limit(1);

          if (existingLink.length === 0) {
            // Create auto-tagged link
            await db.insert(budgetIncomeTransaction).values({
              id: nanoid(),
              incomeId: income.id,
              transactionId: syncedTransaction.id,
              fromAccount: syncedTransaction.meta.other_account,
              autoTagged: true,
            });

            // Update next payday
            await updateNextPayday(income.id);
          }
        }
      }

      syncedTransactions.push(syncedTransaction);
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
