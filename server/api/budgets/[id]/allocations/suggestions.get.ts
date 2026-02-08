import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  budget,
  transactionCategory,
  akahuTransaction,
  categoryAllocation,
} from "#db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

/**
 * Get allocation suggestions based on 3-month historical spending averages per category.
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
    // Verify budget ownership and get budget details
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

    const currentBudget = budgetResult[0];

    // Calculate 3-month lookback period from budget start
    const lookbackEnd = new Date(currentBudget.periodStart);
    const lookbackStart = new Date(lookbackEnd);
    lookbackStart.setMonth(lookbackStart.getMonth() - 3);

    // Get all user categories
    const categories = await db
      .select()
      .from(transactionCategory)
      .where(eq(transactionCategory.userId, session.user.id));

    // Get existing allocations for this budget
    const existingAllocations = await db
      .select()
      .from(categoryAllocation)
      .where(eq(categoryAllocation.budgetId, budgetId));

    const existingCategoryIds = new Set(
      existingAllocations.map((a) => a.categoryId)
    );

    // Calculate spending per category in the lookback period
    const suggestions = await Promise.all(
      categories.map(async (category) => {
        // Get transactions for this category in the lookback period
        const transactions = await db
          .select()
          .from(akahuTransaction)
          .where(
            and(
              eq(akahuTransaction.userId, session.user.id),
              eq(akahuTransaction.categoryId, category.id),
              gte(akahuTransaction.date, lookbackStart),
              lte(akahuTransaction.date, lookbackEnd)
            )
          );

        // Calculate total spending (only debits/negative amounts)
        const totalSpending = transactions.reduce((sum, t) => {
          const amount = t.amount?.value || 0;
          // Only count expenses (negative amounts or DEBIT type)
          if (amount < 0 || t.type === "DEBIT") {
            return sum + Math.abs(amount);
          }
          return sum;
        }, 0);

        // Calculate monthly average (3 months)
        const monthlyAverage = totalSpending / 3;

        // Adjust based on budget period
        let suggestedAmount: number;
        switch (currentBudget.period) {
          case "QUARTERLY":
            suggestedAmount = monthlyAverage * 3;
            break;
          case "YEARLY":
            suggestedAmount = monthlyAverage * 12;
            break;
          case "MONTHLY":
          default:
            suggestedAmount = monthlyAverage;
        }

        return {
          category,
          transactionCount: transactions.length,
          totalSpending3Months: Math.round(totalSpending * 100), // cents
          monthlyAverage: Math.round(monthlyAverage * 100), // cents
          suggestedAmount: Math.round(suggestedAmount * 100), // cents
          hasExistingAllocation: existingCategoryIds.has(category.id),
          existingAllocation: existingAllocations.find(
            (a) => a.categoryId === category.id
          ),
        };
      })
    );

    // Sort by suggested amount (highest first)
    suggestions.sort((a, b) => b.suggestedAmount - a.suggestedAmount);

    return {
      success: true,
      lookbackPeriod: {
        start: lookbackStart.toISOString(),
        end: lookbackEnd.toISOString(),
      },
      budgetPeriod: currentBudget.period,
      suggestions,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/allocations] Error getting suggestions:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to get allocation suggestions",
    });
  }
});
