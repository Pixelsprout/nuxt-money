import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  budget,
  budgetIncome,
  budgetIncomeTransaction,
} from "#db/schema";
import { updateNextPayday } from "#root/server/utils/payday-calculator";
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
  const incomeId = getRouterParam(event, "incomeId");
  const transactionId = getRouterParam(event, "transactionId");

  if (!budgetId || !incomeId || !transactionId) {
    throw createError({
      statusCode: 400,
      message: "Budget ID, Income ID, and Transaction ID are required",
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

    // Verify income ownership (through budget)
    const income = await db.query.budgetIncome.findFirst({
      where: and(
        eq(budgetIncome.id, incomeId),
        eq(budgetIncome.budgetId, budgetId),
        eq(budgetIncome.userId, session.user.id)
      ),
    });

    if (!income) {
      throw createError({
        statusCode: 404,
        message: "Income item not found or access denied",
      });
    }

    // Check if the link exists
    const existingLink = await db
      .select()
      .from(budgetIncomeTransaction)
      .where(
        and(
          eq(budgetIncomeTransaction.incomeId, incomeId),
          eq(budgetIncomeTransaction.transactionId, transactionId)
        )
      )
      .limit(1);

    if (existingLink.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Transaction is not tagged to this income item",
      });
    }

    // Delete the link
    await db
      .delete(budgetIncomeTransaction)
      .where(
        and(
          eq(budgetIncomeTransaction.incomeId, incomeId),
          eq(budgetIncomeTransaction.transactionId, transactionId)
        )
      );

    // Recalculate next payday
    await updateNextPayday(incomeId);

    return {
      success: true,
      message: "Transaction untagged successfully",
    };
  } catch (error: any) {
    console.error("[income] Error untagging transaction:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to untag transaction",
    });
  }
});
