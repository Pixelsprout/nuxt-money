import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { fixedExpense, transactionCategory } from "#db/schema";
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

  const expenseId = getRouterParam(event, "id");

  if (!expenseId) {
    throw createError({
      statusCode: 400,
      message: "Expense ID is required",
    });
  }

  const body = await readBody(event);
  const { name, description, amount, frequency, categoryId, matchPattern, nextDueDate } =
    body;

  const db = useDrizzle();

  try {
    // Verify ownership
    const existingExpense = await db
      .select()
      .from(fixedExpense)
      .where(
        and(
          eq(fixedExpense.id, expenseId),
          eq(fixedExpense.userId, session.user.id)
        )
      );

    if (existingExpense.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Fixed expense not found",
      });
    }

    // Build update object
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        throw createError({
          statusCode: 400,
          message: "Expense name cannot be empty",
        });
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description || null;
    }

    if (amount !== undefined) {
      if (typeof amount !== "number" || amount <= 0) {
        throw createError({
          statusCode: 400,
          message: "Amount must be a positive number",
        });
      }
      updateData.amount = Math.round(amount);
    }

    if (frequency !== undefined) {
      if (
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
      updateData.frequency = frequency;
    }

    if (categoryId !== undefined) {
      if (categoryId) {
        // Verify category ownership
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
      updateData.categoryId = categoryId || null;
    }

    if (matchPattern !== undefined) {
      updateData.matchPattern = matchPattern || null;
    }

    if (nextDueDate !== undefined) {
      updateData.nextDueDate = nextDueDate ? new Date(nextDueDate) : null;
    }

    const updatedExpense = await db
      .update(fixedExpense)
      .set(updateData)
      .where(eq(fixedExpense.id, expenseId))
      .returning();

    return {
      success: true,
      fixedExpense: updatedExpense[0],
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/fixed-expenses] Error updating expense:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to update fixed expense",
    });
  }
});
