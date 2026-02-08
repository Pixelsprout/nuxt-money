import { auth } from "#root/lib/auth";
import { useDrizzle } from "#utils/drizzle";
import { fixedExpense } from "#db/schema";
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

  const db = useDrizzle();

  try {
    // Delete with ownership check
    const deletedExpense = await db
      .delete(fixedExpense)
      .where(
        and(
          eq(fixedExpense.id, expenseId),
          eq(fixedExpense.userId, session.user.id)
        )
      )
      .returning();

    if (deletedExpense.length === 0) {
      throw createError({
        statusCode: 404,
        message: "Fixed expense not found",
      });
    }

    return {
      success: true,
      message: "Fixed expense deleted successfully",
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error("[budgets/fixed-expenses] Error deleting expense:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to delete fixed expense",
    });
  }
});
