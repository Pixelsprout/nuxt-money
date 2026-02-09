import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  budget,
  budgetIncome,
  fixedExpense,
  categoryAllocation,
  akahuTransaction,
  transactionCategory,
} from "#db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

/**
 * Get budget progress - actual spending vs allocated amounts per category.
 */
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
    // Get budget with ownership check
    const budgetResult = await db
      .select()
      .from(budget)
      .where(and(eq(budget.id, budgetId), eq(budget.userId, session.user.id)));

    if (budgetResult.length === 0) {
      console.error("[budgets/progress] Budget not found:", budgetId);
      throw createError({
        statusCode: 404,
        message: "Budget not found",
      });
    }

    const currentBudget = budgetResult[0];

    // Get all allocations for this budget
    const allocations = await db
      .select({
        allocation: categoryAllocation,
        category: transactionCategory,
      })
      .from(categoryAllocation)
      .leftJoin(
        transactionCategory,
        eq(categoryAllocation.categoryId, transactionCategory.id),
      )
      .where(eq(categoryAllocation.budgetId, budgetId));

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

    // Calculate spending per category within budget period
    const categoryProgress = await Promise.all(
      allocations.map(async (row) => {
        const { allocation, category } = row;

        // Get transactions for this category in the budget period
        const transactions = await db
          .select()
          .from(akahuTransaction)
          .where(
            and(
              eq(akahuTransaction.userId, session.user.id),
              eq(akahuTransaction.categoryId, allocation.categoryId),
              gte(akahuTransaction.date, currentBudget.periodStart),
              lte(akahuTransaction.date, currentBudget.periodEnd),
            ),
          );

        // Calculate total spent (only debits/expenses)
        const spent = transactions.reduce((sum, t) => {
          const amount = t.amount?.value || 0;
          if (amount < 0 || t.type === "DEBIT") {
            return sum + Math.abs(amount);
          }
          return sum;
        }, 0);

        const spentCents = Math.round(spent * 100);
        const allocatedCents = allocation.allocatedAmount;
        const remainingCents = allocatedCents - spentCents;
        const percentUsed =
          allocatedCents > 0
            ? Math.round((spentCents / allocatedCents) * 100)
            : 0;

        return {
          category,
          allocated: allocatedCents,
          spent: spentCents,
          remaining: remainingCents,
          percentUsed,
          transactionCount: transactions.length,
          status:
            percentUsed >= 100
              ? "OVER_BUDGET"
              : percentUsed >= 80
                ? "WARNING"
                : "ON_TRACK",
        };
      }),
    );

    // Calculate totals
    const totalIncome = incomeResult.reduce((sum, inc) => sum + inc.amount, 0);
    const totalFixedExpenses = expensesResult.reduce(
      (sum, exp) => sum + exp.amount,
      0,
    );
    const totalAllocated = allocations.reduce(
      (sum, a) => sum + a.allocation.allocatedAmount,
      0,
    );
    const totalSpent = categoryProgress.reduce((sum, p) => sum + p.spent, 0);

    // Calculate days progress in budget period
    const now = new Date();
    const periodStart = new Date(currentBudget.periodStart);
    const periodEnd = new Date(currentBudget.periodEnd);

    // Validate dates
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      console.error("[budgets/progress] Invalid dates:", {
        periodStart: currentBudget.periodStart,
        periodEnd: currentBudget.periodEnd,
      });
      throw createError({
        statusCode: 500,
        message: "Invalid budget period dates",
      });
    }

    const totalDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysElapsed = Math.max(
      0,
      Math.ceil(
        (Math.min(now.getTime(), periodEnd.getTime()) - periodStart.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const periodPercentComplete =
      totalDays > 0 ? Math.round((daysElapsed / totalDays) * 100) : 0;

    return {
      success: true,
      budget: currentBudget,
      summary: {
        totalIncome,
        totalFixedExpenses,
        totalAllocated,
        totalSpent,
        totalRemaining: totalAllocated - totalSpent,
        surplus: totalIncome - totalFixedExpenses - totalAllocated,
        overallPercentUsed:
          totalAllocated > 0
            ? Math.round((totalSpent / totalAllocated) * 100)
            : 0,
      },
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        totalDays,
        daysElapsed,
        daysRemaining,
        percentComplete: periodPercentComplete,
      },
      categoryProgress,
      income: incomeResult,
      fixedExpenses: expensesResult,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/progress] Error getting progress:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to get budget progress",
    });
  }
});
