import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { budget, fixedExpense, transactionCategory } from "#db/schema";
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
  const { name, description, amount, frequency, categoryId, matchPattern, nextDueDate } =
    body;

  // Validate inputs
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      message: "Expense name is required",
    });
  }

  if (typeof amount !== "number" || amount <= 0) {
    throw createError({
      statusCode: 400,
      message: "Amount must be a positive number",
    });
  }

  if (
    !frequency ||
    !["WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY", "YEARLY"].includes(
      frequency
    )
  ) {
    throw createError({
      statusCode: 400,
      message:
        "Frequency must be WEEKLY, FORTNIGHTLY, MONTHLY, QUARTERLY, or YEARLY",
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

    // Verify category ownership if provided
    if (categoryId) {
      const categoryResult = await db
        .select()
        .from(transactionCategory)
        .where(
          and(
            eq(transactionCategory.id, categoryId),
            eq(transactionCategory.userId, session.user.id)
          )
        );

      if (categoryResult.length === 0) {
        throw createError({
          statusCode: 400,
          message: "Category not found",
        });
      }
    }

    // Create fixed expense
    const newExpense = await db
      .insert(fixedExpense)
      .values({
        id: nanoid(),
        budgetId,
        userId: session.user.id,
        categoryId: categoryId || null,
        name: name.trim(),
        description: description || null,
        amount: Math.round(amount),
        frequency,
        matchPattern: matchPattern || null,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      success: true,
      fixedExpense: newExpense[0],
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/fixed-expenses] Error creating expense:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create fixed expense",
    });
  }
});
