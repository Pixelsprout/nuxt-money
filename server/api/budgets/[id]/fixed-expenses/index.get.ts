import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { budget, fixedExpense, transactionCategory } from "#db/schema";
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

    // Get fixed expenses with category info
    const expensesResult = await db
      .select({
        expense: fixedExpense,
        category: transactionCategory,
      })
      .from(fixedExpense)
      .leftJoin(
        transactionCategory,
        eq(fixedExpense.categoryId, transactionCategory.id)
      )
      .where(eq(fixedExpense.budgetId, budgetId));

    const expenses = expensesResult.map((row) => ({
      ...row.expense,
      category: row.category,
    }));

    return {
      success: true,
      fixedExpenses: expenses,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/fixed-expenses] Error fetching expenses:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch fixed expenses",
    });
  }
});
