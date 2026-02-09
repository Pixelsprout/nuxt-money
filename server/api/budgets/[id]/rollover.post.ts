import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import {
  budget,
  budgetIncome,
  fixedExpense,
  categoryAllocation,
  type Budget,
  type BudgetIncome,
  type FixedExpense,
  type CategoryAllocation,
} from "#db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

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

  const body = await readBody(event);
  const customBudgetName = body?.newBudgetName;

  const db = useDrizzle();

  try {
    // Fetch the source budget and verify ownership
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

    const sourceBudget = budgetResult[0];

    // Calculate next period dates
    const nextPeriodStart = new Date(sourceBudget.periodEnd);
    nextPeriodStart.setDate(nextPeriodStart.getDate() + 1);

    let nextPeriodEnd: Date;
    const calcEnd = new Date(nextPeriodStart);

    switch (sourceBudget.period) {
      case "QUARTERLY":
        calcEnd.setMonth(calcEnd.getMonth() + 3);
        calcEnd.setDate(calcEnd.getDate() - 1);
        break;
      case "YEARLY":
        calcEnd.setFullYear(calcEnd.getFullYear() + 1);
        calcEnd.setDate(calcEnd.getDate() - 1);
        break;
      case "MONTHLY":
      default:
        calcEnd.setMonth(calcEnd.getMonth() + 1);
        calcEnd.setDate(calcEnd.getDate() - 1);
    }

    nextPeriodEnd = calcEnd;

    // Format next period month for the name
    const nextPeriodMonth = nextPeriodStart.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    const newBudgetName =
      customBudgetName || `${sourceBudget.name} - ${nextPeriodMonth}`;

    // Create new budget
    const newBudgetId = nanoid();

    const newBudgetResult = await db
      .insert(budget)
      .values({
        id: newBudgetId,
        userId: session.user.id,
        name: newBudgetName,
        period: sourceBudget.period,
        periodStart: nextPeriodStart,
        periodEnd: nextPeriodEnd,
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const createdBudget = newBudgetResult[0];

    // Copy budget income items
    const sourceIncomeItems = await db
      .select()
      .from(budgetIncome)
      .where(eq(budgetIncome.budgetId, sourceBudget.id));

    let incomeCount = 0;
    for (const income of sourceIncomeItems) {
      await db.insert(budgetIncome).values({
        id: nanoid(),
        budgetId: newBudgetId,
        userId: session.user.id,
        name: income.name,
        amount: income.amount,
        frequency: income.frequency,
        notes: income.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      incomeCount++;
    }

    // Copy fixed expense items
    const sourceExpenseItems = await db
      .select()
      .from(fixedExpense)
      .where(eq(fixedExpense.budgetId, sourceBudget.id));

    let expenseCount = 0;
    for (const expense of sourceExpenseItems) {
      await db.insert(fixedExpense).values({
        id: nanoid(),
        budgetId: newBudgetId,
        userId: session.user.id,
        name: expense.name,
        description: expense.description,
        amount: expense.amount,
        frequency: expense.frequency,
        categoryId: expense.categoryId,
        matchPattern: expense.matchPattern,
        nextDueDate: expense.nextDueDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expenseCount++;
    }

    // Copy category allocation items
    const sourceAllocationItems = await db
      .select()
      .from(categoryAllocation)
      .where(eq(categoryAllocation.budgetId, sourceBudget.id));

    let allocationCount = 0;
    for (const allocation of sourceAllocationItems) {
      await db.insert(categoryAllocation).values({
        id: nanoid(),
        budgetId: newBudgetId,
        categoryId: allocation.categoryId,
        allocatedAmount: allocation.allocatedAmount,
        notes: allocation.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      allocationCount++;
    }

    console.log("[budgets/rollover] Budget rolled over successfully:", {
      sourceBudgetId: sourceBudget.id,
      newBudgetId: newBudgetId,
      copiedItems: {
        incomeCount,
        expenseCount,
        allocationCount,
      },
    });

    return {
      success: true,
      newBudget: createdBudget,
      copiedItems: {
        incomeCount,
        expenseCount,
        allocationCount,
      },
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/rollover] Error rolling over budget:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to rollover budget",
    });
  }
});
