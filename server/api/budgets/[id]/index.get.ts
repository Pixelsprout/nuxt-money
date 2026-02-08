import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  budget,
  budgetIncome,
  fixedExpense,
  categoryAllocation,
} from "#db/schema";
import { eq, and, sum } from "drizzle-orm";

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
    // Get the budget
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

    // Get fixed expenses
    const expensesResult = await db
      .select()
      .from(fixedExpense)
      .where(eq(fixedExpense.budgetId, budgetId));

    // Get category allocations
    const allocationsResult = await db
      .select()
      .from(categoryAllocation)
      .where(eq(categoryAllocation.budgetId, budgetId));

    // Calculate totals
    const totalIncome = incomeResult.reduce((sum, inc) => sum + inc.amount, 0);
    const totalFixedExpenses = expensesResult.reduce(
      (sum, exp) => sum + exp.amount,
      0
    );
    const totalAllocations = allocationsResult.reduce(
      (sum, alloc) => sum + alloc.allocatedAmount,
      0
    );

    return {
      success: true,
      budget: budgetResult[0],
      income: incomeResult,
      fixedExpenses: expensesResult,
      allocations: allocationsResult,
      totals: {
        income: totalIncome,
        fixedExpenses: totalFixedExpenses,
        allocations: totalAllocations,
        surplus: totalIncome - totalFixedExpenses - totalAllocations,
      },
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets] Error fetching budget:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch budget",
    });
  }
});
