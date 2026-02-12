import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  budget,
  fixedExpense,
  fixedExpenseTransaction,
} from "#db/schema";
import { updateNextDueDate } from "#root/server/utils/next-due-date-calculator";
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

  const budgetId = getRouterParam(event, "id");
  const fixedExpenseId = getRouterParam(event, "fixedExpenseId");
  const transactionId = getRouterParam(event, "transactionId");

  if (!budgetId || !fixedExpenseId || !transactionId) {
    throw createError({
      statusCode: 400,
      message: "Budget ID, Fixed Expense ID, and Transaction ID are required",
    });
  }

  const db = useDrizzle();

  try {
    // Verify budget ownership
    const budgetRecord = await db.query.budget.findFirst({
      where: and(eq(budget.id, budgetId), eq(budget.userId, session.user.id)),
    });

    if (!budgetRecord) {
      throw createError({
        statusCode: 404,
        message: "Budget not found or access denied",
      });
    }

    // Verify expense ownership (through budget)
    const expense = await db.query.fixedExpense.findFirst({
      where: and(
        eq(fixedExpense.id, fixedExpenseId),
        eq(fixedExpense.budgetId, budgetId),
        eq(fixedExpense.userId, session.user.id)
      ),
    });

    if (!expense) {
      throw createError({
        statusCode: 404,
        message: "Fixed expense not found or access denied",
      });
    }

    // Check if the link exists
    const existingLink = await db
      .select()
      .from(fixedExpenseTransaction)
      .where(
        and(
          eq(fixedExpenseTransaction.fixedExpenseId, fixedExpenseId),
          eq(fixedExpenseTransaction.transactionId, transactionId)
        )
      )
      .limit(1);

    if (existingLink.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Transaction is not tagged to this fixed expense",
      });
    }

    // Delete the link
    await db
      .delete(fixedExpenseTransaction)
      .where(
        and(
          eq(fixedExpenseTransaction.fixedExpenseId, fixedExpenseId),
          eq(fixedExpenseTransaction.transactionId, transactionId)
        )
      );

    // Recalculate next due date
    await updateNextDueDate(fixedExpenseId);

    return {
      success: true,
      message: "Transaction untagged successfully",
    };
  } catch (error: any) {
    console.error("[fixed-expense] Error untagging transaction:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to untag transaction",
    });
  }
});
