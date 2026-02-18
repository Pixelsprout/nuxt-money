import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  akahuTransaction,
  akahuAccount,
  transactionCategory,
} from "#db/schema";
import { eq } from "drizzle-orm";
import { upsertTransactionReference } from "#root/server/utils/transaction-reference";

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

  // Get transaction ID from route params
  const transactionId = event.context.params?.id;

  if (!transactionId) {
    throw createError({
      statusCode: 400,
      message: "Transaction ID is required",
    });
  }

  // Get request body
  const body = await readBody(event);
  const { categoryId } = body;

  const db = useDrizzle();

  try {
    // Fetch the transaction
    const transactions = await db
      .select()
      .from(akahuTransaction)
      .where(eq(akahuTransaction.id, transactionId))
      .limit(1);

    if (transactions.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Transaction not found",
      });
    }

    const transaction = transactions[0];

    // Verify transaction ownership through account
    const accounts = await db
      .select()
      .from(akahuAccount)
      .where(eq(akahuAccount.id, transaction.accountId))
      .limit(1);

    if (accounts.length === 0 || accounts[0].userId !== session.user.id) {
      throw createError({
        statusCode: 403,
        message: "Forbidden: You do not own this transaction",
      });
    }

    // If categoryId is provided, verify category ownership
    if (categoryId) {
      const categories = await db
        .select()
        .from(transactionCategory)
        .where(eq(transactionCategory.id, categoryId))
        .limit(1);

      if (categories.length === 0) {
        throw createError({
          statusCode: 404,
          message: "Category not found",
        });
      }

      if (categories[0].userId !== session.user.id) {
        throw createError({
          statusCode: 403,
          message: "Forbidden: You do not own this category",
        });
      }
    }

    // Update transaction with new categoryId
    const updatedTransaction = await db
      .update(akahuTransaction)
      .set({
        categoryId: categoryId || null,
        updatedAt: new Date(),
      })
      .where(eq(akahuTransaction.id, transactionId))
      .returning();

    // Create/update transaction reference for future auto-categorization
    if (categoryId && transaction.description) {
      await upsertTransactionReference(
        session.user.id,
        transaction.merchant,
        transaction.description,
        transaction.meta?.other_account,
        categoryId,
      );
    }

    return {
      success: true,
      transaction: updatedTransaction[0],
    };
  } catch (error: any) {
    console.error("[transactions] Error updating category:", error);

    // Re-throw known errors
    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: "Failed to update transaction category",
    });
  }
});
