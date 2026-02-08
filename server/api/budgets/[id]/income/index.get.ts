import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { budget, budgetIncome } from "#db/schema";
import { eq, and } from "drizzle-orm";

export default defineEventHandler(async (event) => {
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

  if (!budgetId) {
    throw createError({
      statusCode: 400,
      message: "Budget ID is required",
    });
  }

  const db = useDrizzle();

  try {
    // Verify budget ownership
    const budgetResult = await db
      .select()
      .from(budget)
      .where(and(eq(budget.id, budgetId), eq(budget.userId, session.user.id)));

    if (budgetResult.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Budget not found",
      });
    }

    // Get income sources
    const incomeResult = await db
      .select()
      .from(budgetIncome)
      .where(eq(budgetIncome.budgetId, budgetId));

    return {
      success: true,
      income: incomeResult,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/income] Error fetching income:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch income sources",
    });
  }
});
